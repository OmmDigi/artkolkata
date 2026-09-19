import { pool } from "..";
import {
  COURIER_PROTECTED_STATUSES,
  ONLINE_PAYMENT,
  ORDER_CANCELLED,
  ORDER_CONFIRMED,
  ORDER_DELIVERED,
  ORDER_PENDING,
  ORDER_RETURNED,
  ORDER_RETURN_INITIATED,
  RETURN_WINDOW_DAYS,
  REPLACE_INITIATED,
  REPLACED,
  SHIPMENT_MAPING,
} from "../constant";
import { v4 as uuidv4 } from "uuid";
import asyncErrorHandler from "../middleware/asyncErrorHandler";
import { CustomRequest, IOrderGstDetails, IShippingAddress } from "../types";
import {
  assertGuestCheckoutEnabled,
  assertPaymentMethodEnabled,
} from "./settings.controller";
import { calcluteCartAmounts } from "../utils/calcluteCartAmounts";
import { calculateAutoDiscount } from "../utils/calculateAutoDiscount";
import { buildPriceBreakdown } from "../utils/buildPriceBreakdown";
import { doTransition } from "../utils/doTransition";
import { doValidate } from "../utils/doValidate";
import { ErrorHandler } from "../utils/ErrorHandler";
import { generateOrderNumber } from "../utils/generateOrderNumber";
import { generatePlaceholders } from "../utils/generatePlaceholders";
import { httpResponse } from "../utils/httpResponse";
import {
  CACHE_TAGS,
  invalidateCache,
} from "../services/cache.service";
import { manageStock } from "../utils/manageStock";
import { notifyStaffNewOrder } from "../utils/notifyStaffNewOrder";
import { notifyOrderReceived, notifyOrderStatus } from "../utils/orderEmails";
import { parsePagination } from "../utils/parsePagination";
import {
  VCancelOrder,
  VCreateOrder,
  VGetPriceBreakdown,
  VReturnOrder,
  VTrackOrder,
  VSetOrderDraft,
  VUpdateOrderStatus,
  VUpdateShipmentBoxes,
  VUploadOrderInvoice,
} from "../validator/order.validator";
import {
  aggregateShipmentDimensions,
  IShipmentDimensionInput,
} from "../utils/aggregateShipmentDimensions";
import {
  EWAYBILL_THRESHOLD,
  getShippingPartner,
  isShippingEnabled,
  parseShipmentBoxes,
  ShipmentSkipReason,
} from "../services/shipping";
import { describeInstrument, getPaymentGateway } from "../services/payment";
import { isEmailEnabled } from "../services/email";
import { sendEmail } from "../utils/sendEmail";
import { saveOrderAddress } from "../utils/saveOrderAddress";
import { resolveGuestUser } from "../utils/resolveGuestUser";
import {
  createGuestOrderToken,
  requireGuestOrderToken,
} from "../services/guestOrderToken";
import { fetchCustomerOrderById } from "../services/customerOrders.service";

import logger from "../utils/logger";
import { withOrderDocumentUrls } from "../utils/orderDocumentUrls";
import { getOrderDocumentData } from "../services/documents/orderDocumentData";
import {
  generatePaymentSlip,
  renderUnstoredPaymentSlip,
} from "../services/documents/generatePaymentSlip";
import {
  renderInvoicePdf,
  renderPackingSlipPdf,
} from "../services/documents/renderOrderDocument";
import {
  deleteOrderDocument,
  fetchOrderDocument,
  uploadOrderDocument,
} from "../services/documents/documentStorage";
import {
  attachOrderToIdempotencyKey,
  completeIdempotencyKey,
  hashRequestPayload,
  readIdempotencyKey,
  releaseIdempotencyKey,
  reserveIdempotencyKey,
} from "../utils/idempotency";

const PLACE_ORDER_ENDPOINT = "POST /orders/place-order";

