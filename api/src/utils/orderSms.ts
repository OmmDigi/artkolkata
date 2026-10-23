import { pool } from "..";
import { ONLINE_PAYMENT } from "../constant";
import {
  isSmsConfigured,
  normalizeIndianPhone,
  ORDER_SMS_TEMPLATES,
  OrderSmsType,
  sendSms,
} from "../services/sms";
import logger from "./logger";

/**
 * The customer SMS an order sends: payment received, the status steps,
 * cancellation, and the refund.
 *
 * They ride on the same once-only guard as the order emails, and for the same
 * reason — courier webhooks re-push the whole scan history, so SHIPPED lands
 * on an order many times. The claim is a row in order_email_log under an
 * SMS_-prefixed type, which can never collide with an email's.
 */

const claimSms = async (orderId: number, type: OrderSmsType) => {
  const { rowCount } = await pool.query(
    `INSERT INTO order_email_log (order_id, email_type)
     VALUES ($1, $2)
     ON CONFLICT (order_id, email_type) DO NOTHING`,
    [orderId, `SMS_${type}`],
  );

  return rowCount === 1;
};

/**
 * "1499.00" → "1499", "1499.5" → "1499.50". No thousands separator: the slot
 * is a {#num#}, and a comma is not a number.
 */
const formatAmount = (value: string | number | null) => {
  const amount = Number(value ?? 0);
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
};

const getOrderSmsData = async (orderId: number) => {
  const { rows } = await pool.query(
    `
    SELECT
      o.order_number,
      o.total_amount,
      o.payment_method,
      COALESCE(o.is_draft, false) AS is_draft,
      o.shipping_address->>'phone' AS shipping_phone,
      o.shipping_address->>'name' AS shipping_name,
      u.phone_no AS account_phone,
      u.name AS account_name,
      -- the running total refunded, falling back to what was charged for a
      -- refund the gateway settled before the admin's amount was written
      COALESCE(NULLIF(p.refunded_amount, 0), p.amount, o.total_amount) AS refund_amount,
      EXISTS (
        SELECT 1 FROM order_returns r
        WHERE r.order_id = o.order_id AND r.type = 'Replace'
      ) AS is_replacement
    FROM orders o
    LEFT JOIN users u
    ON u.id = o.user_id
    LEFT JOIN LATERAL (
      SELECT amount, refunded_amount
      FROM payments
      WHERE order_id = o.order_id
      ORDER BY payment_id DESC
      LIMIT 1
    ) p ON true
    WHERE o.order_id = $1
    `,
    [orderId],
  );

  return rows[0] ?? null;
};

/**
 * Sends one of the order SMS, at most once per order.
 *
 * Fire and forget like sendOrderEmail: nothing is thrown out of here, so a
 * gateway outage cannot fail a payment webhook or an admin's status change.
 * Call it after the commit.
 */
export const sendOrderSms = async (orderId: number, type: OrderSmsType) => {
  try {
    // Checked before the claim — claiming a send that cannot happen would use
    // up this order's SMS for good.
    if (!isSmsConfigured()) {
      logger.info({
        message: "Order SMS skipped, SMS credentials are not set",
        order_id: orderId,
        sms_type: type,
      });
      return;
    }

    const order = await getOrderSmsData(orderId);

    if (!order) {
      logger.error({
        message: "Order SMS skipped, order row not found",
        order_id: orderId,
        sms_type: type,
      });
      return;
    }

    // a parked order tells the customer nothing, and stays unclaimed so it is
    // still owed its SMS once restored — same rule as the emails
    if (order.is_draft) return;

    // "Credited to your original payment method" is only true of a prepaid
    // Return. A COD order has no such method, and a Replace refunds nothing —
    // though a courier's reverse-pickup scan can still move one to RETURN
    // INITIATED. Unclaimed, like a draft.
    if (
      type === "REFUND_INITIATED" &&
      (order.payment_method !== ONLINE_PAYMENT || order.is_replacement)
    )
      return;

    // The number given for this order first, then the account's.
    const phone =
      normalizeIndianPhone(order.shipping_phone) ??
      normalizeIndianPhone(order.account_phone);

    if (!phone) {
      logger.error({
        message: "Order SMS skipped, order has no valid Indian mobile number",
        order_id: orderId,
        sms_type: type,
      });
      return;
    }

    if (!(await claimSms(orderId, type))) return;

    const template = ORDER_SMS_TEMPLATES[type];

    await sendSms({
      numbers: phone,
      templateId: template.templateId,
      message: template.message({
        customerName: String(
          order.shipping_name || order.account_name || "Customer",
        ).trim(),
        orderNumber: order.order_number,
        amount: formatAmount(order.total_amount),
        refundAmount: formatAmount(order.refund_amount),
        // same link the shipped email gives
        trackingUrl: `${process.env.FRONTEND_HOST_URL}/account?tab=orders`,
      }),
    });
  } catch (error) {
    // Usually the gateway refusing, after the claim — so a lost SMS, not a
    // repeated one. sendSms has already logged the gateway's own answer.
    logger.error({
      message: "Error while sending customer order SMS",
      order_id: orderId,
      sms_type: type,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
};
