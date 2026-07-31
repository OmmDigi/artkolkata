import { pool } from "..";
import {
  ONLINE_PAYMENT,
  ORDER_CANCELLED,
  ORDER_CONFIRMED,
  ORDER_DELIVERED,
  ORDER_PENDING,
  ORDER_RETURN_INITIATED,
  ORDER_SHIPPED,
  REPLACE_INITIATED,
  SHIPMENT_MAPING,
} from "../constant";
import { fetchSettingsFromDb } from "./settings.controller";
import { v4 as uuidv4 } from "uuid";
import asyncErrorHandler from "../middleware/asyncErrorHandler";
import { CustomRequest, IShippingAddress, ITokenInfo } from "../types";
import { calcluteCartAmounts } from "../utils/calcluteCartAmounts";
import { doTransition } from "../utils/doTransition";
import { doValidate } from "../utils/doValidate";
import { ErrorHandler } from "../utils/ErrorHandler";
import { generateOrderNumber } from "../utils/generateOrderNumber";
import { generatePlaceholders } from "../utils/generatePlaceholders";
// import { generateRandomTextPrefix } from "../utils/generateRandomTextPrefix";
import { httpResponse } from "../utils/httpResponse";
import { manageStock } from "../utils/manageStock";
import { parsePagination } from "../utils/parsePagination";
// import { sendEmail } from "../utils/sendEmail";
import {
  VCancelOrder,
  VCreateOrder,
  VGetPriceBreakdown,
  VReturnOrder,
  VTrackOrder,
  VUpdateOrderStatus,
} from "../validator/order.validator";
import DelhiveryService from "../services/delhiveryService";
import BigshipService, { BigshipOrderItem } from "../services/bigshipService";
import {
  aggregateShipmentDimensions,
  IShipmentDimensionInput,
} from "../utils/aggregateShipmentDimensions";
import { createPaymentGatewayOrder } from "../services/payment.service";
import logger from "../utils/logger";