export const createOrder = asyncErrorHandler(
  async (req: CustomRequest, res) => {
    // first check is the user is logged in or not
    // if not loggeding and email already registered than throw error that email is already in used
    // if not loggeding and email not exist than registered the user first using the email phone number and other things place the order
    // if loggedin than update the address info and place the order

    const value = doValidate<{
      shippingDetails: IShippingAddress;
      paymentMethod: "ONLINE" | "COD";
      // present only when the customer is buying as a business and wants a
      // GST invoice they can claim input tax credit against
      gstDetails?: { gstNumber: string; businessName: string };
      product: {
        code?: string;
        product_ids: { id: number; quantity: number }[];
        varient_ids: { id: number; quantity: number }[];
      };
    }>(VCreateOrder, req.body ?? {});

    // The store owner can switch either method off from the CMS. Checked before
    // the idempotency key is reserved, so a rejected method never burns a key
    // the customer would then have to change to retry with.
    await assertPaymentMethodEnabled(value.paymentMethod);

    /**
     * Who is placing this. The route runs checkUser, not isAuthenticated, so a
     * missing or expired token is not an error here — it means guest checkout.
     *
     * A guest still gets a users row (see resolveGuestUser); everything below
     * this point works with a plain user id and neither knows nor cares which
     * of the two branches produced it. The only thing that stays different is
     * isGuestOrder, which is recorded on the order and decides whether a guest
     * order token is handed back at the end.
     */
    const isGuestOrder = !req.token_info;
    let customerId: number;

    if (req.token_info) {
      customerId = req.token_info.id;
    } else {
      // Refuses when the owner has turned guest checkout off, and before a key
      // is reserved for the same reason the payment check is.
      await assertGuestCheckoutEnabled();

      // Throws 409 ACCOUNT_EXISTS when this email is a real account — placing
      // the order would otherwise file it into a stranger's order history.
      const guest = await resolveGuestUser(value.shippingDetails);
      customerId = guest.id;
    }

    // Placing an order is not safe to repeat, so the client sends a key that
    // is stable across its retries and we do the work at most once for it. The
    // reservation happens before the order transaction opens and commits on
    // its own, so a duplicate arriving mid-flight sees it and backs off.
    //
    // Keyed by the guest's shadow user id for a guest order, which is what
    // makes the key work at all without a session: the same email resolves to
    // the same row, so a retry lands in the same bucket as the original.
    const idempotencyKey = readIdempotencyKey(req);
    const reservation = await reserveIdempotencyKey({
      key: idempotencyKey,
      userId: customerId,
      endpoint: PLACE_ORDER_ENDPOINT,
      // the validated payload, not the raw body: two retries that differ only
      // in fields Joi strips must still count as the same request
      requestHash: hashRequestPayload(value),
    });

    // A duplicate of an order that already went through. Replay the original
    // reply verbatim — for ONLINE that is the same gateway URL, so the
    // customer lands back on the payment page they were already sent to
    // instead of a second one for a second order.
    if (!reservation.reserved) {
      return httpResponse(
        res,
        reservation.status,
        reservation.message,
        reservation.data,
      );
    }

    let paymentMethodOrderId: string | null = null;
    let totalFinalAmount = 0;
    let paymentPageUrl: string | null = null;
    let createdOrderId: number | null = null;
    // Hoisted out of the transaction so the guest order token, which is minted
    // after the commit, can name the order the customer is looking at.
    let createdOrderNumber: string | null = null;

    let shipmentDimensions = {
      weight: 0.5,
      length: 10,
      breadth: 10,
      height: 10,
    };

    try {
      await doTransition(async (client) => {

        const { priceAfterDiscount, couponDiscount, subTotal, productsInfo, varientsInfo } =
          await calcluteCartAmounts(
            value.product.varient_ids,
            value.product.product_ids,
            value.product.code,
            client,
          );

        const cartDimensionInputs: IShipmentDimensionInput[] = [];
        for (const v of value.product.varient_ids) {
          const info = varientsInfo.find((item) => item.id == v.id);
          if (info) cartDimensionInputs.push({ ...info, quantity: v.quantity });
        }
        for (const p of value.product.product_ids) {
          const info = productsInfo.find((item) => item.id == p.id);
          if (info) cartDimensionInputs.push({ ...info, quantity: p.quantity });
        }
        // Snapshotted onto the order below so the shipment booked later uses the
        // dimensions as they were when the customer ordered.
        shipmentDimensions = aggregateShipmentDimensions(cartDimensionInputs);

        // Pincode serviceability only : the quoted courier rate is ignored, the
        // customer is never charged for delivery.
        const serviceability = await getShippingPartner().checkShipment({
          pincode: value.shippingDetails.pincode,
          weight: shipmentDimensions.weight,
          invoiceValue: subTotal,
          cod: value.paymentMethod === "COD",
          dimensions: shipmentDimensions,
        });

        // A partner that is down or not configured must not stop a customer
        // paying — only a positive "no courier goes there" blocks the order. The
        // booking itself happens later, on confirm, where it can be retried.
        if (!serviceability.success) {
          logger.error({
            message: "Serviceability check failed, allowing the order through",
            partner: getShippingPartner().name,
            pincode: value.shippingDetails.pincode,
            error: serviceability.error,
          });
        } else if (!serviceability.serviceable) {
          throw new ErrorHandler(
            400,
            `Delivery not available for pincode ${value.shippingDetails.pincode}`,
          );
        }

        // now continue with creating order

        const shippingAddressSnapshot = {
          name: value.shippingDetails.fullName,
          phone: value.shippingDetails.phone,
          email: value.shippingDetails.email,
          address_line1: value.shippingDetails.address,
          city: value.shippingDetails.city,
          state: value.shippingDetails.state,
          pincode: value.shippingDetails.pincode,
          country: value.shippingDetails.country ?? "India",
        };

        /**
         * Frozen on the order for the same reason the address is: it is what
         * the customer declared for this purchase. A company that later
         * changes its registered name must not silently rewrite an invoice it
         * has already filed.
         *
         * Joi has already normalised the GSTIN to upper case and rejected
         * anything that is not one, so nothing here needs to re-check it.
         */
        const gstDetailsSnapshot: IOrderGstDetails | null = value.gstDetails
          ? {
              gst_number: value.gstDetails.gstNumber,
              business_name: value.gstDetails.businessName,
            }
          : null;

        // the address typed at checkout also goes to the user's address book,
        // the order snapshot above is only a frozen copy of it. A guest gets
        // one too — the row is theirs the day they set a password and the
        // shadow account becomes a real one.
        await saveOrderAddress(client, customerId, value.shippingDetails);

        const orderNumber = generateOrderNumber();
        createdOrderNumber = orderNumber;

        // order value rule (e.g. "spend ₹2000, get 10% off") — applied on top of
        // the coupon, on the same client so it reads the rules inside the transaction
        const autoDiscount = await calculateAutoDiscount(
          priceAfterDiscount,
          !!value.product.code,
          client,
        );

        // same helper the checkout preview calls, so what was quoted is charged.
        // The shipping slab is read on the same client, inside this transaction.
        const priceBreakdown = await buildPriceBreakdown({
          subTotal,
          priceAfterDiscount,
          couponDiscount,
          autoDiscount,
          paymentMethod: value.paymentMethod,
          client,
        });

        totalFinalAmount = priceBreakdown.total;

        const orderInfo = await client.query(
          `INSERT INTO orders
              (user_id, order_number, subtotal, discount, coupon_discount, auto_discount, auto_discount_rule_id, shipping_charge, shipping_rule_id, total_amount, coupon_code, shipping_address, price_breakdown, payment_method, shipment_dimensions, is_guest_order, gst_details)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING order_id`,
          [
            customerId,
            orderNumber,
            priceBreakdown.subtotal,
            priceBreakdown.discount,
            priceBreakdown.coupon_discount,
            priceBreakdown.auto_discount,
            autoDiscount.rule?.id ?? null,
            priceBreakdown.shipping_charge,
            priceBreakdown.shipping_rule?.id ?? null,
            totalFinalAmount,
            value.product.code,
            JSON.stringify(shippingAddressSnapshot),
            JSON.stringify(priceBreakdown),
            value.paymentMethod,
            JSON.stringify(shipmentDimensions),
            isGuestOrder,
            // null, not '{}': "this order has no GST details" is a real
            // answer, and every reader checks for the key rather than for an
            // empty object
            gstDetailsSnapshot ? JSON.stringify(gstDetailsSnapshot) : null,
          ],
        );

        const orderId = orderInfo.rows[0].order_id;
        createdOrderId = orderId;

        // On the transaction client on purpose: this commits with the order,
        // so a key found IN_PROGRESS with an order_id is proof the order got
        // through and must not be recreated by a retry.
        await attachOrderToIdempotencyKey(client, reservation.recordId, orderId);

        const placeholder = generatePlaceholders(
          value.product.varient_ids.length + value.product.product_ids.length,
          6,
        );

        const valuesToStore: any[] = [];

        for (const varient of value.product.varient_ids) {
          const dbVarientInfo = varientsInfo.find(
            (item) => item.id == varient.id,
          );

          if (!dbVarientInfo)
            throw new ErrorHandler(404, "No varient id found in database");

          valuesToStore.push(orderId);
          valuesToStore.push(null);
          valuesToStore.push(dbVarientInfo);
          valuesToStore.push(varient.quantity);
          valuesToStore.push(dbVarientInfo.price);
          valuesToStore.push(parseFloat(dbVarientInfo.price) * varient.quantity);
        }

        for (const product of value.product.product_ids) {
          const dbProductInfo = productsInfo.find(
            (item) => item.id == product.id,
          );
          if (!dbProductInfo)
            throw new ErrorHandler(404, "No product id found in database");
          valuesToStore.push(orderId);
          valuesToStore.push(dbProductInfo as any);
          valuesToStore.push(null);
          valuesToStore.push(product.quantity);
          valuesToStore.push(dbProductInfo.price);
          valuesToStore.push(parseFloat(dbProductInfo.price) * product.quantity);
        }

        await client.query(
          `INSERT INTO order_items 
              (order_id, product_info, variant_info, quantity, price, subtotal)
           VALUES 
              ${placeholder}`,
          valuesToStore,
        );

        // Whichever gateway PAYMENT_GATEWAY selected at startup. Nothing here
        // knows or cares which one that is.
        const gateway = getPaymentGateway();

        if (value.paymentMethod == "ONLINE") {
          const { providerOrderId, paymentPageUrl: paymentUrl } =
            await gateway.createPaymentLink({
              amount: totalFinalAmount,
              orderRowId: orderId,
              merchantOrderId: uuidv4(),
              customerName: value.shippingDetails.fullName,
              customerPhone: value.shippingDetails.phone,
              customerEmail: shippingAddressSnapshot.email,
            });

          paymentPageUrl = paymentUrl;
          paymentMethodOrderId = providerOrderId;
        }

        // A COD order is already settled as far as the instrument goes — the
        // money arrives as cash at the door. An online one has no instrument
        // yet: the customer has not picked UPI or a card, so the columns stay
        // empty until the gateway says which it was.
        const codInstrument =
          value.paymentMethod == "ONLINE" ? null : describeInstrument({ type: "COD" });

        await client.query(
          `
          INSERT INTO payments
              (order_id, provider, provider_order_id, amount, status,
               payment_instrument, instrument_label, instrument_detail)
          VALUES
              ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
          `,
          [
            orderId,
            value.paymentMethod == "ONLINE" ? gateway.label : null,
            paymentMethodOrderId,
            totalFinalAmount,
            "PENDING",
            codInstrument?.type ?? null,
            codInstrument?.label ?? null,
            codInstrument ? JSON.stringify(codInstrument) : null,
          ],
        );

      });
    } catch (e) {
      // Nothing committed — doTransition rolled the whole thing back — so the
      // key goes back to being usable and the customer can fix whatever failed
      // and submit again with the same key.
      await releaseIdempotencyKey(reservation.recordId);
      throw e;
    }

    // No Bigship shipment is booked here, for COD or ONLINE. The boxes that
    // actually ship are keyed into the CMS by hand after the order lands, so
    // booking only happens when an admin moves the order to CONFIRMED.

    const responseMessage = "New order successfully created";

    /**
     * A guest has no session, so this token is the only thing that will let
     * them back into the order they just placed — the confirmation page, the
     * invoice, and cancelling while it is still PENDING all read it.
     *
     * Minted after the commit on purpose: a token for an order that rolled
     * back would be a link to nothing. It goes into responseData and therefore
     * into the stored idempotency reply, so a retry of the same key hands back
     * the same token rather than a second one.
     */
    const guestToken =
      isGuestOrder && createdOrderId != null && createdOrderNumber != null
        ? createGuestOrderToken({
            order_id: createdOrderId,
            order_number: createdOrderNumber,
            email: value.shippingDetails.email.trim().toLowerCase(),
            user_id: customerId,
          })
        : null;

    const responseData = {
      gatewayUrl: value.paymentMethod === "ONLINE" ? paymentPageUrl : null,
      // The order number is returned for every order, guest or not: the
      // storefront needs it to route to the confirmation page without a
      // second round trip.
      orderNumber: createdOrderNumber,
      isGuestOrder,
      guestToken,
    };

    // Store the reply before sending it, so a retry that arrives while this
    // response is still in flight replays it instead of being told the request
    // is still in progress. COD and ONLINE both land here; for ONLINE this is
    // what pins a duplicate to the same gateway page.
    await completeIdempotencyKey({
      recordId: reservation.recordId,
      orderId: createdOrderId,
      status: 201,
      message: responseMessage,
      data: responseData,
    });

    // Tell the staff who work on orders that a new one landed. Fire and forget
    // on purpose : the customer's checkout response must not wait on SMTP, and
    // a mail failure must not fail an order that is already committed.
    if (createdOrderId != null) {
      notifyStaffNewOrder(createdOrderId);

      // And tell the customer we have their order — but only for COD, where
      // placing the order is the whole transaction. An ONLINE order exists in
      // PENDING before the customer has even reached the gateway, so its
      // receipt email waits for the payment to actually succeed and is sent
      // from recordPaymentEvent instead.
      if (value.paymentMethod !== "ONLINE") notifyOrderReceived(createdOrderId);
    }

    httpResponse(res, 201, responseMessage, responseData);
  },
);

