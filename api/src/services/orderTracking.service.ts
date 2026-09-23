import { PoolClient } from "pg";
import { pool } from "..";
import { TrackingScanSource } from "../constant";
import logger from "../utils/logger";

/**
 * The tracking page, for the orders no courier talks about.
 *
 * webhook_data is the only thing trackOrder reads, and until now only a
 * courier ever wrote to it. Shiprocket pushes a webhook, so its orders were
 * fine; Bigship pushes nothing at all and SHIPPING_PARTNER=none has no courier
 * to push anything, so those orders showed the customer a tracking page with
 * one step on it — "ORDER PLACED" — no matter how far the order had actually
 * got.
 *
 * So the status change writes its own event. webhook_data is an append-only
 * log of everything that happened to an order, in the order it happened, and
 * the tracking page is that log read back — a courier scan and an admin
 * pressing Save are the same kind of row, distinguished only by `source`.
 *
 * The event carries the order status itself, in `order_status`. Nothing is
 * translated on read: a courier scan is mapped through SHIPMENT_MAPING once,
 * when it is stored, and an admin change is stored as the status it set.
 */

const ADMIN: TrackingScanSource = "admin";

interface RecordScanInput {
  orderId: number;
  /** One of ORDER_STATUSES — stored as-is and shown as-is. */
  status: string;
  /** Free text shown under the step on the tracking page. */
  instructions?: string | null;
  /**
   * The transaction the status was written in, when there is one. Passing it
   * keeps the event and the status change atomic: an order can never commit a
   * status whose event rolled back, or the other way round.
   */
  client?: PoolClient;
}

/**
 * When an event happened, as a UTC timestamp string the database can store.
 *
 * Couriers report their own scan times and those are what the page must show —
 * not when we happened to receive them. A time that cannot be read falls back
 * to now, because a row that refuses to insert loses the event entirely.
 */
export const eventTimestamp = (reported?: string | null): string => {
  const parsed = reported ? Date.parse(reported) : NaN;
  return new Date(Number.isNaN(parsed) ? Date.now() : parsed).toISOString();
};

/**
 * Append the event for a status change.
 *
 * A status that is already the order's latest event is not written again, so
 * an admin pressing Save twice does not stack the same step twice. Anything
 * else is appended, including a status the order has held before: an order
 * that is delivered, returned and then shipped again really did ship twice,
 * and the page is a history, not a checklist.
 *
 * It never throws, because the status change is the real work and a tracking
 * row is not worth rolling it back for — except when it is handed a
 * transaction client, where throwing is the caller's own transaction failing
 * and swallowing the error would leave the client in a failed state anyway.
 */
export const recordStatusScan = async ({
  orderId,
  status,
  instructions,
  client,
}: RecordScanInput): Promise<void> => {
  const db = client ?? pool;

  try {
    const order = await db.query(
      "SELECT waybill FROM orders WHERE order_id = $1",
      [orderId],
    );

    if (order.rowCount === 0) return;

    // Stored when the order has one, so this event sits with the courier's own
    // rows for the same parcel. An order shipped by hand has none, and
    // order_id is what the tracking page matches on instead.
    const waybill: string | null = order.rows[0].waybill ?? null;

    const latest = await db.query(
      `
       SELECT order_status
       FROM webhook_data
       WHERE (order_id = $1 OR ($2::text IS NOT NULL AND waybill = $2))
         AND order_status IS NOT NULL
       ORDER BY event_at DESC, id DESC
       LIMIT 1
      `,
      [orderId, waybill],
    );

    // Nothing changed, so nothing happened.
    if (latest.rows[0]?.order_status === status) return;

    const now = new Date().toISOString();

    // Shaped like a courier scan so the tracking page reads location and
    // instructions out of one place for every row, whoever wrote it.
    const payload = {
      Shipment: {
        AWB: waybill ?? "",
        Status: {
          Status: status,
          StatusType: "ADMIN",
          StatusDateTime: now,
          StatusLocation: "",
          Instructions: instructions ?? "",
        },
      },
    };

    await db.query(
      `
       INSERT INTO webhook_data (waybill, order_id, source, order_status, event_at, payload)
       VALUES ($1, $2, '${ADMIN}', $3, $4, $5)
      `,
      [waybill, orderId, status, now, payload],
    );
  } catch (error) {
    // Inside someone else's transaction the failure is already theirs: the
    // client is in a failed state and the next query would fail anyway, so it
    // goes back up rather than leaving a half-written transition.
    if (client) throw error;

    logger.error({
      message: "Unable to record the order status event",
      orderId,
      status,
      error,
    });
  }
};
