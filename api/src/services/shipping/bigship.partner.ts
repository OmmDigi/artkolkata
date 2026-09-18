import { pool } from "../..";
import { ONLINE_PAYMENT } from "../../constant";
import logger from "../../utils/logger";
import { generateInvoiceDataUri } from "../../utils/generateInvoicePdf";
import BigshipClient, {
  BigshipOrderItem,
  EWAYBILL_THRESHOLD,
} from "./bigship.client";
import { parseShipmentBoxes } from "./shipmentBoxes";
import {
  CancelShipmentInput,
  CancelShipmentResult,
  IShippingPartner,
  ReverseShipmentBooking,
  ShipmentBooking,
  ShipmentCheck,
  ShipmentCheckInput,
  ShipmentLeg,
  TrackingEvent,
  TrackShipmentResult,
} from "./shipping.partner";

/**
 * Bigship as an IShippingPartner.
 *
 * Kept live behind SHIPPING_PARTNER=bigship so orders already booked there stay
 * cancellable and trackable. It has no reverse-pickup API wired up, so returns
 * and replacements report themselves as unsupported rather than pretending to
 * book something — see returnShippingOrder.
 */
export class BigshipPartner implements IShippingPartner {
  readonly name = "bigship" as const;
  readonly label = "Bigship";

  // ============================================================
  // CHECK
  // ============================================================
  async checkShipment(input: ShipmentCheckInput): Promise<ShipmentCheck> {
    return BigshipClient.checkServiceability(
      input.pincode,
      input.weight,
      input.invoiceValue,
      input.cod,
      input.dimensions,
    );
  }

  // ============================================================
  // BOOK
  // ============================================================
  async createShippingOrder(
    orderId: number,
    options: { leg?: ShipmentLeg } = {},
  ): Promise<ShipmentBooking> {
    // A replacement parcel is a second forward booking against one order, and
    // Bigship keys its bookings off our order number — which is already taken
    // by the first parcel. Wiring it up needs a Bigship-side suffix scheme that
    // has never been tested against a live account, so it is refused rather
    // than guessed at.
    if (options.leg === "replacement") {
      logger.error({
        message: "Bigship cannot book a replacement parcel",
        orderId,
      });
      return { created: false, skipped: "not_supported" };
    }

    try {
      return await this.bookForwardLeg(orderId);
    } catch (error) {
      logger.error({ message: "Bigship booking threw", orderId, error });
      return { created: false, error };
    }
  }