// Cart summary preview — subtotal, discounts, the GST already inside the price,
// and the payable total. Runs the exact same buildPriceBreakdown helper
// createOrder does, but read-only: no order or Bigship shipment is created.
// The checkout page renders this response as is, so the quote and the charge
// can never disagree.
export const getPriceBreakdown = asyncErrorHandler(async (req, res) => {
  const value = doValidate<{
    pincode: string;
    paymentMethod: "ONLINE" | "COD";
    product: {
      code?: string;
      product_ids: { id: number; quantity: number }[];
      varient_ids: { id: number; quantity: number }[];
    };
  }>(VGetPriceBreakdown, req.body ?? {});

  const { priceAfterDiscount, couponDiscount, subTotal, productsInfo, varientsInfo } =
    await calcluteCartAmounts(
      value.product.varient_ids,
      value.product.product_ids,
      value.product.code,
    );

  const cartDimensionInputs: IShipmentDimensionInput[] = [];
  for (const v of value.product.varient_ids) {
    const info = varientsInfo.find((item) => item.id == v.id);
    if (info) cartDimensionInputs.push({ ...info, quantity: v.quantity });
  }
  for (const p of value.product.product_ids) {
    const info = productsInfo.find((item) => item.id == p.id);
    if (info) cartDimensionInputs.push({ ...info, quantity: p.quantity });
  }
  const cartDimensions = aggregateShipmentDimensions(cartDimensionInputs);

  const serviceability = await getShippingPartner().checkShipment({
    pincode: value.pincode,
    weight: cartDimensions.weight,
    invoiceValue: subTotal,
    cod: value.paymentMethod === "COD",
    dimensions: cartDimensions,
  });

  // The cart uses this to grey out the place order button. createOrder applies
  // the same rule, so the preview and the placed order agree — including when
  // the partner is unreachable, where both let the order through.
  const serviceable = serviceability.success ? serviceability.serviceable : true;

  // same rule createOrder will apply, so the cart preview and the placed order match
  const autoDiscount = await calculateAutoDiscount(
    priceAfterDiscount,
    !!value.product.code,
  );

  const priceBreakdown = await buildPriceBreakdown({
    subTotal,
    priceAfterDiscount,
    couponDiscount,
    autoDiscount,
    paymentMethod: value.paymentMethod,
  });

  httpResponse(res, 200, "Price breakdown", {
    ...priceBreakdown,
    // createOrder refuses an unserviceable pincode, so the cart uses this to
    // block the place order button before the customer pays
    serviceable,
    courier_name: serviceability.courierName ?? null,
    estimated_days: serviceability.estimatedDays ?? null,
  });
});

export const getOrderList = asyncErrorHandler(async (req, res) => {
  const { TO_STRING } = parsePagination(req);

  let filter = "WHERE 1=1";
  let placeholder = 1;
  const filterValues: any[] = [];

  if (req.query.orderid) {
    filter += ` AND o.order_number = $${placeholder++}`;
    filterValues.push(req.query.orderid);
  }

  if (req.query.from && req.query.to) {
    filter += ` AND o.created_at BETWEEN $${placeholder++} AND $${placeholder++}`;
    filterValues.push(req.query.from);
    filterValues.push(req.query.to);
  }

  if (req.query.pstatus) {
    filter += ` AND o.payment_status = $${placeholder++}`;
    filterValues.push(req.query.pstatus);
  }

  if (req.query.ostatus) {
    filter += ` AND o.order_status = $${placeholder++}`;
    filterValues.push(req.query.ostatus);
  }

  /**
   * Drafts are parked orders — a test, a duplicate, a phone order keyed in
   * wrong — and they are off every screen but the one that asks for them.
   * ?draft=true is that screen: it shows drafts and nothing else, so the two
   * views never overlap and a total taken from either one is honest.
   */
  if (req.query.draft === "true") {
    filter += ` AND o.is_draft = true`;
  } else {
    filter += ` AND COALESCE(o.is_draft, false) = false`;
  }

  // "Show me only the orders nobody was logged in for." Read off the order, not
  // the customer, so a guest who has since made an account does not quietly
  // drop out of the list.
  if (req.query.customer_type === "guest") {
    filter += ` AND o.is_guest_order = true`;
  } else if (req.query.customer_type === "registered") {
    filter += ` AND COALESCE(o.is_guest_order, false) = false`;
  }

  const { rows } = await pool.query(
    `
       SELECT
         o.order_id,
         o.order_number,
         o.shipping_address->>'name' AS user_name,
         o.shipping_address->>'email' AS user_email,
         -- Whether it was placed without logging in. The CMS badges these, so
         -- staff can tell at a glance that there is no account behind the
         -- order and the only contact details are the ones on it.
         COALESCE(o.is_guest_order, false) AS is_guest_order,
         -- Parked by staff: the CMS badges it and offers Restore instead of
         -- Move to draft.
         COALESCE(o.is_draft, false) AS is_draft,
         o.total_amount,
         o.payment_status,
         o.payment_method,
         o.order_status,
         TO_CHAR(o.created_at, 'DD Mon YYYY') AS order_date,
         (o.created_at >= NOW() - INTERVAL '7 days') AS is_returnable,
         -- True for an invoice of either kind: one an admin uploaded from the
         -- CMS, or one the CMS generated. The payment slip is neither, and
         -- every order gets one regardless of this flag.
         (
           (o.invoice_document IS NOT NULL AND o.invoice_document <> '')
           OR (o.invoice_pdf_url IS NOT NULL AND o.invoice_pdf_url <> '')
         ) AS invoice_avilable,
         -- the uploaded invoice is the one the customer is given when both
         -- exist, so the CMS is told which of the two it is looking at
         (o.invoice_document IS NOT NULL AND o.invoice_document <> '') AS invoice_uploaded,
         (o.invoice_pdf_url IS NOT NULL AND o.invoice_pdf_url <> '') AS invoice_generated,
         o.invoice_number,
         (o.packing_slip_url IS NOT NULL AND o.packing_slip_url <> '') AS packing_slip_available
        FROM orders o

        LEFT JOIN users u
        ON u.id = o.user_id

        ${filter}

        ORDER BY o.order_id DESC

        ${TO_STRING}
      `,
    filterValues,
  );

  httpResponse(res, 200, "Order list", withOrderDocumentUrls(rows));
});

export const getSingleOrderInfo = asyncErrorHandler(async (req, res) => {
  const orderid = req.params.orderid;

  if (!orderid) throw new ErrorHandler(400, "Order id is required!");

  let objToReturn = {};

  await doTransition(async (client) => {
    const orderInfo = await client.query(
      `
       SELECT
        user_id,
        -- Placed without logging in. The CMS shows it because it changes how
        -- staff reach the customer: there is no account to look up, only the
        -- address snapshot on the order itself.
        COALESCE(is_guest_order, false) AS is_guest_order,
        -- Parked by staff. Hidden from the customer and from every analytics
        -- window while it is true; see setOrderDraft.
        COALESCE(is_draft, false) AS is_draft,
        TO_CHAR(drafted_at, 'DD Mon YYYY') AS drafted_at,
        order_number,
        subtotal,
        discount,
        shipping_charge,
        total_amount,
        coupon_code,
        order_status,
        payment_status,
        shipping_address,
        -- the buyer's own GSTIN, when they gave one. Staff need it on screen
        -- because it is what the invoice bills to, and a wrong one is a
        -- support call rather than something they can fix afterwards.
        gst_details,
        price_breakdown,
        payment_method,
        shipping_partner,
        partner_order_id,
        partner_shipment_id,
        waybill,
        courier_name,
        shipment_boxes,
        ewaybill_number,
        -- the documents themselves are multi-MB data URIs; the CMS only needs
        -- to know whether one is already on file
        (ewaybill_document IS NOT NULL AND ewaybill_document <> '') AS has_ewaybill_document,
        (invoice_document IS NOT NULL AND invoice_document <> '') AS has_invoice_document,
        -- the two documents the CMS generates. Only their presence and the
        -- invoice number are sent; the files themselves live on the upload
        -- server and are streamed by their own routes.
        (invoice_pdf_url IS NOT NULL AND invoice_pdf_url <> '') AS has_generated_invoice,
        (packing_slip_url IS NOT NULL AND packing_slip_url <> '') AS has_packing_slip,
        invoice_number,
        TO_CHAR(invoice_generated_at, 'DD Mon YYYY') AS invoice_generated_at,
        TO_CHAR(packing_slip_generated_at, 'DD Mon YYYY') AS packing_slip_generated_at
       FROM orders

       WHERE order_id = $1
      `,
      [orderid],
    );

    if (orderInfo.rowCount == 0)
      throw new ErrorHandler(404, "Order information not found!");

    const paymentInfo = await client.query(
      `
       SELECT
        p.*,
        u.name AS refunded_by_name
       FROM payments p
       LEFT JOIN users u
       ON u.id = p.refunded_by
       WHERE p.order_id = $1
      `,
      [orderid],
    );

    const orderItemsInfo = await client.query(
      `
       SELECT
        oi.order_item_id,
        oi.quantity,
        oi.price,
        oi.subtotal,
        oi.status,

        CASE
         WHEN oi.variant_info IS NOT NULL
         THEN oi.variant_info->>'product_name'
         ELSE oi.product_info->>'name'
        END AS product_name,

        CASE
         WHEN oi.variant_info IS NOT NULL
         THEN oi.variant_info->>'sku'
         ELSE null
        END AS sku,

        CASE
         WHEN oi.variant_info IS NOT NULL
         THEN COALESCE(
                oi.variant_info->'images'->0, 
                (
                  SELECT 
                    jsonb_build_object(
                     'image',   image,
                     'alt_tag', alt_tag 
                    )    
                  FROM product_images

                  WHERE product_id = (oi.variant_info->>'product_id')::int
                  AND COALESCE(type, 'image') = 'image'
                  ORDER BY position ASC
                  LIMIT 1
                )
              )
         ELSE oi.product_info->'images'->0
        END AS images

       FROM order_items oi

       WHERE order_id = $1
      `,
      [orderid],
    );

    objToReturn = {
      orderInfo: orderInfo.rows[0],
      addressInfo: orderInfo.rows[0].shipping_address,
      paymentInfo: paymentInfo.rows[0],
      orderItemsInfo: orderItemsInfo.rows,
      // Which partner is live right now, not which one booked this order.
      // orders.shipping_partner is only written at booking time, so it is NULL
      // both for a shop that never books and for a shiprocket order still
      // waiting to be confirmed — the CMS cannot tell those apart from the row.
      // It needs to: with no partner no tracking scan will ever move the order,
      // so the admin has to be able to set the courier-driven statuses by hand.
      shippingInfo: {
        enabled: isShippingEnabled(),
        partner: getShippingPartner().name,
        partner_label: getShippingPartner().label,
      },
    };
  });

  httpResponse(res, 200, "Single Order Info", objToReturn);
});

