import { pool } from "..";
import BigshipService, { BigshipOrderItem } from "../services/bigshipService";
import { ONLINE_PAYMENT } from "../constant";
import {
  aggregateShipmentDimensions,
  IShipmentDimensionInput,
} from "./aggregateShipmentDimensions";
import logger from "./logger";

export type ShipmentSkipReason =
  | "already_created"
  | "order_not_found"
  | "no_items"
  | "no_shipping_address"
  | "payment_not_completed";

export interface CreateShipmentResult {
  created: boolean;
  skipped?: ShipmentSkipReason;
  bigshipOrderId?: string;
  awbCode?: string;
  error?: any;
}

// Single entry point for booking a Bigship shipment against an order that
// already exists in our DB. Safe to call more than once for the same order —
// an order that already carries a bigship_order_id is left alone, so the
// order-create path and the admin confirm path can both call it without
// double-booking an AWB.
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
        o.shipment_dimensions,
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

    // Dimensions snapshotted on the order at placement time. Older orders have
    // no snapshot, so fall back to recomputing from the item snapshots.
    const dimensions =
      order.shipment_dimensions ??
      aggregateShipmentDimensions(
        itemInfos.map(
          ({ item, info }) =>
            ({ ...info, quantity: item.quantity }) as IShipmentDimensionInput,
        ),
      );

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
      weight: dimensions.weight,
      length: dimensions.length,
      breadth: dimensions.breadth,
      height: dimensions.height,
    });

    if (!result.success || !result.bigshipOrderId) {
      logger.error({
        message: "Bigship order creation failed",
        orderId,
        orderNumber: order.order_number,
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
