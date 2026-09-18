import { pool } from "../..";
import {
  CancelShipmentInput,
  CancelShipmentResult,
  IShippingPartner,
  ReverseShipmentBooking,
  ReverseShipmentType,
  ShipmentBooking,
  ShipmentCheck,
  ShipmentCheckInput,
  TrackingEvent,
  TrackShipmentResult,
} from "./shipping.partner";

/**
 * The partner for a shop that books its own courier.
 *
 * Selected with SHIPPING_PARTNER=none. Nothing here talks to a network: an
 * order is confirmed, cancelled, returned and delivered entirely through the
 * CMS, and whoever actually ships the parcel does it outside this system.
 *
 * It exists as a partner rather than as a null check scattered through the
 * controllers so that getShippingPartner() never returns null and no call site
 * has to ask whether shipping is on before it can talk to it. The few places
 * that must word their response differently ask isShippingEnabled() instead —
 * see ./index.ts.
 */
export class NonePartner implements IShippingPartner {
  readonly name = "none" as const;
  readonly label = "No shipping partner";

  // ============================================================
  // CHECK
  // ============================================================

  /**
   * Every pincode is serviceable.
   *
   * `success` is true on purpose: a false would be read as "the partner is
   * down" and logged as an error on every single checkout. There is no partner
   * to be down — the answer is a real one, and it is yes.
   */
  async checkShipment(_input: ShipmentCheckInput): Promise<ShipmentCheck> {
    return {
      success: true,
      serviceable: true,
      shippingCharge: 0,
      codAvailable: true,
    };
  }

  // ============================================================
  // BOOK
  // ============================================================

  /**
   * Nothing is booked, ever. The callers that move an order's status check
   * isShippingEnabled() first and never reach this, so a `not_supported` here
   * is the answer to a caller that did not — a plain fact, not a failure.
   */
  async createShippingOrder(): Promise<ShipmentBooking> {
    return { created: false, skipped: "not_supported" };
  }

  // ============================================================
  // REVERSE
  //
  // No courier is booked, but the claim is still recorded. doReturn has
  // already told the customer their return is accepted, and support needs the
  // request on file to arrange the pickup by hand — the same reason the real
  // partners keep a row when a booking fails.
  // ============================================================

  returnShippingOrder(orderId: number): Promise<ReverseShipmentBooking> {
    return this.recordReverseLeg(orderId, "Return");
  }

  replaceShippingOrder(orderId: number): Promise<ReverseShipmentBooking> {
    return this.recordReverseLeg(orderId, "Replace");
  }

  private async recordReverseLeg(
    orderId: number,
    type: ReverseShipmentType,
  ): Promise<ReverseShipmentBooking> {
    // One row per order and type. A customer who raises the same return twice
    // must not end up with two claims for support to reconcile.
    const { rows } = await pool.query(
      `
      SELECT id
      FROM order_returns
      WHERE order_id = $1 AND type = $2
      ORDER BY id DESC
      LIMIT 1
      `,
      [orderId, type],
    );

    if (rows[0]) {
      return {
        created: false,
        type,
        returnId: rows[0].id,
        skipped: "already_created",
      };
    }

    const inserted = await pool.query(
      `
      INSERT INTO order_returns (order_id, type, shipping_partner)
      VALUES ($1, $2, $3)
      RETURNING id
      `,
      [orderId, type, this.name],
    );

    return {
      created: false,
      type,
      returnId: inserted.rows[0].id,
      skipped: "not_supported",
    };
  }

  // ============================================================
  // CANCEL / TRACK
  // ============================================================

  /**
   * Succeeds because there is nothing to cancel. Reporting a failure would
   * hand the admin a "cancel it in the courier panel" warning about a courier
   * panel that does not exist.
   */
  async cancelShippingOrder(
    _input: CancelShipmentInput,
  ): Promise<CancelShipmentResult> {
    return { success: true, message: "No shipping partner configured" };
  }

  /**
   * No waybill is ever written with this partner, so there is nothing to ask
   * about. `success: false` with no data leaves the tracking page showing the
   * order's own status history, which is all there is.
   */
  async trackShipment(_waybill: string): Promise<TrackShipmentResult> {
    return { success: false };
  }

  normalizeTrackingHistory(): TrackingEvent[] {
    return [];
  }

  normalizeWebhookEvents(): TrackingEvent[] {
    return [];
  }
}