// Saves the boxes the order will actually ship in, plus the ewaybill details
// a B2B shipment needs. Admin only, and only while the order is still pending:
// confirming is what hands the boxes to the courier, so from that point on an
// edit here would only make the CMS disagree with what is actually shipping.
export const updateShipmentBoxes = asyncErrorHandler(async (req, res) => {
  const orderId = parseInt(String(req.params.orderid ?? ""), 10);
  if (!orderId) throw new ErrorHandler(400, "Invalid order id");

  const value = doValidate<{
    boxes: {
      weight_kg: number;
      length_cm: number;
      breadth_cm: number;
      height_cm: number;
    }[];
    ewaybill_number?: string | null;
    ewaybill_document?: string | null;
  }>(VUpdateShipmentBoxes, req.body ?? {});

  const { rows, rowCount } = await pool.query(
    "SELECT bigship_order_id, shiprocket_order_id, order_status FROM orders WHERE order_id = $1",
    [orderId],
  );

  if (rowCount === 0) throw new ErrorHandler(404, "Order information not found!");

  // Booked with either partner locks the boxes: what the courier was told the
  // parcel measures cannot be changed after the fact.
  if (rows[0].bigship_order_id || rows[0].shiprocket_order_id) {
    throw new ErrorHandler(
      400,
      "This order is already booked with the courier, so its boxes can no longer be changed.",
    );
  }

  if (rows[0].order_status !== ORDER_PENDING) {
    throw new ErrorHandler(
      400,
      `This order is already ${rows[0].order_status}, so its boxes can no longer be changed.`,
    );
  }

  // An omitted ewaybill field leaves whatever is already stored alone, so the
  // admin can re-save the boxes without re-uploading the document every time.
  await pool.query(
    `
     UPDATE orders
     SET shipment_boxes   = $1,
         ewaybill_number  = COALESCE($2, ewaybill_number),
         ewaybill_document = COALESCE($3, ewaybill_document),
         updated_at       = CURRENT_TIMESTAMP
     WHERE order_id = $4
    `,
    [
      JSON.stringify(value.boxes),
      value.ewaybill_number === undefined ? null : value.ewaybill_number || null,
      value.ewaybill_document === undefined
        ? null
        : value.ewaybill_document || null,
      orderId,
    ],
  );

  httpResponse(res, 200, "Shipment boxes saved", { boxes: value.boxes.length });
});

// Confirming is the point where the order goes to the courier, so everything
// the shipping partner will demand is checked up front — a status change that
// commits and then fails to book leaves the order looking fulfilled when it is
// not. Box dimensions are needed by both partners; the ewaybill rules below
// are Bigship's B2B ones and do not apply to a Shiprocket booking, which
// declares a single package and reads no invoice document.
const assertReadyToConfirm = async (orderId: number) => {
  // Boxes and ewaybills exist to satisfy a courier API. With no partner
  // configured nothing is booked, so demanding them would block a confirm for
  // the benefit of a booking that is never going to happen.
  if (!isShippingEnabled()) return;

  const { rows, rowCount } = await pool.query(
    `
     SELECT
      o.partner_order_id,
      o.shipment_boxes,
      o.ewaybill_number,
      o.ewaybill_document,
      COALESCE(SUM(oi.price * oi.quantity), 0) AS invoice_amount
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.order_id
     WHERE o.order_id = $1
     GROUP BY o.order_id
    `,
    [orderId],
  );

  if (rowCount === 0) throw new ErrorHandler(404, "Order information not found!");

  const order = rows[0];
  const partner = getShippingPartner();

  // Already with the courier — re-confirming is a no-op, not a reason to block.
  if (order.partner_order_id) return;

  const boxes = parseShipmentBoxes(order.shipment_boxes);

  if (boxes.length === 0) {
    throw new ErrorHandler(
      400,
      "Add the shipment box dimensions before confirming this order.",
    );
  }

  // Shiprocket consolidates the boxes into one declared package, so there is
  // nothing further to check for it.
  if (partner.name !== "bigship") return;

  // One box books as Bigship B2C, which carries no ewaybill at all.
  if (boxes.length === 1) return;

  const invoiceAmount = parseFloat(order.invoice_amount);

  if (
    invoiceAmount >= EWAYBILL_THRESHOLD &&
    (!order.ewaybill_number || !order.ewaybill_document)
  ) {
    throw new ErrorHandler(
      400,
      `A multi-box shipment invoiced at Rs. ${EWAYBILL_THRESHOLD} or above needs an ewaybill number and document before it can be confirmed.`,
    );
  }
};

// this is for admin access
export const updateOrderStatus = asyncErrorHandler(async (req, res) => {
  const value = doValidate(VUpdateOrderStatus, req.body ?? {});

  if (value.status === ORDER_CONFIRMED && value.order_id) {
    await assertReadyToConfirm(value.order_id);
  }

  await doTransition(async (client) => {
    await manageStock({
      order_status: value.status,
      orderid: value.order_id,
      client,
      orderitemid: value.order_item_id,
    });

    if (value.order_item_id) {
      await client.query(
        "UPDATE order_items SET status = $1 WHERE order_item_id = $2",
        [value.status, value.order_item_id],
      );
    } else {
      // delivered_at is stamped once and never moved: it anchors the return
      // window, so a later re-save of the same status must not extend it.
      await client.query(
        `
         UPDATE orders
         SET order_status = $1::varchar,
             delivered_at = CASE
               WHEN $1::varchar = '${ORDER_DELIVERED}' AND delivered_at IS NULL
               THEN CURRENT_TIMESTAMP
               ELSE delivered_at
             END,
             updated_at = CURRENT_TIMESTAMP
         WHERE order_id = $2
        `,
        [value.status, value.order_id],
      );

      await client.query(
        "UPDATE order_items SET status = $1 WHERE order_id = $2",
        [value.status, value.order_id],
      );
    }
  });

  // Stock moved with the status change, and a product's variant quantities are
  // part of its cached response. Runs after the commit so a rollback cannot
  // leave the cache cleared against data that never changed — and, more
  // importantly, so a concurrent read cannot refill the cache from the
  // pre-commit snapshot.
  await invalidateCache(CACHE_TAGS.PRODUCTS);

  // Tell the customer, after the commit and before any of the courier branches
  // below can return early. Not awaited, like the staff alert on a new order: an
  // admin pressing Confirm should not wait on a mail server, and nothing is
  // thrown out of notifyOrderStatus in any case.
  //
  // Only for whole-order changes. A single item moving to SHIPPED is not the
  // order shipping, and an email saying it is would be a lie to the customer.
  if (value.order_id && !value.order_item_id)
    notifyOrderStatus(value.order_id, value.status);

  // Cancelling in the CMS has to reach the courier too, or the parcel is still
  // collected and delivered against an order our side calls cancelled. Runs
  // after the commit, like the booking below, so a courier failure does not
  // roll the status back.
  if (isShippingEnabled() && value.status === ORDER_CANCELLED && value.order_id) {
    const { rows } = await pool.query(
      "SELECT waybill, partner_order_id FROM orders WHERE order_id = $1",
      [value.order_id],
    );

    const booked = rows[0];
    const partnerOrderId = booked?.partner_order_id ?? null;

    if (booked?.waybill || partnerOrderId) {
      const cancelResponse = await getShippingPartner().cancelShippingOrder({
        waybill: booked.waybill,
        partnerOrderId,
      });

      if (!cancelResponse.success) {
        logger.error({
          message: "Courier cancel failed (order already cancelled in DB)",
          partner: getShippingPartner().name,
          orderId: value.order_id,
          waybill: booked.waybill,
          partnerOrderId,
          error: cancelResponse.error ?? cancelResponse.message,
        });

        return httpResponse(
          res,
          200,
          "Order cancelled, but the courier would not cancel the shipment. Cancel it in the courier panel before it is picked up.",
          { shipment_cancelled: false },
        );
      }

      return httpResponse(res, 200, "Order status successfully updated", {
        shipment_cancelled: true,
      });
    }
  }

  // Confirming an order is the point of no return for fulfilment, so make sure
  // a shipment exists with the active shipping partner. Booking runs after the
  // transaction commits, so a courier failure never rolls back the status —
  // the order stays CONFIRMED and confirming it again retries the booking.
  //
  // With SHIPPING_PARTNER=none there is no booking to attempt, and no shipment
  // fields to report: the confirm falls through to the plain response at the
  // bottom, exactly as any other status change does.
  if (isShippingEnabled() && value.status === ORDER_CONFIRMED && value.order_id) {
    const partner = getShippingPartner();
    const shipment = await partner.createShippingOrder(value.order_id);

    // Booked just now, or already booked earlier — either way the order is
    // with the courier and there is nothing left to retry.
    const isBooked = shipment.created || shipment.skipped === "already_created";

    const REASON_MESSAGE: Partial<Record<ShipmentSkipReason, string>> = {
      payment_not_completed:
        "Order status updated. No shipment booked — this online order is not paid yet.",
      no_shipping_address:
        "Order status updated, but no shipment was booked: the order has no shipping address.",
      no_items:
        "Order status updated, but no shipment was booked: the order has no items.",
      no_shipment_boxes:
        "Order status updated, but no shipment was booked: the order has no box dimensions.",
      ewaybill_required:
        "Order status updated, but no shipment was booked: this multi-box shipment needs an ewaybill number and document.",
      order_not_found:
        "Order status updated, but the order could not be read back to book a shipment.",
      not_supported:
        `Order status updated, but ${partner.label} cannot book this shipment. Book it in the courier panel by hand.`,
    };

    if (!isBooked) {
      return httpResponse(
        res,
        200,
        shipment.skipped
          ? (REASON_MESSAGE[shipment.skipped] ??
            `Order status updated, but no shipment was booked (${shipment.skipped}).`)
          : `Order status updated, but the ${partner.label} shipment could not be booked. Confirm the order again to retry.`,
        { shipment_booked: false, reason: shipment.skipped ?? "booking_failed" },
      );
    }

    return httpResponse(res, 200, "Order status successfully updated", {
      shipment_booked: true,
      already_booked: shipment.skipped === "already_created",
      shipping_partner: partner.name,
      waybill: shipment.waybill ?? null,
      courier_name: shipment.courierName ?? null,
      partner_order_id: shipment.partnerOrderId ?? null,
    });
  }

  httpResponse(res, 200, "Order status successfully updated");
});

