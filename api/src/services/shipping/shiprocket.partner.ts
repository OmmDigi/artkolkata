import { pool } from "../..";
import { ONLINE_PAYMENT } from "../../constant";
import logger from "../../utils/logger";
import ShiprocketClient, {
  ShiprocketOrderItem,
} from "./shiprocket.client";
import { parseShipmentBoxes } from "./shipmentBoxes";
import { warehouseAddress } from "./warehouse";
import {
  CancelShipmentInput,
  CancelShipmentResult,
  IShippingPartner,
  ReverseShipmentBooking,
  ReverseShipmentType,
  ShipmentBooking,
  ShipmentCheck,
  ShipmentCheckInput,
  ShipmentLeg,
  TrackingEvent,
  TrackShipmentResult,
} from "./shipping.partner";

/**
 * Shiprocket as an IShippingPartner.
 *
 * The client next door speaks HTTP to Shiprocket and knows nothing about our
 * database; this class is the half that reads orders, decides whether a
 * booking should happen at all, and writes back what the courier answered.
 * Splitting them that way is what lets a second partner be added without
 * re-deriving any of the order rules below.
 */
export class ShiprocketPartner implements IShippingPartner {
  readonly name = "shiprocket" as const;
  readonly label = "Shiprocket";

  // ============================================================
  // CHECK
  // ============================================================
  async checkShipment(input: ShipmentCheckInput): Promise<ShipmentCheck> {
    return ShiprocketClient.checkServiceability(
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
    try {
      return options.leg === "replacement"
        ? await this.bookReplacementLeg(orderId)
        : await this.bookForwardLeg(orderId);
    } catch (error) {
      logger.error({
        message: "Shiprocket booking threw",
        orderId,
        leg: options.leg ?? "forward",
        error,
      });
      return { created: false, error };
    }
  }

  /**
   * The parcel going out to the customer.
   *
   * Idempotent: an order that already carries a partner order id is left
   * alone, so a failed confirm can be retried. The one exception is an order
   * that got an id but never an AWB — the create succeeded and the assign step
   * broke — where only the AWB is retried rather than booking a second order.
   */
  private async bookForwardLeg(orderId: number): Promise<ShipmentBooking> {
    const order = await this.loadOrder(orderId);
    if (!order) return { created: false, skipped: "order_not_found" };

    if (order.partner_order_id) {
      if (order.waybill || !order.partner_shipment_id) {
        return {
          created: false,
          skipped: "already_created",
          partnerOrderId: order.partner_order_id,
          partnerShipmentId: order.partner_shipment_id ?? undefined,
          waybill: order.waybill ?? undefined,
        };
      }

      const retry = await ShiprocketClient.assignAwb(order.partner_shipment_id);

      if (!retry.success) {
        logger.error({
          message: "Shiprocket AWB retry failed",
          orderId,
          shipmentId: order.partner_shipment_id,
          error: retry.error,
        });
        return { created: false, error: retry.error };
      }

      await this.persistForwardShipment(orderId, {
        partnerOrderId: order.partner_order_id,
        partnerShipmentId: order.partner_shipment_id,
        waybill: retry.awbCode,
        courierName: retry.courierName,
      });

      return {
        created: true,
        partnerOrderId: order.partner_order_id,
        partnerShipmentId: order.partner_shipment_id,
        waybill: retry.awbCode,
        courierName: retry.courierName,
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

    const items = this.orderItems(order);
    if (items.length === 0) return { created: false, skipped: "no_items" };

    // What ships is packed by hand, so the boxes come from the admin and there
    // is no product-derived fallback — booking without them would hand the
    // courier dimensions nobody has verified.
    const boxes = parseShipmentBoxes(order.shipment_boxes);
    if (boxes.length === 0) return { created: false, skipped: "no_shipment_boxes" };

    const result = await ShiprocketClient.createOrder({
      orderNumber: order.order_number,
      orderDate: new Date(order.created_at).toISOString(),
      customerName: address.name,
      customerEmail: address.email,
      customerPhone: address.phone,
      customerAddress: address.address_line1,
      customerAddress2: address.address_line2,
      customerCity: address.city,
      customerState: address.state,
      customerPincode: address.pincode,
      customerCountry: address.country || "India",
      paymentMethod: order.payment_method === ONLINE_PAYMENT ? "ONLINE" : "COD",
      items,
      boxes,
      // whatever the shipping rules charged the customer, which is what the
      // invoice shows and what a COD order must collect
      shippingCharges: parseFloat(order.shipping_charge ?? 0),
      totalDiscount: parseFloat(order.discount ?? 0),
      comment: `Order ${order.order_number}`,
    });

    // The order may exist at Shiprocket even on a failure — createOrder returns
    // the ids it got before the AWB step broke. Persist them so the retry path
    // above picks it up instead of booking a second order.
    if (!result.success) {
      if (result.shiprocketOrderId) {
        await this.persistForwardShipment(orderId, {
          partnerOrderId: result.shiprocketOrderId,
          partnerShipmentId: result.shipmentId,
        });
      }

      logger.error({
        message: "Shiprocket order creation failed",
        orderId,
        orderNumber: order.order_number,
        partnerOrderId: result.shiprocketOrderId,
        error: result.error,
      });
      return { created: false, error: result.error };
    }

    await this.persistForwardShipment(orderId, {
      partnerOrderId: result.shiprocketOrderId!,
      partnerShipmentId: result.shipmentId,
      waybill: result.awbCode,
      courierName: result.courierName,
    });

    logger.info({
      message: "Shiprocket order linked to DB order",
      orderId,
      boxes: boxes.length,
      partnerOrderId: result.shiprocketOrderId,
      shipmentId: result.shipmentId,
      awb: result.awbCode,
      pickupScheduled: result.pickupScheduled,
    });

    return {
      created: true,
      partnerOrderId: result.shiprocketOrderId,
      partnerShipmentId: result.shipmentId,
      waybill: result.awbCode,
      courierName: result.courierName,
    };
  }

  /**
   * The parcel sent out after a Replace, once the returned goods are back.
   *
   * It is a second forward shipment against the same order, so it cannot live
   * in the order's own shipment columns — it is booked against the
   * order_returns row that started the replacement and stored there. Shiprocket
   * rejects a duplicate order id, so it goes across with the return row's id
   * appended.
   */
  private async bookReplacementLeg(orderId: number): Promise<ShipmentBooking> {
    const order = await this.loadOrder(orderId);
    if (!order) return { created: false, skipped: "order_not_found" };

    const { rows } = await pool.query(
      `
      SELECT id, replacement_partner_order_id, replacement_waybill
      FROM order_returns
      WHERE order_id = $1 AND type = 'Replace'
      ORDER BY id DESC
      LIMIT 1
      `,
      [orderId],
    );

    const returnRow = rows[0];

    // Nothing to replace: no customer ever asked for one on this order.
    if (!returnRow) return { created: false, skipped: "no_return_record" };

    if (returnRow.replacement_partner_order_id) {
      return {
        created: false,
        skipped: "already_created",
        partnerOrderId: returnRow.replacement_partner_order_id,
        waybill: returnRow.replacement_waybill ?? undefined,
      };
    }

    const address = order.shipping_address;
    if (!address || !address.name) {
      return { created: false, skipped: "no_shipping_address" };
    }

    const items = this.orderItems(order);
    if (items.length === 0) return { created: false, skipped: "no_items" };

    const boxes = parseShipmentBoxes(order.shipment_boxes);
    if (boxes.length === 0) return { created: false, skipped: "no_shipment_boxes" };

    const result = await ShiprocketClient.createOrder({
      orderNumber: `${order.order_number}-REP${returnRow.id}`,
      orderDate: new Date().toISOString(),
      customerName: address.name,
      customerEmail: address.email,
      customerPhone: address.phone,
      customerAddress: address.address_line1,
      customerAddress2: address.address_line2,
      customerCity: address.city,
      customerState: address.state,
      customerPincode: address.pincode,
      customerCountry: address.country || "India",
      // The customer already paid, or already paid cash on the first parcel.
      // A replacement is never collected against a second time.
      paymentMethod: "ONLINE",
      items,
      boxes,
      shippingCharges: 0,
      totalDiscount: 0,
      comment: `Replacement for order ${order.order_number}`,
    });

    if (!result.success) {
      // Same reasoning as the forward leg: keep whatever ids exist so a retry
      // does not book a second replacement parcel.
      if (result.shiprocketOrderId) {
        await this.persistReplacementShipment(returnRow.id, {
          partnerOrderId: result.shiprocketOrderId,
          partnerShipmentId: result.shipmentId,
        });
      }

      logger.error({
        message: "Shiprocket replacement booking failed",
        orderId,
        returnId: returnRow.id,
        error: result.error,
      });
      return { created: false, error: result.error };
    }

    await this.persistReplacementShipment(returnRow.id, {
      partnerOrderId: result.shiprocketOrderId!,
      partnerShipmentId: result.shipmentId,
      waybill: result.awbCode,
      courierName: result.courierName,
    });

    logger.info({
      message: "Shiprocket replacement parcel booked",
      orderId,
      returnId: returnRow.id,
      awb: result.awbCode,
    });

    return {
      created: true,
      partnerOrderId: result.shiprocketOrderId,
      partnerShipmentId: result.shipmentId,
      waybill: result.awbCode,
      courierName: result.courierName,
    };
  }

  // ============================================================
  // REVERSE — return and replace are the same collection, and differ
  // only in what happens once the goods are back.
  // ============================================================
  returnShippingOrder(orderId: number): Promise<ReverseShipmentBooking> {
    return this.bookReverseLeg(orderId, "Return");
  }

  replaceShippingOrder(orderId: number): Promise<ReverseShipmentBooking> {
    return this.bookReverseLeg(orderId, "Replace");
  }

  /**
   * Books the courier to collect from the customer and bring the goods back.
   *
   * The order_returns row is written before the courier is called, and kept
   * even when the booking fails: the customer has already been told their
   * return is accepted, so support has to be able to see the request and book
   * the pickup by hand. Never throws for the same reason — the order status is
   * already committed by the time this runs.
   */
  private async bookReverseLeg(
    orderId: number,
    type: ReverseShipmentType,
  ): Promise<ReverseShipmentBooking> {
    let returnId: number | undefined;

    try {
      const order = await this.loadOrder(orderId);
      if (!order) return { created: false, type, skipped: "order_not_found" };

      const address = order.shipping_address;
      if (!address || !address.name) {
        return { created: false, type, skipped: "no_shipping_address" };
      }

      const items = this.orderItems(order);
      if (items.length === 0) return { created: false, type, skipped: "no_items" };

      // The goods come back in the boxes they went out in.
      const boxes = parseShipmentBoxes(order.shipment_boxes);
      if (boxes.length === 0) {
        // Still record the request — a return nobody can book is a support job,
        // not a reason to lose the customer's claim.
        returnId = await this.openReturnRow(orderId, type);
        return { created: false, type, returnId, skipped: "no_shipment_boxes" };
      }

      const existing = await this.existingReverseBooking(orderId, type);
      if (existing?.waybill) {
        return {
          created: false,
          type,
          returnId: existing.id,
          skipped: "already_created",
          partnerOrderId: existing.partner_order_id ?? undefined,
          waybill: existing.waybill,
        };
      }

      // A failed earlier attempt left a row with no waybill; reuse it rather
      // than filling the table with one row per retry.
      // A const as well as the outer let: everything below awaits the courier,
      // and the catch still needs to know whether a row was written.
      const rowId: number = existing?.id ?? (await this.openReturnRow(orderId, type));
      returnId = rowId;

      const result = await ShiprocketClient.createReturnOrder({
        // Shiprocket refuses an order id it has already seen, and the forward
        // leg owns the bare order number.
        orderNumber: `${order.order_number}-RET${returnId}`,
        orderDate: new Date().toISOString(),
        pickup: {
          name: address.name,
          email: address.email,
          phone: address.phone,
          address: address.address_line1,
          address2: address.address_line2,
          city: address.city,
          state: address.state,
          pincode: address.pincode,
          country: address.country || "India",
        },
        destination: this.returnDestination(),
        items,
        boxes,
        subTotal: parseFloat(order.total_amount ?? 0),
      });

      if (!result.success) {
        // The return order can exist at Shiprocket even when the AWB step
        // failed, so its ids are kept: the pickup is then completed from the
        // Shiprocket panel rather than booked a second time.
        if (result.shiprocketOrderId) {
          await this.persistReverseShipment(rowId, {
            partnerOrderId: result.shiprocketOrderId,
            partnerShipmentId: result.shipmentId,
          });
        }

        logger.error({
          message: "Shiprocket reverse pickup booking failed",
          orderId,
          orderNumber: order.order_number,
          type,
          returnId: rowId,
          error: result.error,
        });

        return { created: false, type, returnId: rowId, error: result.error };
      }

      await this.persistReverseShipment(rowId, {
        partnerOrderId: result.shiprocketOrderId!,
        partnerShipmentId: result.shipmentId,
        waybill: result.awbCode,
        courierName: result.courierName,
      });

      logger.info({
        message: "Shiprocket reverse pickup booked",
        orderId,
        type,
        returnId: rowId,
        awb: result.awbCode,
      });

      return {
        created: true,
        type,
        returnId: rowId,
        partnerOrderId: result.shiprocketOrderId,
        partnerShipmentId: result.shipmentId,
        waybill: result.awbCode,
        courierName: result.courierName,
      };
    } catch (error) {
      logger.error({
        message: "Shiprocket reverse booking threw",
        orderId,
        type,
        error,
      });

      // The claim still has to be on file even when this broke before the row
      // was written — a missing warehouse address, say.
      if (!returnId) {
        returnId = await this.openReturnRow(orderId, type).catch(() => undefined);
      }

      return { created: false, type, returnId, error };
    }
  }

  // ============================================================
  // CANCEL
  //
  // An order with no AWB yet is cancelled at the order level; once a courier
  // holds an AWB the shipment has to be cancelled too, or the courier still
  // turns up to collect it.
  // ============================================================
  async cancelShippingOrder(
    input: CancelShipmentInput,
  ): Promise<CancelShipmentResult> {
    if (!input.partnerOrderId && !input.waybill) return { success: true };

    // Cancel the shipment first: an order cancelled while its AWB is still live
    // leaves the courier with a pickup nobody owns.
    let shipmentResult: CancelShipmentResult = { success: true };

    if (input.waybill) {
      shipmentResult = await ShiprocketClient.cancelShipment(input.waybill);
    }

    if (!input.partnerOrderId) return shipmentResult;

    const orderResult = await ShiprocketClient.cancelOrder(input.partnerOrderId);

    return {
      success: orderResult.success && shipmentResult.success,
      message: orderResult.message ?? shipmentResult.message,
      error: orderResult.error ?? shipmentResult.error,
    };
  }

  // ============================================================
  // TRACK
  // ============================================================
  trackShipment(waybill: string): Promise<TrackShipmentResult> {
    return ShiprocketClient.trackShipment(waybill);
  }

  normalizeTrackingHistory(trackingData: any, waybill: string): TrackingEvent[] {
    return ShiprocketClient.normalizeTrackingHistory(trackingData, waybill);
  }

  normalizeWebhookEvents(payload: any): TrackingEvent[] {
    return ShiprocketClient.normalizeWebhookEvents(payload);
  }

  // ============================================================
  // SHARED INTERNALS
  // ============================================================

  /** One read that serves every booking path, so they cannot disagree. */
  private async loadOrder(orderId: number) {
    const { rows, rowCount } = await pool.query(
      `
      SELECT
        o.order_id,
        o.order_number,
        o.payment_method,
        o.payment_status,
        o.order_status,
        o.shipping_partner,
        o.partner_order_id,
        o.partner_shipment_id,
        o.waybill,
        o.shipping_address,
        o.shipment_boxes,
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

    return rowCount === 0 ? null : rows[0];
  }

  private orderItems(order: any): ShiprocketOrderItem[] {
    const rows = (order.items as any[]) ?? [];

    return rows.map((item) => {
      const info = item.variant_info ?? item.product_info ?? {};
      return {
        name: info.product_name ?? info.name ?? "Item",
        sku: info.sku ?? info.slug ?? undefined,
        units: item.quantity,
        sellingPrice: parseFloat(item.price),
      };
    });
  }

  /** Our warehouse, in the shape the client's return payload wants. */
  private returnDestination() {
    const warehouse = warehouseAddress();

    return {
      name: warehouse.name,
      email: warehouse.email,
      phone: warehouse.phone,
      address: warehouse.addressLine1,
      address2: warehouse.addressLine2,
      city: warehouse.city,
      state: warehouse.state,
      pincode: warehouse.pincode,
      country: warehouse.country,
    };
  }

  // COALESCE on every optional column so a partial write — ids now, AWB on the
  // retry — never blanks out what an earlier attempt already stored.
  private async persistForwardShipment(
    orderId: number,
    data: {
      partnerOrderId: string;
      partnerShipmentId?: string;
      waybill?: string;
      courierName?: string;
    },
  ) {
    await pool.query(
      `
      UPDATE orders
      SET shipping_partner     = $1,
          partner_order_id     = $2,
          partner_shipment_id  = COALESCE($3, partner_shipment_id),
          waybill              = COALESCE($4, waybill),
          courier_name         = COALESCE($5, courier_name),
          updated_at           = CURRENT_TIMESTAMP
      WHERE order_id = $6
      `,
      [
        this.name,
        data.partnerOrderId,
        data.partnerShipmentId ?? null,
        data.waybill ?? null,
        data.courierName ?? null,
        orderId,
      ],
    );

    if (data.waybill) {
      await pool.query("UPDATE order_items SET waybill = $1 WHERE order_id = $2", [
        data.waybill,
        orderId,
      ]);
    }
  }

  /** The claim on file, before the courier is called. */
  private async openReturnRow(
    orderId: number,
    type: ReverseShipmentType,
  ): Promise<number> {
    const { rows } = await pool.query(
      `
      INSERT INTO order_returns (order_id, type, shipping_partner)
      VALUES ($1, $2, $3)
      RETURNING id
      `,
      [orderId, type, this.name],
    );

    return rows[0].id;
  }

  private async existingReverseBooking(
    orderId: number,
    type: ReverseShipmentType,
  ) {
    const { rows } = await pool.query(
      `
      SELECT id, waybill, partner_order_id
      FROM order_returns
      WHERE order_id = $1 AND type = $2
      ORDER BY id DESC
      LIMIT 1
      `,
      [orderId, type],
    );

    return rows[0];
  }

  private async persistReverseShipment(
    returnId: number,
    data: {
      partnerOrderId: string;
      partnerShipmentId?: string;
      waybill?: string;
      courierName?: string;
    },
  ) {
    await pool.query(
      `
      UPDATE order_returns
      SET shipping_partner     = $1,
          partner_order_id     = $2,
          partner_shipment_id  = COALESCE($3, partner_shipment_id),
          waybill              = COALESCE($4, waybill),
          courier_name         = COALESCE($5, courier_name),
          updated_at           = CURRENT_TIMESTAMP
      WHERE id = $6
      `,
      [
        this.name,
        data.partnerOrderId,
        data.partnerShipmentId ?? null,
        data.waybill ?? null,
        data.courierName ?? null,
        returnId,
      ],
    );
  }

  private async persistReplacementShipment(
    returnId: number,
    data: {
      partnerOrderId: string;
      partnerShipmentId?: string;
      waybill?: string;
      courierName?: string;
    },
  ) {
    await pool.query(
      `
      UPDATE order_returns
      SET replacement_partner_order_id    = $1,
          replacement_partner_shipment_id = COALESCE($2, replacement_partner_shipment_id),
          replacement_waybill             = COALESCE($3, replacement_waybill),
          replacement_courier_name        = COALESCE($4, replacement_courier_name),
          updated_at                      = CURRENT_TIMESTAMP
      WHERE id = $5
      `,
      [
        data.partnerOrderId,
        data.partnerShipmentId ?? null,
        data.waybill ?? null,
        data.courierName ?? null,
        returnId,
      ],
    );
  }
}