  private async bookForwardLeg(orderId: number): Promise<ShipmentBooking> {
    const { rows, rowCount } = await pool.query(
      `
      SELECT
        o.order_id,
        o.order_number,
        o.payment_method,
        o.payment_status,
        o.shipping_partner,
        o.partner_order_id,
        o.shipping_address,
        o.shipment_boxes,
        o.ewaybill_number,
        o.ewaybill_document,
        o.invoice_document,
        o.subtotal,
        o.discount,
        o.shipping_charge,
        o.total_amount,
        o.created_at,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'product_info', oi.product_info,
            'variant_info', oi.variant_info,
            'quantity',     oi.quantity,
            'price',        oi.price
          )
        ) AS items
      FROM orders o

      JOIN order_items oi
      ON oi.order_id = o.order_id

      WHERE o.order_id = $1

      GROUP BY o.order_id
      `,
      [orderId],
    );

    if (rowCount === 0) return { created: false, skipped: "order_not_found" };

    const order = rows[0];

    // Already booked — nothing to do.
    if (order.partner_order_id) {
      return {
        created: false,
        skipped: "already_created",
        partnerOrderId: order.partner_order_id,
        waybill: order.waybill ?? undefined,
      };
    }

    // An online order that has not been paid for must never reach the courier.
    if (order.payment_method === ONLINE_PAYMENT && order.payment_status !== "PAID") {
      return { created: false, skipped: "payment_not_completed" };
    }

    const address = order.shipping_address;
    if (!address || !address.name) {
      return { created: false, skipped: "no_shipping_address" };
    }

    const orderItems = (order.items as any[]) ?? [];
    if (orderItems.length === 0) return { created: false, skipped: "no_items" };

    const items: BigshipOrderItem[] = orderItems.map((item) => {
      const info = item.variant_info ?? item.product_info ?? {};
      return {
        name: info.product_name ?? info.name ?? "Item",
        units: item.quantity,
        sellingPrice: parseFloat(item.price),
      };
    });

    // What ships is packed by hand, so the boxes come from the admin and there
    // is no product-derived fallback.
    const boxes = parseShipmentBoxes(order.shipment_boxes);
    if (boxes.length === 0) return { created: false, skipped: "no_shipment_boxes" };

    // More than one box means Bigship B2B, which is invoiced on a document
    // rather than on the box amounts, and needs an ewaybill above the
    // threshold. One box stays on the cheaper B2C route with none of that.
    const isB2B = boxes.length > 1;

    const invoiceAmount = items.reduce(
      (sum, item) => sum + item.units * item.sellingPrice,
      0,
    );

    if (
      isB2B &&
      invoiceAmount >= EWAYBILL_THRESHOLD &&
      (!order.ewaybill_number || !order.ewaybill_document)
    ) {
      return { created: false, skipped: "ewaybill_required" };
    }

    // B2B is invoiced on an attached document, and only B2B needs one. An
    // invoice uploaded from the CMS is the real one, so it goes to the courier
    // as-is; the app only draws its own when nothing was uploaded.
    let invoiceDocument: string | undefined;

    if (isB2B) {
      invoiceDocument =
        order.invoice_document ||
        (await generateInvoiceDataUri({
          orderNumber: order.order_number,
          orderDate: order.created_at,
          paymentMethod:
            order.payment_method === ONLINE_PAYMENT
              ? "Online Paid"
              : "Cash on delivery",
          customerName: address.name,
          customerPhone: address.phone,
          customerEmail: address.email,
          addressLine1: address.address_line1,
          city: address.city,
          state: address.state,
          pincode: address.pincode,
          items: items.map((item) => ({
            name: item.name,
            quantity: item.units,
            price: item.sellingPrice,
          })),
          subtotal: parseFloat(order.subtotal ?? 0),
          discount: parseFloat(order.discount ?? 0),
          shipping: parseFloat(order.shipping_charge ?? 0),
          total: parseFloat(order.total_amount ?? 0),
        }));
    }

    const result = await BigshipClient.createOrder({
      orderNumber: order.order_number,
      orderDate: new Date(order.created_at).toISOString(),
      customerName: address.name,
      customerEmail: address.email,
      customerPhone: address.phone,
      customerAddress: address.address_line1,
      customerCity: address.city,
      customerState: address.state,
      customerPincode: address.pincode,
      customerCountry: address.country || "India",
      paymentMethod: order.payment_method === ONLINE_PAYMENT ? "ONLINE" : "COD",
      items,
      boxes,
      invoiceDocument,
      // Only B2B carries an ewaybill; sending one on B2C is rejected.
      ewaybillNumber: isB2B ? (order.ewaybill_number ?? undefined) : undefined,
      ewaybillDocument: isB2B ? (order.ewaybill_document ?? undefined) : undefined,
    });

    if (!result.success || !result.bigshipOrderId) {
      logger.error({
        message: "Bigship order creation failed",
        orderId,
        orderNumber: order.order_number,
        category: isB2B ? "b2b" : "b2c",
        error: result.error,
      });
      return { created: false, error: result.error };
    }

    await pool.query(
      `
      UPDATE orders
      SET shipping_partner = $1,
          partner_order_id = $2,
          waybill          = COALESCE($3, waybill),
          updated_at       = CURRENT_TIMESTAMP
      WHERE order_id = $4
      `,
      [this.name, result.bigshipOrderId, result.awbCode ?? null, orderId],
    );

    await pool.query("UPDATE order_items SET waybill = $1 WHERE order_id = $2", [
      result.awbCode ?? null,
      orderId,
    ]);

    logger.info({
      message: "Bigship order linked to DB order",
      orderId,
      category: isB2B ? "b2b" : "b2c",
      boxes: boxes.length,
      partnerOrderId: result.bigshipOrderId,
      awb: result.awbCode,
    });

    return {
      created: true,
      partnerOrderId: result.bigshipOrderId,
      waybill: result.awbCode,
    };
  }

  // ============================================================
  // REVERSE — not wired up for Bigship.
  //
  // Bigship does have a reverse product, but nothing here has ever been run
  // against a live Bigship account, and a reverse booking that silently does
  // nothing is worse than one that says so: the customer would be told their
  // pickup is on its way and no courier would come. The order_returns row is
  // still written by the caller, so support can book the pickup by hand.
  // ============================================================
  async returnShippingOrder(orderId: number): Promise<ReverseShipmentBooking> {
    logger.error({
      message: "Bigship has no reverse pickup — book this return by hand",
      orderId,
      type: "Return",
    });
    return { created: false, type: "Return", skipped: "not_supported" };
  }

  async replaceShippingOrder(orderId: number): Promise<ReverseShipmentBooking> {
    logger.error({
      message: "Bigship has no reverse pickup — book this replacement by hand",
      orderId,
      type: "Replace",
    });
    return { created: false, type: "Replace", skipped: "not_supported" };
  }

  // ============================================================
  // CANCEL — Bigship cancels by AWB alone.
  // ============================================================
  async cancelShippingOrder(
    input: CancelShipmentInput,
  ): Promise<CancelShipmentResult> {
    if (!input.waybill) return { success: true };
    return BigshipClient.cancelOrder(input.waybill);
  }

  // ============================================================
  // TRACK
  // ============================================================
  trackShipment(waybill: string): Promise<TrackShipmentResult> {
    return BigshipClient.trackShipment(waybill);
  }

  normalizeTrackingHistory(trackingData: any, waybill: string): TrackingEvent[] {
    return BigshipClient.normalizeTrackingHistory(trackingData, waybill);
  }

  // Bigship pushes no tracking webhook of its own — the scans are pulled on
  // read instead (see syncShipmentTracking), so there is nothing to flatten.
  normalizeWebhookEvents(_payload: any): TrackingEvent[] {
    return [];
  }
}