export const createOrder = asyncErrorHandler(
  async (req: CustomRequest, res) => {
    // first check is the user is logged in or not
    // if not loggeding and email already registered than throw error that email is already in used
    // if not loggeding and email not exist than registered the user first using the email phone number and other things place the order
    // if loggedin than update the address info and place the order

    const value = doValidate<{
      shippingDetails: IShippingAddress;
      paymentMethod: "ONLINE" | "COD";
      product: {
        code?: string;
        product_ids: { id: number; quantity: number }[];
        varient_ids: { id: number; quantity: number }[];
      };
    }>(VCreateOrder, req.body ?? {});

    let bigshipShippingCharge = 0;
    let paymentMethodOrderId: string | null = null;
    let totalFinalAmount = 0;
    let paymentPageUrl: string | null = null;

    // Captured inside transaction for post-transaction Bigship order creation
    let capturedOrderId: number;
    let capturedOrderNumber: string;
    let capturedSubTotal: number;
    let capturedProductsInfo: any[] = [];
    let capturedVarientsInfo: any[] = [];

    await doTransition(async (client) => {
      let tokenInfo: ITokenInfo | null = null;

      // let guestUserInfo: null | any = null;
      // if (!req.token_info) {
      //   // mean user is not logged in. mean i need to create a new user with the shiping info

      //   //create the new user
      //   const passwordStr = generateRandomTextPrefix();
      //   const encryptPassword = encrypt(passwordStr);
      //   const { rowCount, rows } = await client.query(
      //     `
      //       INSERT INTO users
      //           (name, email, phone_no, password, is_verified, role)
      //       VALUES
      //           ($1, $2, $3, $4, 'true', 'User')
      //       ON CONFLICT (email) DO NOTHING
      //       RETURNING id, role
      //       `,
      //     [
      //       value.shippingDetails.fullName,
      //       value.shippingDetails.email,
      //       value.shippingDetails.phone,
      //       encryptPassword,
      //     ],
      //   );

      //   // now check if the email is already exist or not if exist tell user you already have an account login with that account
      //   if (rowCount === 0)
      //     throw new ErrorHandler(401, "Login your account first");

      //   guestUserInfo = {
      //     email: value.shippingDetails.email,
      //     password: passwordStr,
      //     loginUrl: `${process.env.FRONTEND_HOST_URL}/authenteaction`,
      //   };

      //   // send the password to the regiesterd email
      //   tokenInfo = {
      //     id: rows[0].id,
      //     role: rows[0].role,
      //   };
      // } else {
      //   tokenInfo = req.token_info;
      // }

      tokenInfo = req.token_info ?? null;

      if (!tokenInfo) throw new ErrorHandler(400, "User info is required!");

      const { priceAfterDiscount, subTotal, productsInfo, varientsInfo } =
        await calcluteCartAmounts(
          value.product.varient_ids,
          value.product.product_ids,
          value.product.code,
          client,
        );

      capturedProductsInfo = productsInfo as any[];
      capturedVarientsInfo = varientsInfo as any[];
      capturedSubTotal = subTotal;

      const cartDimensionInputs: IShipmentDimensionInput[] = [];
      for (const v of value.product.varient_ids) {
        const info = varientsInfo.find((item) => item.id == v.id);
        if (info) cartDimensionInputs.push({ ...info, quantity: v.quantity });
      }
      for (const p of value.product.product_ids) {
        const info = productsInfo.find((item) => item.id == p.id);
        if (info) cartDimensionInputs.push({ ...info, quantity: p.quantity });
      }
      const cartWeight = aggregateShipmentDimensions(cartDimensionInputs).weight;

      // Check pincode serviceability via Bigship and get shipping charge
      const serviceability = await BigshipService.checkServiceability(
        value.shippingDetails.pincode,
        cartWeight,
        subTotal,
        value.paymentMethod === "COD",
      );
      console.log(serviceability)

      if (!serviceability.success) {
        throw new ErrorHandler(500, "Unable to verify delivery availability. Try again.");
      }

      if (!serviceability.serviceable) {
        throw new ErrorHandler(
          400,
          `Delivery not available for pincode ${value.shippingDetails.pincode}`,
        );
      }

      bigshipShippingCharge = serviceability.shippingCharge ?? 0;

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

      const orderNumber = generateOrderNumber();

      const storeSettings = await fetchSettingsFromDb();
      const shippingCharge = bigshipShippingCharge;
      const gstPercentage = storeSettings.gst_percentage;
      const discountAmount = subTotal - priceAfterDiscount;
      const baseAmount = priceAfterDiscount !== 0 ? priceAfterDiscount : subTotal;
      const gstAmount = parseFloat((baseAmount * (gstPercentage / 100)).toFixed(2));
      totalFinalAmount = parseFloat((baseAmount + gstAmount + shippingCharge).toFixed(2));

      const priceBreakdown = {
        subtotal:        subTotal,
        discount:        discountAmount,
        gst_percentage:  gstPercentage,
        gst_amount:      gstAmount,
        shipping_charge: shippingCharge,
        total:           totalFinalAmount,
      };

      const orderInfo = await client.query(
        `INSERT INTO orders
            (user_id, order_number, subtotal, discount, shipping_charge, total_amount, coupon_code, shipping_address, price_breakdown, payment_method)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING order_id`,
        [
          tokenInfo.id,
          orderNumber,
          subTotal,
          discountAmount,
          shippingCharge,
          totalFinalAmount,
          value.product.code,
          JSON.stringify(shippingAddressSnapshot),
          JSON.stringify(priceBreakdown),
          value.paymentMethod,
        ],
      );

      const orderId = orderInfo.rows[0].order_id;
      capturedOrderId = orderId;
      capturedOrderNumber = orderNumber;

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

      if (value.paymentMethod == "ONLINE") {
        const { orderid, paymentPageUrl: paymentUrl } =
          await createPaymentGatewayOrder({
            amount: totalFinalAmount,
            dbOrderRowId: orderId,
            marchentOrderId: uuidv4(),
            provider: "phonepe",
            userName: value.shippingDetails.fullName,
            userPhoneNumber: value.shippingDetails.phone,
          });

        paymentPageUrl = paymentUrl;
        paymentMethodOrderId = orderid;
      }

      await client.query(
        `
        INSERT INTO payments
            (order_id, provider, provider_order_id, amount, status)
        VALUES
            ($1, $2, $3, $4, $5)
        `,
        [
          orderId,
          value.paymentMethod == "ONLINE" ? "PhonePe" : null,
          paymentMethodOrderId,
          totalFinalAmount,
          "PENDING",
        ],
      );

      // send guest account deatils
      // if (guestUserInfo != null) {
      //   await sendEmail(
      //     guestUserInfo.email,
      //     "SEND_GUEST_EMAIL_PASSWORD",
      //     guestUserInfo,
      //   );
      // }
    });

    // For COD: create Bigship order immediately (async, non-blocking)
    if (value.paymentMethod === "COD") {
      createBigshipOrderAsync({
        orderId: capturedOrderId!,
        orderNumber: capturedOrderNumber!,
        subTotal: capturedSubTotal!,
        shippingDetails: value.shippingDetails,
        paymentMethod: "COD",
        product: value.product,
        productsInfo: capturedProductsInfo,
        varientsInfo: capturedVarientsInfo,
      });
    }
    // For ONLINE: Bigship order is created after payment confirmed (PhonePe webhook)

    httpResponse(res, 201, "New order successfully created", {
      gatewayUrl: value.paymentMethod === "ONLINE" ? paymentPageUrl : null,
    });
  },
);

