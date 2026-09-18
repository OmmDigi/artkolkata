import { PoolClient } from "pg";
import { pool } from "..";
import { doTransition } from "./doTransition";
import logger from "./logger";
import { PaymentEvent, PaymentStatus } from "../services/payment/payment.gateway";
import { notifyOrderReceived } from "./orderEmails";

/**
 * The single writer for gateway-reported payment state.
 *
 * Both the webhook and the status poll end up here, so a payment is recorded
 * the same way no matter which one arrives first — and a gateway that sends
 * the same event twice (all of them retry) does not produce two different
 * outcomes.
 */

// How far along a status is. A notification may only move a payment forward:
// gateways retry out of order, and the status page can be refreshed long after
// a refund, so a late PAID must never undo a REFUNDED row and a late FAILED
// must never undo a PAID one.
const STATUS_RANK: Record<PaymentStatus, number> = {
  PENDING: 0,
  FAILED: 1,
  PAID: 2,
  REFUNDED: 3,
};

export interface RecordPaymentResult {
  updated: boolean;
  orderId: number | null;
  /** Why nothing was written, when nothing was. */
  skipped?: "no_payment_row" | "not_newer";
}

export const recordPaymentEvent = async (
  event: PaymentEvent,
  pgClient?: PoolClient,
): Promise<RecordPaymentResult> => {
  const result: RecordPaymentResult = { updated: false, orderId: null };

  await doTransition(async (client) => {
    // FOR UPDATE: two webhooks for the same order can land on two connections
    // at once, and without the lock both would read the old status and both
    // would decide they are newer.
    const { rows, rowCount } = await client.query(
      `SELECT payment_id, order_id, status
         FROM payments
        WHERE provider_order_id = $1
        FOR UPDATE`,
      [event.providerOrderId],
    );

    if (rowCount === 0) {
      result.skipped = "no_payment_row";
      logger.error({
        message: "recordPaymentEvent found no payments row",
        providerOrderId: event.providerOrderId,
        status: event.status,
      });
      return;
    }

    const row = rows[0];
    result.orderId = row.order_id;

    const current = (row.status ?? "PENDING") as PaymentStatus;

    if (STATUS_RANK[event.status] <= (STATUS_RANK[current] ?? 0)) {
      result.skipped = "not_newer";
      return;
    }

    const instrument = event.instrument;

    // COALESCE on all three: a refund notification, and a status poll taken
    // before the customer picked anything, carry no instrument at all. Writing
    // their null would erase how the order was actually paid.
    await client.query(
      `UPDATE payments
          SET provider_payment_id = COALESCE($1, provider_payment_id),
              status = $2,
              response = $3,
              payment_instrument = COALESCE($4, payment_instrument),
              instrument_label = COALESCE($5, instrument_label),
              instrument_detail = COALESCE($6::jsonb, instrument_detail),
              created_at = $7::timestamp
        WHERE payment_id = $8`,
      [
        event.providerPaymentId,
        event.status,
        JSON.stringify(event.raw ?? {}),
        instrument?.type ?? null,
        instrument?.label ?? null,
        instrument ? JSON.stringify(instrument) : null,
        event.occurredAt.toISOString(),
        row.payment_id,
      ],
    );

    // Only payment_status moves. order_status is about where the goods are —
    // a refund says where the money went, not that anything shipped back.
    await client.query(
      "UPDATE orders SET payment_status = $1 WHERE order_id = $2",
      [event.status, row.order_id],
    );

    result.updated = true;
  }, pgClient);

  // A prepaid order is only really placed once the money arrives, so this is
  // where its "we have your order" email belongs — not checkout, which an
  // abandoned payment also reaches. COD orders send theirs from createOrder.
  //
  // `updated` is what keeps this to the one event that actually moved the
  // payment to PAID: a gateway retrying its webhook, or the customer
  // refreshing the status page, is ranked as not-newer and writes nothing.
  // order_email_log is the second guard, for the two that race.
  if (result.updated && result.orderId && event.status === "PAID")
    notifyOrderReceived(result.orderId);

  return result;
};

export interface PaymentRow {
  payment_id: number;
  order_id: number;
  provider: string | null;
  provider_order_id: string | null;
  provider_payment_id: string | null;
  amount: string;
  status: PaymentStatus | null;
  /** UPI, CARD, NETBANKING … — how the customer actually paid. */
  payment_instrument: string | null;
  /** The same, worded for a human. */
  instrument_label: string | null;
}