/**
 * Park an order, or bring it back. Admin only.
 *
 * A draft is an order that should not count: a test order, a duplicate, a phone
 * order keyed in wrong. It is a flag beside order_status rather than a status of
 * its own, so the order keeps whatever it already was and restoring it puts it
 * back exactly where it sat — nothing has to guess a status, and the courier
 * webhook, which writes order_status from the newest scan, cannot wipe the mark.
 *
 * Drafting gives the stock back, because a parked order is not holding anything
 * for anyone; restoring takes it out again if the status it returns to is one
 * that owns stock. manageStock decides both from stock_decreased, so a double
 * press cannot move a quantity twice.
 *
 * The customer stops seeing the order entirely (see customerOrders.service),
 * its status emails stay unsent (see sendOrderEmail) and every analytics window
 * ignores it — the three reasons an order gets parked in the first place.
 */
export const setOrderDraft = asyncErrorHandler(async (req: CustomRequest, res) => {
  const orderId = Number(req.params.orderid);

  if (!Number.isInteger(orderId) || orderId <= 0)
    throw new ErrorHandler(400, "Order id is required!");

  const value = doValidate<{ is_draft: boolean }>(
    VSetOrderDraft,
    req.body ?? {},
  );

  const { rows, rowCount } = await pool.query(
    "SELECT order_status, COALESCE(is_draft, false) AS is_draft FROM orders WHERE order_id = $1",
    [orderId],
  );

  if (rowCount === 0) throw new ErrorHandler(404, "Order information not found!");

  const order = rows[0];

  // Already where it is being asked to go. Said plainly rather than run again:
  // the stock move is guarded by stock_decreased, but there is no reason to
  // restamp drafted_at because someone pressed the button twice.
  if (order.is_draft === value.is_draft)
    return httpResponse(
      res,
      200,
      value.is_draft ? "Order is already a draft" : "Order is not a draft",
      { is_draft: order.is_draft },
    );

  await doTransition(async (client) => {
    if (value.is_draft) {
      // PENDING is the "nobody is holding this stock" side of manageStock, and
      // it only gives anything back when the order had actually taken it.
      await manageStock({
        order_status: ORDER_PENDING,
        orderid: orderId,
        client,
      });

      await client.query(
        `
         UPDATE orders
         SET is_draft = true,
             drafted_at = CURRENT_TIMESTAMP,
             drafted_by = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE order_id = $1
        `,
        [orderId, req.token_info?.id ?? null],
      );
    } else {
      await client.query(
        `
         UPDATE orders
         SET is_draft = false,
             drafted_at = NULL,
             drafted_by = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE order_id = $1
        `,
        [orderId],
      );

      // Back to fulfilment: whatever status it kept decides whether it owns
      // stock again. A restored PENDING order takes nothing, exactly as a
      // freshly placed one does.
      await manageStock({
        order_status: order.order_status ?? ORDER_PENDING,
        orderid: orderId,
        client,
      });
    }
  });

  // Quantities moved, and they are part of a product's cached response. After
  // the commit, for the same reason updateOrderStatus does it there.
  await invalidateCache(CACHE_TAGS.PRODUCTS);

  httpResponse(
    res,
    200,
    value.is_draft
      ? "Order moved to draft. It is hidden from the customer and left out of the dashboard."
      : "Order restored from draft.",
    { is_draft: value.is_draft },
  );
});

//this endpoint for user only
export const doReturn = asyncErrorHandler(async (req: CustomRequest, res) => {
  const value = doValidate<{
    order_id: string;
    type: "Return" | "Replace";
  }>(VReturnOrder, req.body ?? {});

  const orderNumber = value.order_id;

  const tokenInfo = req.token_info;
  if (!tokenInfo) throw new ErrorHandler(401, "Unauthorized");

  // A Replace keeps its own status on the order so the CMS can tell the two
  // apart, but both move the items into the return flow — the goods come back
  // either way, and only the order row decides what is sent out afterwards.
  const orderStatus =
    value.type === "Return" ? ORDER_RETURN_INITIATED : REPLACE_INITIATED;

  // Claim the order first, in its own transaction: the courier is only told to
  // collect once the order is definitely ours to return. Booking the pickup
  // inside the transaction would hold the row lock across a network call, and
  // a later failure would roll the status back while the courier still had a
  // live pickup nobody had a record of.
  let dbOrderId = 0;

  await doTransition(async (client) => {
    // Returns are for delivered orders only, inside the RETURN_WINDOW_DAYS
    // window measured from the delivery itself — the same number the delivered
    // email quotes at the customer — and a refundable Return needs an online payment
    // to refund to. A Replace has no refund, so COD can be replaced too.
    const orderInfo = await client.query(
      `
        UPDATE orders o
        SET order_status = $1
        WHERE o.order_number = $2
          AND o.user_id = $4
          AND o.order_status = '${ORDER_DELIVERED}'
          AND (
            ($3 = 'Return' AND o.payment_method = '${ONLINE_PAYMENT}')
            OR ($3 = 'Replace')
          )
          AND o.delivered_at IS NOT NULL
          AND o.delivered_at >= NOW() - INTERVAL '${RETURN_WINDOW_DAYS} days'
        RETURNING o.order_id;
      `,
      [orderStatus, orderNumber, value.type, tokenInfo.id],
    );

    if (orderInfo.rowCount === 0)
      throw new ErrorHandler(400, "Unable to process your request");

    dbOrderId = orderInfo.rows[0].order_id;

    await client.query(
      "UPDATE order_items SET status = $1 WHERE order_id = $2",
      [ORDER_RETURN_INITIATED, dbOrderId],
    );
  });

  // Tell the courier to come and collect. The partner reads the order itself
  // and writes the order_returns row, with or without a waybill — the status is
  // already committed, so a courier failure cannot be undone by throwing, and
  // the request has to stay on file either way for support to book by hand.
  const partner = getShippingPartner();

  const reverse =
    value.type === "Return"
      ? await partner.returnShippingOrder(dbOrderId)
      : await partner.replaceShippingOrder(dbOrderId);

  // With no partner configured the claim is recorded and no courier is called,
  // which is the intended outcome rather than a failure worth paging anyone
  // about — see NonePartner. A real partner refusing the pickup still is.
  if (!reverse.created && isShippingEnabled()) {
    logger.error({
      message: "Return pickup booking failed (order already in return flow)",
      partner: partner.name,
      orderNumber,
      dbOrderId,
      type: value.type,
      skipped: reverse.skipped,
      error: reverse.error,
    });
  }

  // The customer is told their return is accepted either way; the pickup flag
  // is what the CMS uses to show support that a courier still has to be booked.
  httpResponse(res, 200, "Return Successfully Initiated", {
    pickup_booked: reverse.created,
    waybill: reverse.waybill ?? null,
  });
});

/**
 * Books the replacement parcel for a Replace, once the returned goods are back
 * at the warehouse. Admin only, and deliberately a separate call from the
 * return itself: nothing goes out against a collection that never arrived.
 *
 * It is a second forward shipment against the same order, so it is stored on
 * the order_returns row rather than on the order — see the partner's
 * replacement leg.
 */
export const bookReplacementShipment = asyncErrorHandler(async (req, res) => {
  const orderId = parseInt(String(req.params.orderid ?? ""), 10);
  if (!orderId) throw new ErrorHandler(400, "Invalid order id");

  const { rows, rowCount } = await pool.query(
    "SELECT order_status FROM orders WHERE order_id = $1",
    [orderId],
  );

  if (rowCount === 0) throw new ErrorHandler(404, "Order information not found!");

  // REPLACE INITIATED is where doReturn leaves the order; RETURNED is where a
  // courier scan moves it once the collection is delivered back to us. Anything
  // else is not a replacement waiting to be sent.
  const status = rows[0].order_status;
  if (status !== REPLACE_INITIATED && status !== ORDER_RETURNED) {
    throw new ErrorHandler(
      400,
      "This order has no replacement to send. Only an order in the replace flow can be re-shipped.",
    );
  }

  // Nothing to book, and nothing the admin can do to make it work — say so
  // plainly rather than handing back a courier-shaped failure.
  if (!isShippingEnabled()) {
    throw new ErrorHandler(
      400,
      "No shipping partner is configured, so there is no replacement parcel to book here. Send it with your own courier and mark the order delivered.",
    );
  }

  const partner = getShippingPartner();
  const shipment = await partner.createShippingOrder(orderId, {
    leg: "replacement",
  });

  if (!shipment.created) {
    const REASON_MESSAGE: Partial<Record<ShipmentSkipReason, string>> = {
      already_created:
        "The replacement parcel is already booked with the courier.",
      no_return_record:
        "No replacement was ever requested for this order, so there is nothing to send.",
      no_shipment_boxes:
        "Add the shipment box dimensions before booking the replacement.",
      no_shipping_address: "This order has no shipping address.",
      not_supported: `${partner.label} cannot book a replacement parcel. Book it in the courier panel by hand.`,
    };

    logger.error({
      message: "Replacement booking failed",
      partner: partner.name,
      orderId,
      skipped: shipment.skipped,
      error: shipment.error,
    });

    throw new ErrorHandler(
      400,
      (shipment.skipped && REASON_MESSAGE[shipment.skipped]) ??
        `The ${partner.label} replacement could not be booked. Try again.`,
    );
  }

  // The replacement is with the courier, so the order has been made good.
  await doTransition(async (client) => {
    await client.query(
      "UPDATE orders SET order_status = $1, updated_at = CURRENT_TIMESTAMP WHERE order_id = $2",
      [REPLACED, orderId],
    );
    await client.query(
      "UPDATE order_items SET status = $1 WHERE order_id = $2",
      [REPLACED, orderId],
    );
  });

  httpResponse(res, 200, "Replacement shipment booked", {
    shipping_partner: partner.name,
    waybill: shipment.waybill ?? null,
    courier_name: shipment.courierName ?? null,
    partner_order_id: shipment.partnerOrderId ?? null,
  });
});