// Cart summary preview — subtotal, discount, GST, shipping charge, total.
// Same math as createOrder's price breakdown, but read-only: no order or
// Bigship shipment is created. Used by the frontend to show full payment
// details (shipping, GST, etc.) before the customer places the order.
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

  const { priceAfterDiscount, subTotal, productsInfo, varientsInfo } =
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
  const cartWeight = aggregateShipmentDimensions(cartDimensionInputs).weight;

  const serviceability = await BigshipService.checkServiceability(
    value.pincode,
    cartWeight,
    subTotal,
    value.paymentMethod === "COD",
  );

  if (!serviceability.success) {
    throw new ErrorHandler(500, "Unable to verify delivery availability. Try again.");
  }

  const storeSettings = await fetchSettingsFromDb();
  const gstPercentage = storeSettings.gst_percentage;
  const discountAmount = subTotal - priceAfterDiscount;
  const baseAmount = priceAfterDiscount !== 0 ? priceAfterDiscount : subTotal;
  const gstAmount = parseFloat((baseAmount * (gstPercentage / 100)).toFixed(2));
  const shippingCharge = serviceability.serviceable ? serviceability.shippingCharge ?? 0 : 0;
  const total = parseFloat((baseAmount + gstAmount + shippingCharge).toFixed(2));

  httpResponse(res, 200, "Price breakdown", {
    subtotal: subTotal,
    discount: discountAmount,
    gst_percentage: gstPercentage,
    gst_amount: gstAmount,
    shipping_charge: shippingCharge,
    total,
    serviceable: serviceability.serviceable,
    courier_name: serviceability.courierName ?? null,
    estimated_days: serviceability.estimatedDays ?? null,
  });
});

// ============================================================
// HELPER — create Bigship order in background after DB commit
// ============================================================
interface BigshipAsyncParams {
  orderId: number;
  orderNumber: string;
  subTotal: number;
  shippingDetails: IShippingAddress;
  paymentMethod: "COD" | "ONLINE";
  product: {
    product_ids: { id: number; quantity: number }[];
    varient_ids: { id: number; quantity: number }[];
  };
  productsInfo: any[];
  varientsInfo: any[];
}