/**
 * The payments row for an order, which is what a refund needs before it can
 * name anything to the gateway.
 */
export const findPaymentByOrderId = async (
  orderRowId: number,
): Promise<PaymentRow | null> => {
  const { rows, rowCount } = await pool.query(
    `SELECT payment_id, order_id, provider, provider_order_id,
            provider_payment_id, amount, status,
            payment_instrument, instrument_label
       FROM payments
      WHERE order_id = $1
      ORDER BY payment_id DESC
      LIMIT 1`,
    [orderRowId],
  );

  return rowCount === 0 ? null : (rows[0] as PaymentRow);
};

/** Marks a payment refunded once the gateway has confirmed it settled. */
export const markPaymentRefunded = async (
  paymentId: number,
  orderRowId: number,
  providerRefundId: string | null,
  raw: unknown,
) => {
  await doTransition(async (client) => {
    await client.query(
      `UPDATE payments
          SET status = 'REFUNDED',
              provider_payment_id = COALESCE($1, provider_payment_id),
              response = $2
        WHERE payment_id = $3`,
      [providerRefundId, JSON.stringify(raw ?? {}), paymentId],
    );

    await client.query(
      "UPDATE orders SET payment_status = 'REFUNDED' WHERE order_id = $1",
      [orderRowId],
    );
  });
};

export interface SaveRefundDetailsInput {
  paymentId: number;
  orderRowId: number;
  /** Rupees refunded by this one action, not the running total. */
  amount: number;
  note: string;
  /** users.id of the admin who decided it. */
  adminUserId: number | null;
  /** false when an admin settled it in the gateway's own portal. */
  viaGateway: boolean;
  /**
   * Whether to mark the payment REFUNDED here and now. False when the gateway
   * has yet to confirm — PhonePe answers PENDING and settles over the webhook,
   * so claiming the money is back before it is would be a lie the CMS repeats.
   */
  settle: boolean;
}

/**
 * Records who refunded what, and why.
 *
 * refunded_amount accumulates, so two partial refunds on one order add up
 * instead of the second erasing the first.
 */
export const saveRefundDetails = async ({
  paymentId,
  orderRowId,
  amount,
  note,
  adminUserId,
  viaGateway,
  settle,
}: SaveRefundDetailsInput) => {
  await doTransition(async (client) => {
    await client.query(
      `UPDATE payments
          SET refunded_amount = COALESCE(refunded_amount, 0) + $1,
              refund_note = $2,
              refunded_by = $3,
              refunded_at = CURRENT_TIMESTAMP,
              refunded_via_gateway = $4,
              status = CASE WHEN $5 THEN 'REFUNDED' ELSE status END
        WHERE payment_id = $6`,
      [amount, note, adminUserId, viaGateway, settle, paymentId],
    );

    if (settle)
      await client.query(
        "UPDATE orders SET payment_status = 'REFUNDED' WHERE order_id = $1",
        [orderRowId],
      );
  });
};

export interface RefundableOrder {
  payment: PaymentRow & {
    refunded_amount: string | null;
    payment_method: string | null;
    order_total: string;
  };
  /** Rupees still available to refund. */
  remaining: number;
}

/**
 * What the refund dialog and the refund endpoint both need to know before
 * anything is decided: is there a payment, was it actually paid, and how much
 * of it is still refundable.
 */
export const getRefundableOrder = async (
  orderRowId: number,
): Promise<RefundableOrder | null> => {
  const { rows, rowCount } = await pool.query(
    `SELECT p.payment_id, p.order_id, p.provider, p.provider_order_id,
            p.provider_payment_id, p.amount, p.status, p.refunded_amount,
            p.payment_instrument, p.instrument_label,
            o.payment_method, o.total_amount AS order_total
       FROM payments p
       JOIN orders o ON o.order_id = p.order_id
      WHERE p.order_id = $1
      ORDER BY p.payment_id DESC
      LIMIT 1`,
    [orderRowId],
  );

  if (rowCount === 0) return null;

  const payment = rows[0];

  // The payments row carries what was actually charged; the order total is
  // only a fallback for a row written before the amount was recorded.
  const paid = parseFloat(payment.amount ?? payment.order_total ?? "0");
  const alreadyRefunded = parseFloat(payment.refunded_amount ?? "0");

  return {
    payment,
    // Rounded because money is not binary: 199.90 - 0.1 * 3 must not leave a
    // tenth of a paisa of "remaining" that then fails the ceiling check.
    remaining: Math.round((paid - alreadyRefunded) * 100) / 100,
  };
};
