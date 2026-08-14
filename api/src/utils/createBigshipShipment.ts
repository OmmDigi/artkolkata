import { pool } from "..";
import BigshipService, {
  BigshipBox,
  BigshipOrderItem,
  EWAYBILL_THRESHOLD,
} from "../services/bigshipService";
import { ONLINE_PAYMENT } from "../constant";
import { generateInvoiceDataUri } from "./generateInvoicePdf";
import logger from "./logger";

export type ShipmentSkipReason =
  | "already_created"
  | "order_not_found"
  | "no_items"
  | "no_shipping_address"
  | "no_shipment_boxes"
  | "ewaybill_required"
  | "payment_not_completed";

export interface CreateShipmentResult {
  created: boolean;
  skipped?: ShipmentSkipReason;
  bigshipOrderId?: string;
  awbCode?: string;
  error?: any;
}

// The boxes the admin keys into the CMS. Anything unreadable is dropped rather
// than sent as NaN, which Bigship answers with a generic 400.
export interface IShipmentBox {
  weight_kg: string | number;
  length_cm: string | number;
  breadth_cm: string | number;
  height_cm: string | number;
}

const num = (raw: string | number | undefined) => {
  const parsed = parseFloat(String(raw));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

// Rows keyed in by hand can be blank or half-filled — only a row with all four
// measurements describes a real box, so the rest are discarded.
export const parseShipmentBoxes = (raw: any): BigshipBox[] => {
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((box: IShipmentBox) => {
    const weight = num(box?.weight_kg);
    const length = num(box?.length_cm);
    const breadth = num(box?.breadth_cm);
    const height = num(box?.height_cm);

    if (!weight || !length || !breadth || !height) return [];

    return [{ weight, length, breadth, height }];
  });
};

// Single entry point for booking a Bigship shipment against an order that
// already exists in our DB. Safe to call more than once for the same order —
// an order that already carries a bigship_order_id is left alone, so a failed
// confirm can simply be retried without double-booking an AWB.
export const createBigshipShipment = async (
  orderId: number,
): Promise<CreateShipmentResult> => {
  try {
    const { rows, rowCount } = await pool.query(
      `
      SELECT
        o.order_id,
        o.order_number,
        o.payment_method,
        o.payment_status,
        o.bigship_order_id,
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

    // Already booked with Bigship — nothing to do.
    if (order.bigship_order_id) {
      return {
        created: false,
        skipped: "already_created",
        bigshipOrderId: order.bigship_order_id,
      };
    }

    // An online order that has not been paid for must never reach the courier.
    if (order.payment_method === ONLINE_PAYMENT && order.payment_status !== "PAID") {
      return { created: false, skipped: "payment_not_completed" };
    }

    const addr = order.shipping_address;
    if (!addr || !addr.name) {
      return { created: false, skipped: "no_shipping_address" };
    }

    const orderItems = (order.items as any[]) ?? [];
    if (orderItems.length === 0) return { created: false, skipped: "no_items" };

    const itemInfos = orderItems.map((item) => ({
      item,
      info: item.variant_info ?? item.product_info ?? {},
    }));

    const items: BigshipOrderItem[] = itemInfos.map(({ item, info }) => ({
      name: info.product_name ?? info.name ?? "Item",
      units: item.quantity,
      sellingPrice: parseFloat(item.price),
    }));

    // What ships is packed by hand, so the boxes come from the admin and there
    // is no product-derived fallback — booking without them would hand the
    // courier dimensions nobody has verified.
    const boxes = parseShipmentBoxes(order.shipment_boxes);
    if (boxes.length === 0) {
      return { created: false, skipped: "no_shipment_boxes" };
    }

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
          customerName: addr.name,
          customerPhone: addr.phone,
          customerEmail: addr.email,
          addressLine1: addr.address_line1,
          city: addr.city,
          state: addr.state,
          pincode: addr.pincode,
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

    const result = await BigshipService.createOrder({
      orderNumber: order.order_number,
      orderDate: new Date(order.created_at).toISOString(),
      customerName: addr.name,
      customerEmail: addr.email,
      customerPhone: addr.phone,
      customerAddress: addr.address_line1,
      customerCity: addr.city,
      customerState: addr.state,
      customerPincode: addr.pincode,
      customerCountry: addr.country || "India",
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
      "UPDATE orders SET bigship_order_id = $1, waybill = $2 WHERE order_id = $3",
      [result.bigshipOrderId, result.awbCode ?? null, orderId],
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
      bigshipOrderId: result.bigshipOrderId,
      awb: result.awbCode,
    });

    return {
      created: true,
      bigshipOrderId: result.bigshipOrderId,
      awbCode: result.awbCode,
    };
  } catch (err) {
    logger.error({ message: "createBigshipShipment threw", orderId, error: err });
    return { created: false, error: err };
  }
};
