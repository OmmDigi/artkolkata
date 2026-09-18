/**
 * The one place that says what a shipping partner is.
 *
 * Everything above this file — the order controller, the checkout price
 * breakdown, the tracking webhook — talks to IShippingPartner and never to
 * Shiprocket or Bigship directly. Adding a partner means writing one more
 * implementation and registering it in ./index.ts; no call site changes.
 *
 * Deliberately mirrors services/payment: one interface, one registry, one
 * active instance built at boot from an env var.
 */

/**
 * "none" is a real partner, not the absence of one: the shop books its own
 * courier and this system only tracks the order. See ./none.partner.ts.
 */
export type ShippingPartnerName = "shiprocket" | "bigship" | "none";

/**
 * Which leg of the journey a booking is for.
 *
 * "forward"     — the original parcel going out to the customer.
 * "replacement" — the fresh parcel sent out after a Replace, booked once the
 *                 returned goods are back at the warehouse. It is a second
 *                 forward shipment against the same order, so it cannot be
 *                 stored in the order's own shipment columns.
 */
export type ShipmentLeg = "forward" | "replacement";

/** Return = goods come back and are refunded. Replace = goods come back and a new parcel goes out. */
export type ReverseShipmentType = "Return" | "Replace";

// ============================================================
// CHECK
// ============================================================

export interface ShipmentCheckInput {
  /** Destination pincode. The origin is the partner's own configured warehouse. */
  pincode: string;
  /** Kilograms. Volumetric weight is priced off the dimensions below. */
  weight?: number;
  /** Declared value, rupees — couriers price and insure on it. */
  invoiceValue?: number;
  /** COD parcels are not serviceable everywhere a prepaid one is. */
  cod?: boolean;
  /** Centimetres. Left out, the partner quotes against its own default box. */
  dimensions?: { length: number; breadth: number; height: number };
}

/**
 * One quote, from the courier the partner would actually book with — its
 * recommendation when it makes one, the cheapest otherwise.
 *
 * `success` is about the API call, `serviceable` about the pincode. They are
 * separate on purpose: a partner that is down must not read as "we do not
 * deliver there", which would block a customer from ordering.
 */
export interface ShipmentCheck {
  success: boolean;
  serviceable: boolean;
  shippingCharge?: number;
  courierId?: number;
  courierName?: string;
  codAvailable?: boolean;
  estimatedDays?: number;
  error?: any;
}

// ============================================================
// BOOK
// ============================================================

/**
 * Why a booking did not happen. Not an error — every one of these is a state
 * the order is legitimately in, and the caller turns it into a message for the
 * admin. A partner may only return reasons from this list.
 */
export type ShipmentSkipReason =
  | "already_created"
  | "order_not_found"
  | "no_items"
  | "no_shipping_address"
  | "no_shipment_boxes"
  | "ewaybill_required"
  | "payment_not_completed"
  | "not_supported"
  | "no_return_record"
  | "order_not_returnable";

export interface ShipmentBooking {
  created: boolean;
  /** Whichever id the partner keys the booking off. Stored on the order. */
  partnerOrderId?: string;
  /** The partner's shipment id, where it keeps one separately from the order id. */
  partnerShipmentId?: string;
  /** The tracking number. Everything downstream — webhooks, the tracking page — matches on it. */
  waybill?: string;
  courierName?: string;
  skipped?: ShipmentSkipReason;
  error?: any;
}

/** A reverse booking, plus the order_returns row it was recorded against. */
export interface ReverseShipmentBooking extends ShipmentBooking {
  returnId?: number;
  type?: ReverseShipmentType;
}

// ============================================================
// CANCEL
// ============================================================

export interface CancelShipmentInput {
  waybill?: string | null;
  partnerOrderId?: string | null;
}

export interface CancelShipmentResult {
  success: boolean;
  message?: string;
  error?: any;
}

// ============================================================
// TRACK
// ============================================================

export interface TrackShipmentResult {
  success: boolean;
  /** The partner's own payload, handed straight back to normalizeTrackingHistory. */
  trackingData?: any;
  error?: any;
}

/**
 * One courier scan, in the shape webhook_data has always stored.
 *
 * It is Delhivery's { StatusType, Status } pair because that is what the
 * webhook_data table, SHIPMENT_MAPING and the trackOrder query were built
 * around. Every partner translates into it, so nothing downstream of this
 * interface knows which courier produced a scan.
 */
export interface TrackingEvent {
  Shipment: {
    AWB: string;
    Status: {
      Status: string;
      StatusType: string;
      StatusDateTime: string;
      StatusLocation: string;
      Instructions: string;
    };
  };
}

// ============================================================
// THE INTERFACE
// ============================================================

export interface IShippingPartner {
  readonly name: ShippingPartnerName;
  /** Human-readable, shown in the CMS and written to orders.shipping_partner's label. */
  readonly label: string;

  /**
   * Can this parcel be delivered, and what would it cost us?
   *
   * Read-only: nothing is booked and no order has to exist. Used at checkout,
   * where a failure must never block the sale — check `success` before you
   * believe `serviceable`.
   */
  checkShipment(input: ShipmentCheckInput): Promise<ShipmentCheck>;

  /**
   * Books the parcel for an order that already exists in our database, and
   * stores the ids it comes back with.
   *
   * Idempotent for the forward leg: an order already carrying a partner order
   * id is left alone, so a failed confirm can be retried without booking the
   * same parcel twice. Never throws — a courier being down must not roll back
   * the order status that was already committed, so failures come back as
   * `created: false` with `error` or `skipped` set.
   */
  createShippingOrder(
    orderId: number,
    options?: { leg?: ShipmentLeg },
  ): Promise<ShipmentBooking>;

  /**
   * Books the reverse pickup for a Return: the courier collects from the
   * customer and brings the goods back to the warehouse. Records the pickup in
   * order_returns, with or without a waybill, so support can always see the
   * request even when the courier refused it.
   */
  returnShippingOrder(orderId: number): Promise<ReverseShipmentBooking>;

  /**
   * Same reverse pickup, for a Replace.
   *
   * Only the collection is booked here. The replacement parcel goes out as a
   * second forward shipment — createShippingOrder(orderId, { leg: "replacement" })
   * — once the returned goods are actually back, so nothing ships against a
   * return that never arrives.
   */
  replaceShippingOrder(orderId: number): Promise<ReverseShipmentBooking>;

  /**
   * Cancels a booked parcel with the courier. Called after our own status is
   * already committed, so it reports failure rather than throwing: a parcel
   * still moving against a cancelled order is a support job, not a 500.
   */
  cancelShippingOrder(input: CancelShipmentInput): Promise<CancelShipmentResult>;

  /** Asks the courier where a waybill stands right now. */
  trackShipment(waybill: string): Promise<TrackShipmentResult>;

  /** Flattens a trackShipment() payload into scans, oldest first. */
  normalizeTrackingHistory(trackingData: any, waybill: string): TrackingEvent[];

  /** Flattens a tracking webhook push into the same scans, oldest first. */
  normalizeWebhookEvents(payload: any): TrackingEvent[];
}