async function createBigshipOrderAsync(params: BigshipAsyncParams) {
  try {
    const items: BigshipOrderItem[] = [];
    const dimensionInputs: IShipmentDimensionInput[] = [];

    for (const v of params.product.varient_ids) {
      const info = params.varientsInfo.find((x) => x.id == v.id);
      if (info) {
        items.push({
          name:         info.product_name,
          units:        v.quantity,
          sellingPrice: parseFloat(info.price),
        });
        dimensionInputs.push({ ...info, quantity: v.quantity });
      }
    }

    for (const p of params.product.product_ids) {
      const info = params.productsInfo.find((x) => x.id == p.id);
      if (info) {
        items.push({
          name:         info.name,
          units:        p.quantity,
          sellingPrice: parseFloat(info.price),
        });
        dimensionInputs.push({ ...info, quantity: p.quantity });
      }
    }

    const { weight, length, breadth, height } = aggregateShipmentDimensions(dimensionInputs);

    const addr = params.shippingDetails;
    const orderDate = new Date().toISOString().slice(0, 19).replace("T", " ");

    const result = await BigshipService.createOrder({
      orderNumber:       params.orderNumber,
      orderDate,
      customerName:      addr.fullName,
      customerEmail:     addr.email,
      customerPhone:     addr.phone,
      customerAddress:   addr.address,
      customerCity:      addr.city,
      customerState:     addr.state,
      customerPincode:   addr.pincode,
      customerCountry:   addr.country || "India",
      paymentMethod:     params.paymentMethod,
      items,
      weight,
      length,
      breadth,
      height,
    });

    if (result.success && result.bigshipOrderId) {
      await pool.query(
        "UPDATE orders SET bigship_order_id = $1, waybill = $2 WHERE order_id = $3",
        [result.bigshipOrderId, result.awbCode ?? null, params.orderId],
      );
      logger.info({
        message: "Bigship order linked to DB order",
        orderId: params.orderId,
        bigshipOrderId: result.bigshipOrderId,
      });
    } else {
      logger.error({
        message: "Bigship order creation failed",
        orderId: params.orderId,
        error: result.error,
      });
    }
  } catch (err) {
    logger.error({ message: "createBigshipOrderAsync threw", error: err });
  }
}

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

  const { rows } = await pool.query(
    `
       SELECT
         o.order_id,
         o.order_number,
         o.shipping_address->>'name' AS user_name,
         o.total_amount,
         o.payment_status,
         o.order_status,
         TO_CHAR(o.created_at, 'DD Mon YYYY') AS order_date,
         (o.created_at >= NOW() - INTERVAL '7 days') AS is_returnable,
         CASE
          WHEN o.order_status = '${ORDER_DELIVERED}'
          THEN true
          ELSE false
         END AS invoice_avilable
        FROM orders o

        LEFT JOIN users u
        ON u.id = o.user_id

        ${filter}

        ORDER BY o.order_id DESC

        ${TO_STRING}
      `,
    filterValues,
  );

  httpResponse(res, 200, "Order list", rows);
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
        order_number,
        subtotal,
        discount,
        shipping_charge,
        total_amount,
        coupon_code,
        order_status,
        payment_status,
        shipping_address,
        price_breakdown,
        payment_method,
        bigship_order_id
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
        *
       FROM payments
       WHERE order_id = $1
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
    };
  });

  httpResponse(res, 200, "Single Order Info", objToReturn);
});

// this is for admin access
export const updateOrderStatus = asyncErrorHandler(async (req, res) => {
  const value = doValidate(VUpdateOrderStatus, req.body ?? {});

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
      await client.query(
        "UPDATE orders SET order_status = $1, updated_at = CURRENT_TIMESTAMP WHERE order_id = $2",
        [value.status, value.order_id],
      );

      await client.query(
        "UPDATE order_items SET status = $1 WHERE order_id = $2",
        [value.status, value.order_id],
      );
    }
  });

  httpResponse(res, 200, "Order status successfully updated");
});

