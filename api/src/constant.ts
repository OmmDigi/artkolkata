import { RoteIds } from "./types";

export const COOKIE_KEY = "refreshToken";

// The CMS sidebar route id of the Orders screen (see SIDEBAR_OPTIONS in the
// cms). A staff member holding this key in user_permissions.permissions is the
// one who works on orders, so it is also who gets the new order alert email.
export const ORDERS_PERMISSION_ID: RoteIds = "1-5";

// GST is baked into every product price, so this rate is only ever used to show
// the customer how much of what they already pay is tax. It is deliberately a
// constant : the CMS has no GST setting anymore.
export const GST_PERCENTAGE = parseInt(process.env.GST_PERCENTAGE ?? "5");

// Delivery is no longer a constant. It comes from the shipping_charge_rules
// slabs the CMS edits — see calculateShippingCharge. An empty table means free.

export const RETURN_INITIATED = "RETURN INITIATED";
export const ORDER_PENDING = "PENDING";
export const ORDER_CONFIRMED = "CONFIRMED";
export const ORDER_PACKED = "PACKED";
export const ORDER_SHIPPED = "SHIPPED";
export const ORDER_DELIVERED = "DELIVERED";
export const ORDER_CANCELLED = "CANCELLED";
export const ORDER_RETURNED = "RETURNED";
export const ORDER_RETURN_INITIATED = RETURN_INITIATED;
// export const ORDER_RETURN_CANCELLED = "RETURN CANCELLED";
export const OUT_FOR_DELIVERY = "OUT FOR DELIVERY";
export const REPLACE_INITIATED = "REPLACE INITIATED";
export const REPLACED = "REPLACED";

/**
 * Every status an order is allowed to hold.
 *
 * One list so the admin status endpoint and the flows that write a status by
 * raw SQL — the courier webhook, the return flow — cannot disagree about what
 * is a legal status. Adding a status means adding it here, and the CMS
 * dropdown (ORDER_STATUS in the cms constants) should mirror it.
 */
export const ORDER_STATUSES = [
  ORDER_PENDING,
  ORDER_CONFIRMED,
  ORDER_PACKED,
  ORDER_SHIPPED,
  OUT_FOR_DELIVERY,
  ORDER_DELIVERED,
  ORDER_CANCELLED,
  ORDER_RETURN_INITIATED,
  ORDER_RETURNED,
  REPLACE_INITIATED,
  REPLACED,
] as const;

/**
 * How long after delivery a customer may still ask to return an order.
 *
 * Lives here because two places have to agree on it: the query that decides
 * whether a return request is still allowed, and the delivered email that tells
 * the customer how long they have.
 */
export const RETURN_WINDOW_DAYS = 7;

export const REVIEW_STATUS_NOT_APPROVED = 1;
export const REVIEW_STATUS_APPROVED = 2;

// Storefront "what customers say" feed: only the good, approved reviews, newest first.
export const TOP_REVIEW_MIN_STARS = 4;
export const TOP_REVIEW_LIMIT = 20;
export const TOP_REVIEW_MAX_LIMIT = 50;

export const PRODUCT_STATUS_PUBLIC = 1; // 2 is private

export const ONLINE_PAYMENT = "ONLINE";
export const COD_PAYMENT = "COD";

// const statusMap = {
//   // Forward Shipment (UD)
//   "UD_Manifested": "order_placed",
//   "UD_Not Picked": "packed",
//   "UD_In Transit": "shipped",
//   "UD_Pending": "shipped",
//   "UD_Dispatched": "out_for_delivery",
//   "DL_Delivered": "delivered",

//   // Return Shipment (RT)
//   "RT_In Transit": "return_in_transit",
//   "RT_Pending": "return_in_transit",
//   "RT_Dispatched": "return_in_transit",
//   "DL_RTO": "returned_to_origin",

//   // Reverse Shipment (PP, PU)
//   "PP_Open": "return_initiated",
//   "PP_Scheduled": "return_initiated",
//   "PP_Dispatched": "return_in_transit",
//   "PU_In Transit": "return_in_transit",
//   "PU_Pending": "return_in_transit",
//   "PU_Dispatched": "return_in_transit",
//   "DL_DTO": "delivered",

//   // Cancelled
//   "CN_Canceled": "cancelled",
//   "CN_Closed": "cancelled",
// };

export const SHIPMENT_MAPING : Record<string, string> = {
  // Forward Shipment (UD)
  UD_Manifested: ORDER_CONFIRMED,
  "UD_Not Picked": ORDER_CONFIRMED,
  "UD_In Transit": ORDER_SHIPPED,
  UD_Pending: ORDER_SHIPPED,
  UD_Dispatched: OUT_FOR_DELIVERY,
  DL_Delivered: ORDER_DELIVERED,

  // Return Shipment (RT)
  "RT_In Transit": ORDER_CANCELLED,
  RT_Pending: ORDER_CANCELLED,
  RT_Dispatched: ORDER_CANCELLED,
  DL_RTO: ORDER_CANCELLED,

  // return maping
  PP_Open: ORDER_RETURN_INITIATED,
  PP_Scheduled: ORDER_RETURN_INITIATED,
  PP_Dispatched: ORDER_RETURN_INITIATED,
  "PU_In Transit": ORDER_RETURN_INITIATED,
  PU_Pending: ORDER_RETURN_INITIATED,
  PU_Dispatched: ORDER_RETURN_INITIATED,
  DL_DTO: ORDER_RETURNED,
  
  CN_Canceled: ORDER_CANCELLED,
  CN_Closed: ORDER_RETURNED,
};