/**
 * Cancel one order on behalf of the customer who owns it.
 *
 * Takes a user id rather than a request, because two routes reach it: the
 * account one, where the id comes from the session, and the guest one, where
 * it comes from the guest order token. Ownership is still enforced in the
 * UPDATE itself — the caller proves who they are, this decides what that lets
 * them touch — so neither route can widen it by passing the wrong thing.
 */
const cancelCustomerOrder = async (orderNumber: string, userId: number) => {
  let shipmentWaybill: string | null = null;
  let partnerOrderId: string | null = null;

  await doTransition(async (client) => {
    const { rowCount, rows } = await client.query(
      `
      UPDATE orders
        SET order_status = $1
      -- Only a PENDING order can be cancelled. Once it is confirmed the
      -- shipment is booked with the courier, so cancelling is a support job,
      -- not something the customer can do from their account.
      WHERE order_number = $2
        AND user_id = $3
        AND order_status = '${ORDER_PENDING}'
      RETURNING order_id, waybill, partner_order_id
      `,
      [ORDER_CANCELLED, orderNumber, userId],
    );

    // Deliberately the same message whether the order is not cancellable or
    // belongs to someone else — telling them apart would confirm that an order
    // number exists on another account.
    if (rowCount === 0)
      throw new ErrorHandler(
        400,
        "This order can no longer be cancelled. Only orders that are still pending can be cancelled.",
      );

    const dbOrderId = rows[0].order_id;
    shipmentWaybill = rows[0].waybill ?? null;
    partnerOrderId = rows[0].partner_order_id ?? null;

    await client.query(
      "UPDATE order_items SET status = $1 WHERE order_id = $2",
      [ORDER_CANCELLED, dbOrderId],
    );
  });

  // Cancel with the shipping partner if the shipment was already created. The
  // order is already cancelled in our DB at this point, so a courier-side
  // failure is logged rather than thrown — the customer has been told their
  // order is cancelled and that must not be taken back.
  if (isShippingEnabled() && (shipmentWaybill || partnerOrderId)) {
    const cancelResponse = await getShippingPartner().cancelShippingOrder({
      waybill: shipmentWaybill,
      partnerOrderId,
    });

    if (!cancelResponse.success) {
      logger.error({
        message: "Courier cancel failed (order already cancelled in DB)",
        partner: getShippingPartner().name,
        waybill: shipmentWaybill,
        partnerOrderId,
        error: cancelResponse.error ?? cancelResponse.message,
      });
    }
  }
};

//this endpoint for user only
export const doCancel = asyncErrorHandler(async (req: CustomRequest, res) => {
  const value = doValidate<{
    order_id?: string;
    order_item_id?: number;
  }>(VCancelOrder, req.body ?? {});

  const tokenInfo = req.token_info;
  if (!tokenInfo) throw new ErrorHandler(401, "Unauthorized");

  // The route is only authenticated, not authorised — without this an order
  // number from someone else's account would cancel their order.
  if (!value.order_id) {
    throw new ErrorHandler(400, "An order number is required to cancel an order.");
  }

  await cancelCustomerOrder(value.order_id, tokenInfo.id);

  httpResponse(res, 200, "Order successfully cancelled");
});

/* -------------------------------------------------------------------------- */
/*                                Guest orders                                */
/* -------------------------------------------------------------------------- */

/**
 * The one order a guest order token names.
 *
 * The token is the whole authorisation: it was signed by this api when the
 * order was placed and it carries the order id, so there is nothing for the
 * caller to supply and therefore nothing to enumerate. The order id in the
 * token is checked against the row's own user_id as well, so a token whose
 * order has since been moved to another account stops working rather than
 * quietly following it.
 */
export const getGuestOrder = asyncErrorHandler(async (req, res) => {
  const grant = await requireGuestOrderToken(req);

  const order = await fetchCustomerOrderById(grant.order_id);

  if (!order || order.order_number !== grant.order_number) {
    throw new ErrorHandler(404, "We could not find this order");
  }

  httpResponse(res, 200, "Order details", order);
});

/** Cancel the order a guest order token names, on the same rules as an account. */
export const cancelGuestOrder = asyncErrorHandler(async (req, res) => {
  const grant = await requireGuestOrderToken(req);

  await cancelCustomerOrder(grant.order_number, grant.user_id);

  httpResponse(res, 200, "Order successfully cancelled");
});

// Attaches an invoice supplied by the admin to an order. Once one is on file
// it is what the customer downloads, so the app stops generating its own.
export const uploadOrderInvoice = asyncErrorHandler(async (req, res) => {
  const orderId = parseInt(String(req.params.orderid ?? ""), 10);
  if (!orderId) throw new ErrorHandler(400, "Invalid order id");

  const value = doValidate<{ invoice_document: string }>(
    VUploadOrderInvoice,
    req.body ?? {},
  );

  const { rowCount } = await pool.query(
    "UPDATE orders SET invoice_document = $1, updated_at = CURRENT_TIMESTAMP WHERE order_id = $2",
    [value.invoice_document, orderId],
  );

  if (rowCount === 0) throw new ErrorHandler(404, "Order information not found!");

  httpResponse(res, 200, "Invoice uploaded");
});

// Drops the uploaded invoice, which puts the generated one back in play.
export const deleteOrderInvoice = asyncErrorHandler(async (req, res) => {
  const orderId = parseInt(String(req.params.orderid ?? ""), 10);
  if (!orderId) throw new ErrorHandler(400, "Invalid order id");

  const { rowCount } = await pool.query(
    "UPDATE orders SET invoice_document = NULL, updated_at = CURRENT_TIMESTAMP WHERE order_id = $1",
    [orderId],
  );

  if (rowCount === 0) throw new ErrorHandler(404, "Order information not found!");

  httpResponse(res, 200, "Uploaded invoice removed");
});

interface IOrderInvoiceFile {
  content: Buffer;
  filename: string;
  contentType: string;
}

/**
 * The order's invoice as bytes, plus the order details an invoice is described
 * by. `file` is null when the order has no invoice of either kind.
 *
 * An invoice an admin uploaded by hand wins over a generated one: the admin
 * uploaded it knowing a generated one was a click away, so it is the one they
 * mean the customer to have. An order with neither has no invoice at all; what
 * it has is a payment slip, served by downloadPaymentSlip.
 *
 * Shared by the download route and the email-it-to-the-customer route so the
 * two can never disagree about which document is *the* invoice.
 */
const loadOrderInvoice = async (orderId: number | string) => {
  const order = await pool.query(
    `SELECT
       o.order_number,
       o.invoice_number,
       o.invoice_document,
       o.invoice_pdf_url,
       o.total_amount,
       TO_CHAR(o.created_at, 'DD Mon YYYY') AS order_date,
       COALESCE(o.shipping_address, '{}'::jsonb) AS shipping_details,
       u.name AS account_name,
       u.email AS account_email
     FROM orders o
     LEFT JOIN users u ON u.id = o.user_id
     WHERE o.order_id = $1`,
    [orderId],
  );

  if (order.rowCount == 0)
    throw new ErrorHandler(404, "Order information not found!");

  const row = order.rows[0];
  const { order_number, invoice_number, invoice_document, invoice_pdf_url } =
    row;

  let file: IOrderInvoiceFile | null = null;

  if (invoice_document) {
    const [header, base64] = (invoice_document as string).split(",");
    const mime = header.match(/^data:([^;]+);base64$/)?.[1];

    if (!base64 || !mime) {
      throw new ErrorHandler(
        500,
        "The uploaded invoice for this order is unreadable",
      );
    }

    const extension = mime === "application/pdf" ? "pdf" : "jpg";

    file = {
      content: Buffer.from(base64, "base64"),
      filename: `invoice-${order_number}.${extension}`,
      contentType: mime,
    };
  } else if (invoice_pdf_url) {
    // the file itself is private on the upload server, so it is read with the
    // api's token and streamed on rather than linked to
    file = {
      content: await fetchOrderDocument(invoice_pdf_url),
      filename: `invoice-${invoice_number ?? order_number}.pdf`,
      contentType: "application/pdf",
    };
  }

  return { order: row, file };
};

// Serves the order's invoice, whatever the order status is.
export const downloadInvoice = asyncErrorHandler(async (req, res) => {
  const orderid = req.params.orderid;
  if (!orderid) throw new ErrorHandler(400, "Invalid request");

  const { file } = await loadOrderInvoice(String(orderid));

  if (!file) throw new ErrorHandler(404, "No invoice is available for this order");

  res.setHeader("Content-Type", file.contentType);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${file.filename}"`,
  );

  return res.send(file.content);
});