//this endpoint for user only
export const doReturn = asyncErrorHandler(async (req, res) => {
  const value = doValidate<{
    order_id: string;
    type: "Return" | "Replace";
  }>(VReturnOrder, req.body ?? {});

  const orderNumber = value.order_id;

  await doTransition(async (client) => {
    // return only happen if the order is DELIVERED and payment method ONLINE and update_at vs now() diffrence is 7 day
    const orderInfo = await client.query(
      `
        UPDATE orders o
        SET order_status = $1
        WHERE o.order_number = $2
          AND o.order_status = '${ORDER_DELIVERED}'
          AND (
            ($3 = 'Return' AND o.payment_method = '${ONLINE_PAYMENT}')
            OR ($3 = 'Replace')
          )
          AND o.updated_at >= NOW() - INTERVAL '7 days'
        RETURNING o.order_id, o.total_amount, o.shipping_address;
      `,
      [
        value.type === "Return" ? ORDER_RETURN_INITIATED : REPLACE_INITIATED,
        orderNumber,
        value.type,
      ],
    );

    if (orderInfo.rowCount === 0)
      throw new ErrorHandler(400, "Unable to process your request");

    const dbOrderId = orderInfo.rows[0].order_id;
    const addr = orderInfo.rows[0].shipping_address;

    const orderItemsInfo = await client.query(
      "UPDATE order_items SET status = $1 WHERE order_id = $2",
      [ORDER_RETURN_INITIATED, dbOrderId],
    );

    // now tell the deleviry to return the product
    const returnResponse = await DelhiveryService.createReturnShipment(
      {
        add: addr.address_line1,
        city: addr.city,
        country: addr.country ?? "India",
        state: addr.state,
        phone: addr.phone,
        name: addr.name,
        pin: addr.pincode,
      },
      {
        orderId: orderNumber,
        productDescription: `Returning The ${orderNumber}`,
        quantity: orderItemsInfo.rowCount ?? 1,
        totalAmount: orderInfo.rows[0].total_amount,
        weight: 0.2,
      },
      value.type === "Return" ? "Return" : "Replacement",
    );

    if (!returnResponse.success) {
      throw new ErrorHandler(500, "Unable to process your request");
    }

    await client.query(
      "INSERT INTO order_returns (order_id, waybill, reason, type) VALUES ($1, $2, $3, $4)",
      [dbOrderId, returnResponse.returnWaybill, null, value.type],
    );
  });

  httpResponse(res, 200, "Return Successfully Initiated");
});

//this endpoint for user only
export const doCancel = asyncErrorHandler(async (req, res) => {
  const value = doValidate<{
    order_id?: string;
    order_item_id?: number;
    // status: string;
  }>(VCancelOrder, req.body ?? {});

  // if (value.status != ORDER_CANCELLED)
  //   throw new ErrorHandler(403, "Not allowed");

  let bigshipWaybill: string | null = null;

  await doTransition(async (client) => {
    if (value.order_id) {
      const { rowCount, rows } = await client.query(
        `
        UPDATE orders
          SET order_status = $1
        WHERE order_number = $2 AND (order_status = '${ORDER_PENDING}' OR order_status = '${ORDER_CONFIRMED}' OR order_status = '${ORDER_SHIPPED}')
        RETURNING order_id, waybill
        `,
        [ORDER_CANCELLED, value.order_id],
      );

      if (rowCount === 0) throw new ErrorHandler(400, "Unable to cancel");

      const dbOrderId = rows[0].order_id;
      bigshipWaybill = rows[0].waybill ?? null;

      await client.query(
        "UPDATE order_items SET status = $1 WHERE order_id = $2",
        [ORDER_CANCELLED, dbOrderId],
      );
    }
  });

  // Cancel on Bigship if the shipment was already created
  if (bigshipWaybill) {
    const cancelResponse = await BigshipService.cancelOrder(bigshipWaybill);
    if (!cancelResponse.success) {
      logger.error({
        message: "Bigship cancel failed (order already cancelled in DB)",
        bigshipWaybill,
        error: cancelResponse.error,
      });
    }
  }

  httpResponse(res, 200, "Order successfully cancelled");
});