/**
 * Who wrote a webhook_data row: a courier, or an order status change here.
 * Mirrors webhook_data.source — see config/database.sql.
 */
export type TrackingScanSource = "courier" | "admin";

/**
 * What a status is called on the customer's tracking page.
 *
 * Only the two that read badly as a bare status are here. Everything else is
 * shown exactly as it is stored, so a status added to ORDER_STATUSES turns up
 * on the tracking page without anything else having to be edited.
 */
export const TRACK_STEP_LABEL: Record<string, string> = {
  [ORDER_PENDING]: "ORDER PLACED",
  [ORDER_CONFIRMED]: "ORDER CONFIRMED",
};

/**
 * How far along the forward journey a status is.
 *
 * Only the forward leg is ranked — cancelled, returned and replaced are not
 * further along anything, they are somewhere else, and they are already
 * protected from courier scans by COURIER_PROTECTED_STATUSES.
 *
 * Two places need it: the tracking pull, which refuses to walk an order
 * backwards on a stale scan, and the tracking page, which works out which
 * steps are still to come from wherever the order has got to.
 */
export const ORDER_FLOW_RANK: Record<string, number> = {
  [ORDER_PENDING]: 0,
  [ORDER_CONFIRMED]: 1,
  [ORDER_PACKED]: 2,
  [ORDER_SHIPPED]: 3,
  [OUT_FOR_DELIVERY]: 4,
  [ORDER_DELIVERED]: 5,
};

// export const SHIPMENT_MAPING : Record<string, string> = {
//   UD_Manifested: ORDER_CONFIRMED,
//   "UD_Not Picked": ORDER_CONFIRMED,
//   "UD_In Transit": ORDER_SHIPPED,
//   UD_Pending: ORDER_SHIPPED,
//   UD_Dispatched: OUT_FOR_DELIVERY,
//   DL_Delivered: ORDER_DELIVERED,

//   // cancel maping
//   "RT_In Transit": ORDER_CANCELLED,
//   RT_Pending: ORDER_CANCELLED,
//   RT_Dispatched: ORDER_CANCELLED,
//   DL_RTO: ORDER_CANCELLED,

//   // return maping
//   PP_Open: ORDER_RETURN_INITIATED,
//   PP_Scheduled: ORDER_RETURN_INITIATED,
//   PP_Dispatched: ORDER_RETURN_INITIATED,
//   "PU_In Transit": ORDER_RETURN_INITIATED,
//   PU_Pending: ORDER_RETURN_INITIATED,
//   PU_Dispatched: ORDER_RETURN_INITIATED,
//   DL_DTO: ORDER_RETURN_INITIATED,
  
//   CN_Canceled: ORDER_CANCELLED,
//   CN_Closed: ORDER_RETURNED,
// };

// Statuses a courier scan must never overwrite.
//
// The tracking sync and the webhooks both write order_status from the newest
// scan. A returned or cancelled order still carries its old forward-leg
// scans — the newest of which is usually "Delivered" — so without this guard
// re-reading the tracking page would quietly flip a return back to DELIVERED
// and lose the customer's request. These states are set by a person (the
// customer returning, an admin cancelling) and only a person moves them on.
export const COURIER_PROTECTED_STATUSES = [
  ORDER_CANCELLED,
  ORDER_RETURNED,
  ORDER_RETURN_INITIATED,
  REPLACE_INITIATED,
  REPLACED,
];

// ============================================================
// DASHBOARD ANALYTICS
// ============================================================

/**
 * The zone the dashboard reports in. Every KPI window ("Today", "Last 7 days")
 * is a calendar window in this zone, so an order placed at 11pm IST belongs to
 * that day and not to the next UTC one.
 */
export const REPORTING_TIMEZONE = "Asia/Kolkata";

/**
 * There is deliberately no STORAGE_TIMEZONE constant next to this one.
 *
 * The timestamp columns are bare TIMESTAMPs written by NOW(), so what sits in
 * them is the database server's own wall clock with no offset recorded. That
 * clock is not the same everywhere: the compose container runs UTC, a
 * developer's local postgres here runs Asia/Kolkata. A constant guessing one
 * of them silently shifts every dashboard number by five and a half hours on
 * the other.
 *
 * So the analytics queries ask postgres instead — window bounds arrive as
 * timestamptz and are converted with `AT TIME ZONE current_setting('TimeZone')`,
 * which is by definition the frame NOW() wrote in. current_setting is STABLE,
 * so the bound is still computed once per query and the index still gets used.
 */

/**
 * An order in one of these never happened as far as revenue is concerned: the
 * money went back or never arrived. Everything else counts, including a COD
 * order that has not been paid yet and an order whose return is only
 * initiated, because neither has actually reversed.
 *
 * order_items carries its own status for the case where one line of an order
 * is cancelled on its own, so the same list filters both.
 */
export const NON_REVENUE_ORDER_STATUSES = [ORDER_CANCELLED, ORDER_RETURNED];

/** how many rows /analytics/top-products returns when the caller says nothing */
export const TOP_PRODUCTS_DEFAULT_LIMIT = 10;
export const TOP_PRODUCTS_MAX_LIMIT = 50;

/**
 * Most invoices one bulk download merges into a single pdf. The merged file is
 * built in memory, so this is what bounds it; the CMS splits a bigger
 * selection into parts of this size.
 */
export const MAX_BULK_INVOICES = 100;