/**
 * Emails the invoice to the customer, with the PDF attached rather than linked.
 *
 * Attached, because the download route is public — rate limited, but open to
 * anyone holding the order id — so a link mailed out is a link that can be
 * forwarded and walked. The attachment travels with the email and needs no
 * endpoint at all.
 *
 * Admin action, and a deliberate one: nothing sends this automatically, because
 * an invoice is the document a customer keeps and a shop that emails three
 * corrected copies looks like a shop that cannot count.
 */
export const emailOrderInvoice = asyncErrorHandler(async (req, res) => {
  const orderId = readOrderId(req);

  const { order, file } = await loadOrderInvoice(orderId);

  if (!file)
    throw new ErrorHandler(
      404,
      "This order has no invoice yet — generate or upload one first",
    );

  // The address snapshot taken at checkout first, the account second — the same
  // order the confirmation email uses. A guest order has only the snapshot.
  const shipping = order.shipping_details ?? {};
  const recipient = String(shipping.email ?? order.account_email ?? "").trim();

  if (!recipient)
    throw new ErrorHandler(
      422,
      "This order has no email address to send the invoice to",
    );

  // An admin pressing the button on a server with EMAIL_PROVIDER=none would
  // otherwise be told the invoice was emailed, because the none provider
  // reports success by design.
  if (!isEmailEnabled())
    throw new ErrorHandler(
      503,
      "Email is switched off on this server, so the invoice was not sent",
    );

  const sent = await sendEmail(
    recipient,
    "SEND_INVOICE",
    {
      customerName: shipping.name ?? order.account_name ?? "Customer",
      orderId: order.order_number,
      invoiceNumber: order.invoice_number,
      orderDate: order.order_date,
      totalAmount: order.total_amount,
    },
    [file],
  );

  // Unlike every other send in this codebase an admin is standing in front of
  // this one, so the failure is theirs to see rather than the log's to keep.
  if (!sent.ok)
    throw new ErrorHandler(
      502,
      "The invoice email could not be sent, please try again",
    );

  httpResponse(res, 200, `Invoice emailed to ${recipient}`, {
    sent_to: recipient,
    invoice_number: order.invoice_number,
  });
});

// ============================================================
// GENERATED DOCUMENTS — invoice and packing slip
//
// Both are rendered by the api from the order record, pushed to the upload
// server's private area, and referenced from the order row by path. Generating
// is an admin action and is always a fresh render, so an admin who fixed an
// address can press the button again and get a document that says so.
// ============================================================

const readOrderId = (req: { params: Record<string, any> }) => {
  const orderId = parseInt(String(req.params.orderid ?? ""), 10);
  if (!orderId) throw new ErrorHandler(400, "Invalid order id");
  return orderId;
};

export const generateOrderInvoice = asyncErrorHandler(async (req, res) => {
  const orderId = readOrderId(req);

  let invoiceNumber = "";
  let supersededUrl: string | null = null;
  let storedUrl = "";

  await doTransition(async (client) => {
    // FOR UPDATE, so two admins pressing the button at the same moment cannot
    // draw two invoice numbers for one order.
    const existing = await client.query(
      `SELECT invoice_number, invoice_generated_at, invoice_pdf_url
       FROM orders WHERE order_id = $1 FOR UPDATE`,
      [orderId],
    );

    if (existing.rowCount === 0)
      throw new ErrorHandler(404, "Order information not found!");

    const row = existing.rows[0];
    supersededUrl = row.invoice_pdf_url ?? null;

    // The number and the date are allotted once and then kept. A customer
    // holding INV-100023 dated the 4th must not be sent a corrected document
    // that calls itself something else, or claims to have been issued later.
    if (row.invoice_number) {
      invoiceNumber = row.invoice_number;
    } else {
      const allotted = await client.query(
        "SELECT 'INV-' || nextval('invoice_number_seq') AS invoice_number",
      );
      invoiceNumber = allotted.rows[0].invoice_number;
    }

    const invoiceDate = row.invoice_generated_at
      ? new Date(row.invoice_generated_at)
      : new Date();

    const data = await getOrderDocumentData(orderId, client);
    const pdf = await renderInvoicePdf(data, invoiceNumber, invoiceDate);

    storedUrl = await uploadOrderDocument(pdf, `invoice-${invoiceNumber}.pdf`);

    await client.query(
      `UPDATE orders
       SET invoice_number = $1,
           invoice_pdf_url = $2,
           invoice_generated_at = COALESCE(invoice_generated_at, $3),
           updated_at = CURRENT_TIMESTAMP
       WHERE order_id = $4`,
      [invoiceNumber, storedUrl, invoiceDate, orderId],
    );
  });

  // Only once the new path is committed, and never in a way that can fail the
  // request — see deleteOrderDocument.
  if (supersededUrl && supersededUrl !== storedUrl)
    await deleteOrderDocument(supersededUrl);

  httpResponse(res, 200, "Invoice generated", {
    invoice_number: invoiceNumber,
    invoice_url: `${process.env.API_BASE_URL}/api/v1/orders/invoice/${orderId}`,
  });
});

export const generateOrderPackingSlip = asyncErrorHandler(async (req, res) => {
  const orderId = readOrderId(req);

  let supersededUrl: string | null = null;
  let storedUrl = "";

  await doTransition(async (client) => {
    const existing = await client.query(
      "SELECT order_number, packing_slip_url FROM orders WHERE order_id = $1 FOR UPDATE",
      [orderId],
    );

    if (existing.rowCount === 0)
      throw new ErrorHandler(404, "Order information not found!");

    supersededUrl = existing.rows[0].packing_slip_url ?? null;

    const data = await getOrderDocumentData(orderId, client);
    const pdf = await renderPackingSlipPdf(data);

    storedUrl = await uploadOrderDocument(
      pdf,
      `packing-slip-${data.orderNumber}.pdf`,
    );

    await client.query(
      `UPDATE orders
       SET packing_slip_url = $1,
           packing_slip_generated_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE order_id = $2`,
      [storedUrl, orderId],
    );
  });

  if (supersededUrl && supersededUrl !== storedUrl)
    await deleteOrderDocument(supersededUrl);

  httpResponse(res, 200, "Packing slip generated", {
    packing_slip_url: `${process.env.API_BASE_URL}/api/v1/orders/${orderId}/packing-slip`,
  });
});