export const downloadInvoice = asyncErrorHandler(async (req, res) => {
  const orderid = req.params.orderid;
  if (!orderid) throw new ErrorHandler(400, "Invalid request");

  let objectToSend: any = {};

  await doTransition(async (client) => {
    const orderInfo = await client.query(
      `
       SELECT
        user_id,
        order_number,
        TO_CHAR(created_at, 'DD Mon YYYY') AS order_date,
        subtotal,
        discount,
        shipping_charge,
        total_amount,
        coupon_code,
        order_status,
        payment_status,
        shipping_address,
        payment_method
       FROM orders

       WHERE order_id = $1 AND order_status = '${ORDER_DELIVERED}'
      `,
      [orderid],
    );

    if (orderInfo.rowCount == 0)
      throw new ErrorHandler(404, "Order information not found!");

    const addr = orderInfo.rows[0].shipping_address ?? {};

    const orderItemsInfo = await client.query(
      `
       SELECT
        oi.order_item_id,
        oi.quantity,
        oi.price,
        oi.subtotal,

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
         THEN oi.variant_info->'images'->0
         ELSE oi.product_info->'images'->0
        END AS images

       FROM order_items oi

       WHERE order_id = $1
      `,
      [orderid],
    );

    objectToSend = {
      orderNumber: orderInfo.rows[0].order_number,
      orderDate: orderInfo.rows[0].order_date,
      total: orderInfo.rows[0].total_amount,
      paymentMethodTxt:
        orderInfo.rows[0].payment_method == "COD"
          ? "Cash on delivery"
          : "Online Paid",
      paymentMethod: orderInfo.rows[0].payment_method,
      items: orderItemsInfo.rows.map((item: any) => ({
        name: item.product_name,
        quantity: item.quantity,
        total: item.price,
      })),

      subtotal: orderInfo.rows[0].subtotal,
      shipping: orderInfo.rows[0].shipping_charge,
      billingAddress: {
        name: addr.name,
        line1: addr.address_line1,
        city: addr.city,
        postalCode: addr.pincode,
        state: addr.state,
        phone: addr.phone,
        email: addr.email,
      },
      shippingAddress: {
        name: addr.name,
        line1: addr.address_line1,
        city: addr.city,
        postalCode: addr.pincode,
        state: addr.state,
        phone: addr.phone,
      },
    };
  });

  res.render("invoice", objectToSend);
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
// HELPER — pull latest tracking data from Bigship and backfill
// webhook_data. Bigship has no webhook push in this API version,
// so trackOrder pulls live and caches it the same way a webhook would.
// ============================================================
async function syncBigshipTracking(orderNumber: string) {
  try {
    const { rows, rowCount } = await pool.query(
      "SELECT waybill FROM orders WHERE order_number = $1",
      [orderNumber],
    );

    if (rowCount === 0 || !rows[0].waybill) return;

    const waybill: string = rows[0].waybill;

    const result = await BigshipService.trackShipment(waybill);
    if (!result.success || !result.trackingData) return;

    const events = BigshipService.normalizeTrackingHistory(result.trackingData, waybill);
    if (events.length === 0) return;

    await pool.query("DELETE FROM webhook_data WHERE waybill = $1", [waybill]);

    for (const event of events) {
      await pool.query(
        "INSERT INTO webhook_data (waybill, payload) VALUES ($1, $2)",
        [waybill, event],
      );
    }

    // Latest event drives the order's actual status, same as a webhook push would
    const latestEvent = events[events.length - 1];
    const STATUS =
      SHIPMENT_MAPING[
        `${latestEvent.Shipment.Status.StatusType}_${latestEvent.Shipment.Status.Status}`
      ];

    if (!STATUS) return;

    await doTransition(async (client) => {
      const orderLookup = await client.query(
        "SELECT order_id FROM orders WHERE waybill = $1",
        [waybill],
      );

      if (orderLookup.rowCount === 0) return;

      const orderId = orderLookup.rows[0].order_id;

      await manageStock({ order_status: STATUS, orderid: orderId, client });

      await client.query(
        "UPDATE orders SET order_status = $1, updated_at = CURRENT_TIMESTAMP WHERE order_id = $2",
        [STATUS, orderId],
      );

      await client.query(
        "UPDATE order_items SET status = $1 WHERE order_id = $2",
        [STATUS, orderId],
      );
    });
  } catch (err) {
    logger.error({ message: "syncBigshipTracking failed", orderNumber, error: err });
  }
}

export const trackOrder = asyncErrorHandler(async (req, res) => {
  // track order
  const value = doValidate<{ order_number: string }>(
    VTrackOrder,
    req.query ?? {},
  );

  await syncBigshipTracking(value.order_number);

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
        ON wd.waybill = o.waybill OR wd.waybill = r.waybill

      WHERE o.order_number = $1
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