// The packing slip is warehouse paperwork, so unlike the invoice it is served
// to staff only — the route is behind the admin guard.
export const downloadPackingSlip = asyncErrorHandler(async (req, res) => {
  const orderId = readOrderId(req);

  const order = await pool.query(
    "SELECT order_number, packing_slip_url FROM orders WHERE order_id = $1",
    [orderId],
  );

  if (order.rowCount === 0)
    throw new ErrorHandler(404, "Order information not found!");

  const { order_number, packing_slip_url } = order.rows[0];

  if (!packing_slip_url)
    throw new ErrorHandler(
      404,
      "No packing slip has been generated for this order",
    );

  const pdf = await fetchOrderDocument(packing_slip_url);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="packing-slip-${order_number}.pdf"`,
  );
  return res.send(pdf);
});

/**
 * The payment slip — the receipt for money received against an order.
 *
 * Served to anyone holding the order id, as it always has been: it is the
 * document the customer is sent to from the payment result page and from their
 * order history, neither of which carries an admin session.
 *
 * A paid order is served its stored slip, generated the moment the payment
 * landed. An order paid before this existed, or whose generate failed at the
 * time, is generated here on its first download and kept, so the next one is a
 * straight read.
 *
 * An unpaid order still gets a slip, rendered on the spot and stored nowhere:
 * no receipt number, no paid stamp, and it says in words that it is not a
 * receipt.
 */
export const downloadPaymentSlip = asyncErrorHandler(async (req, res) => {
  const orderId = readOrderId(req);

  const order = await pool.query(
    `SELECT order_number, payment_status, receipt_number, payment_slip_url
       FROM orders
      WHERE order_id = $1`,
    [orderId],
  );

  if (order.rowCount === 0)
    throw new ErrorHandler(404, "Order information not found!");

  const row = order.rows[0];

  let pdf: Buffer;
  let documentName = row.receipt_number ?? row.order_number;

  if (row.payment_status === "PAID") {
    const slip = row.payment_slip_url
      ? { storedUrl: row.payment_slip_url, receiptNumber: row.receipt_number }
      : await generatePaymentSlip(orderId);

    if (slip) {
      documentName = slip.receiptNumber ?? documentName;

      // A stored slip whose file has gone missing is regenerated rather than
      // refused: the order is paid, so the document is owed either way.
      pdf = await fetchOrderDocument(slip.storedUrl).catch(async (error) => {
        logger.warn("Stored payment slip could not be read, regenerating", {
          order_id: orderId,
          error: error instanceof Error ? error.message : error,
        });

        const regenerated = await generatePaymentSlip(orderId, { force: true });

        return regenerated
          ? fetchOrderDocument(regenerated.storedUrl)
          : renderUnstoredPaymentSlip(orderId);
      });
    } else {
      // Paid a moment ago and the storage server is refusing uploads. The
      // customer still gets their receipt; only the stored copy is missing.
      pdf = await renderUnstoredPaymentSlip(orderId);
    }
  } else {
    pdf = await renderUnstoredPaymentSlip(orderId);
  }

  res.setHeader("Content-Type", "application/pdf");
  // inline: this opens from a "view your receipt" link far more often than it is
  // filed away, and a browser that wants to save it still can.
  res.setHeader(
    "Content-Disposition",
    `inline; filename="payment-slip-${documentName}.pdf"`,
  );
  return res.send(pdf);
});

/**
 * Regenerate, for an admin who has corrected something the slip prints.
 *
 * The receipt number and date are kept — only the document is rebuilt, and the
 * superseded file is dropped once the new one is safely stored.
 */
export const generateOrderPaymentSlip = asyncErrorHandler(async (req, res) => {
  const orderId = readOrderId(req);

  const slip = await generatePaymentSlip(orderId, { force: true });

  if (!slip)
    throw new ErrorHandler(
      400,
      "This order has not been paid, so it has no receipt to generate",
    );

  httpResponse(res, 200, "Payment slip generated", {
    receipt_number: slip.receiptNumber,
    payment_slip_url: `${process.env.API_BASE_URL}/api/v1/orders/payment-slip/${orderId}`,
  });
});

interface ITrack {
  order_number: string;
  order_id: number;
  created_at: string;
  tracks: {
    status: string;
    status_type: string;
    time: string;
    location: string;
  }[];
}
// ============================================================
// HELPER — pull the latest tracking data from the active shipping
// partner and backfill webhook_data.
//
// Shiprocket does push a tracking webhook, but only for accounts that have one
// registered, and it can be missed. Pulling on read keeps the tracking page
// correct either way; the pull and the webhook write the same normalized rows,
// and the pull replaces the AWB's rows wholesale so a replay cannot duplicate.
// ============================================================
// Pulls one waybill's scans and replaces whatever webhook_data holds for it.
// Wholesale replacement, not an append, so pulling the same waybill twice
// cannot duplicate a scan.
async function pullShipmentScans(waybill: string) {
  const partner = getShippingPartner();

  const result = await partner.trackShipment(waybill);
  if (!result.success || !result.trackingData) return [];

  const events = partner.normalizeTrackingHistory(result.trackingData, waybill);
  if (events.length === 0) return [];

  await pool.query("DELETE FROM webhook_data WHERE waybill = $1", [waybill]);

  for (const event of events) {
    await pool.query(
      "INSERT INTO webhook_data (waybill, payload) VALUES ($1, $2)",
      [waybill, event],
    );
  }

  return events;
}

async function syncShipmentTracking(orderNumber: string) {
  // No partner means no waybill was ever written, so there is nothing to pull
  // and the tracking page falls back to the order's own status history.
  if (!isShippingEnabled()) return;

  try {
    const { rows, rowCount } = await pool.query(
      `
      SELECT
        o.waybill,
        r.waybill AS return_waybill,
        r.replacement_waybill
      FROM orders o
      LEFT JOIN order_returns r ON r.order_id = o.order_id
      WHERE o.order_number = $1
      ORDER BY r.id DESC
      LIMIT 1
      `,
      [orderNumber],
    );

    if (rowCount === 0) return;

    const { waybill, return_waybill, replacement_waybill } = rows[0];

    // The reverse legs only add scans to the tracking page. An order with a
    // return or a replacement in flight is in a COURIER_PROTECTED_STATUS, so
    // nothing they report is allowed to move its status anyway.
    for (const reverseWaybill of [return_waybill, replacement_waybill]) {
      if (reverseWaybill) await pullShipmentScans(reverseWaybill);
    }

    if (!waybill) return;

    // Set inside the transaction, emailed after it commits — see the webhook
    // service for the same pattern.
    let movedOrderId: number | null = null;

    const events = await pullShipmentScans(waybill);
    if (events.length === 0) return;

    // Latest event drives the order's actual status, same as a webhook push would
    const latestEvent = events[events.length - 1];
    const STATUS =
      SHIPMENT_MAPING[
        `${latestEvent.Shipment.Status.StatusType}_${latestEvent.Shipment.Status.Status}`
      ];

    if (!STATUS) return;

    await doTransition(async (client) => {
      const orderLookup = await client.query(
        "SELECT order_id, order_status FROM orders WHERE waybill = $1",
        [waybill],
      );

      if (orderLookup.rowCount === 0) return;

      const orderId = orderLookup.rows[0].order_id;

      // A cancelled or returned order keeps its forward-leg scans, and the
      // newest of those is usually "Delivered" — writing it back would undo
      // the cancellation or the return.
      if (COURIER_PROTECTED_STATUSES.includes(orderLookup.rows[0].order_status)) {
        return;
      }

      movedOrderId = orderId;

      await manageStock({ order_status: STATUS, orderid: orderId, client });

      await client.query(
        `
         UPDATE orders
         SET order_status = $1::varchar,
             delivered_at = CASE
               WHEN $1::varchar = '${ORDER_DELIVERED}' AND delivered_at IS NULL
               THEN CURRENT_TIMESTAMP
               ELSE delivered_at
             END,
             updated_at = CURRENT_TIMESTAMP
         WHERE order_id = $2
        `,
        [STATUS, orderId],
      );

      await client.query(
        "UPDATE order_items SET status = $1 WHERE order_id = $2",
        [STATUS, orderId],
      );
    });

    // see the note in updateOrderStatus : after the commit, never inside it
    await invalidateCache(CACHE_TAGS.PRODUCTS);

    // This function runs from the customer's own tracking page, so it re-writes
    // the same status every time they open it. order_email_log is the only
    // reason that is one email and not one per refresh.
    if (movedOrderId) await notifyOrderStatus(movedOrderId, STATUS);
  } catch (err) {
    logger.error({
      message: "syncShipmentTracking failed",
      partner: getShippingPartner().name,
      orderNumber,
      error: err,
    });
  }
}

export const trackOrder = asyncErrorHandler(async (req, res) => {
  // track order
  const value = doValidate<{ order_number: string }>(
    VTrackOrder,
    req.query ?? {},
  );

  await syncShipmentTracking(value.order_number);

  const { rows, rowCount } = await pool.query<ITrack>(
    `
     SELECT
        o.order_number,
        o.order_id,
        TO_CHAR(o.created_at AT TIME ZONE 'Asia/Kolkata', 'DD FMMonth YYYY HH12:MIam') AS created_at,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'status', wd.payload->'Shipment'->'Status'->>'Status',
              'status_type', wd.payload->'Shipment'->'Status'->>'StatusType',
              'instructions', wd.payload->'Shipment'->'Status'->>'Instructions',
              'time',
                TO_CHAR(
                  ((wd.payload->'Shipment'->'Status'->>'StatusDateTime')::timestamp AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata',
                  'DD FMMonth YYYY HH12:MIam'
                ),
              'location', wd.payload->'Shipment'->'Status'->>'StatusLocation'
            )
          ) FILTER (WHERE wd.id IS NOT NULL), '[]'::json
        ) AS tracks
      FROM orders o

      LEFT JOIN order_returns r 
        ON r.order_id = o.order_id

      LEFT JOIN webhook_data AS wd 
        ON wd.waybill = o.waybill
        OR wd.waybill = r.waybill
        OR wd.waybill = r.replacement_waybill

      -- A parked order is not out there being delivered, so tracking it says
      -- nothing rather than showing stale scans.
      WHERE o.order_number = $1
        AND COALESCE(o.is_draft, false) = false
      GROUP BY o.order_id;
    `,
    [value.order_number],
  );

  if (rowCount == 0)
    throw new ErrorHandler(400, "Unable to find the order track info");

  const modifiedTracks: {
    status: string;
    time: string;
    location: string;
    completed: true;
  }[] = [];

  let trackToReturn: {
    key: string;
    status: string;
    date: string | null;
    completed: boolean;
    location: string | null;
  }[] = [
    {
      key: "PENDING",
      status: "ORDER PLACED",
      date: rows[0].created_at,
      completed: true,
      location: null,
    },
    {
      key: "CONFIRMED",
      status: "ORDER CONFIRMED",
      date: null,
      completed: false,
      location: null,
    },
    {
      key: "SHIPPED",
      status: "SHIPPED",
      date: null,
      completed: false,
      location: null,
    },
    {
      key: "OUT FOR DELIVERY",
      status: "OUT FOR DELIVERY",
      date: null,
      completed: false,
      location: null,
    },
    {
      key: "DELIVERED",
      status: "DELIVERED",
      date: null,
      completed: false,
      location: null,
    },
  ];

  const map = new Map<string, boolean>();
  for (let i = 0; i < rows[0].tracks.length; i++) {
    const track = rows[0].tracks[i];

    const key = `${track.status_type}_${track.status}`;

    if (!map.has(key)) {
      const shipmentValue = SHIPMENT_MAPING[key];
      modifiedTracks.push({
        location: track.location,
        status: shipmentValue,
        time: track.time,
        completed: true,
      });
      map.set(key, true);
    }
  }

  modifiedTracks.forEach((pItem) => {
    const i = trackToReturn.findIndex((item) => item.key == pItem.status);
    if (i !== -1) {
      // need to update that index
      trackToReturn[i].completed = true;
      trackToReturn[i].date = pItem.time;
      trackToReturn[i].location = pItem.location;
    } else {
      const indexIsNotTrue = trackToReturn.findIndex(
        (item) => item.completed == false,
      );

      if (indexIsNotTrue !== -1) {
        const newArray = [
          ...trackToReturn.slice(0, indexIsNotTrue),
          {
            key: pItem.status,
            status: pItem.status,
            date: pItem.time,
            completed: true,
            location: pItem.location,
          },
          ...trackToReturn.slice(indexIsNotTrue, trackToReturn.length),
        ];
        trackToReturn = newArray;
      } else {
        trackToReturn.push({
          status: pItem.status,
          completed: pItem.completed,
          date: pItem.time,
          location: pItem.location,
          key: pItem.status,
        });
      }
    }
  });

  httpResponse(res, 200, "Order track list", trackToReturn);
});
