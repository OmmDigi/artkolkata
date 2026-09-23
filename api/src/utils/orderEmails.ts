import { PoolClient } from "pg";
import { pool } from "..";
import {
  ORDER_CONFIRMED,
  ORDER_DELIVERED,
  ORDER_SHIPPED,
  OUT_FOR_DELIVERY,
  RETURN_WINDOW_DAYS,
} from "../constant";
import logger from "./logger";
import { EmailType, sendEmail } from "./sendEmail";

/**
 * The customer-facing emails an order sends as it moves along, and the guard
 * that each one goes out exactly once.
 *
 * Once-only is not optional here. Both courier webhooks re-push their entire
 * scan history on every change, and syncShipmentTracking writes the order's
 * status straight from the newest scan every time the customer opens their own
 * tracking page — so "SHIPPED" lands on an order again and again. The
 * order_email_log primary key is what turns that into one email.
 */

/** Which status earns which email. A status missing here mails nobody. */
const STATUS_EMAILS: Record<string, EmailType> = {
  [ORDER_CONFIRMED]: "ORDER_CONFIRMED_EMAIL",
  [ORDER_SHIPPED]: "ORDER_SHIPPED_EMAIL",
  [OUT_FOR_DELIVERY]: "ORDER_OUT_FOR_DELIVERY_EMAIL",
  [ORDER_DELIVERED]: "ORDER_DELIVERED_EMAIL",
};

/**
 * Claims this order's right to send this email.
 *
 * Returns false when the row is already there, which is the whole point: two
 * webhooks racing on two connections both try, exactly one wins, and the loser
 * sends nothing. Claiming before sending rather than recording after means a
 * crash mid-send costs a missing email, not a repeating one.
 */
const claimEmail = async (
  orderId: number,
  type: EmailType,
  client: PoolClient | typeof pool = pool,
): Promise<boolean> => {
  const { rowCount } = await client.query(
    `INSERT INTO order_email_log (order_id, email_type)
     VALUES ($1, $2)
     ON CONFLICT (order_id, email_type) DO NOTHING`,
    [orderId, type],
  );

  return rowCount === 1;
};

/**
 * Everything the customer emails show, in one read.
 *
 * The address snapshot taken at checkout comes first and the account second —
 * a guest order has only the snapshot, and a customer who has since edited
 * their account should still see the order as it was placed.
 */
const getOrderEmailData = async (orderId: number) => {
  const { rows, rowCount } = await pool.query(
    `
    SELECT
      o.order_number,
      -- Parked by staff. Nothing about a draft is told to the customer.
      COALESCE(o.is_draft, false) AS is_draft,
      TO_CHAR(o.created_at, 'DD Mon YYYY') AS order_date,
      o.total_amount,
      o.payment_method,
      o.waybill,
      o.courier_name,
      TO_CHAR(o.delivered_at, 'DD Mon YYYY') AS delivered_date,
      COALESCE(o.shipping_address, '{}'::jsonb) AS shipping_details,
      COALESCE(o.gst_details, '{}'::jsonb) AS gst_details,
      u.name AS account_name,
      u.email AS account_email,
      STRING_AGG(
        oi.quantity || ' x ' ||
        CASE
          WHEN oi.variant_info IS NOT NULL
          THEN oi.variant_info->>'product_name'
          ELSE oi.product_info->>'name'
        END,
        ', '
      ) AS items
    FROM orders o

    LEFT JOIN users u
    ON u.id = o.user_id

    LEFT JOIN order_items oi
    ON oi.order_id = o.order_id

    WHERE o.order_id = $1

    GROUP BY u.id, o.order_id
    `,
    [orderId],
  );

  if (rowCount === 0) return null;

  const order = rows[0];
  const shipping = order.shipping_details ?? {};
  const gst = order.gst_details ?? {};

  const recipient = String(shipping.email ?? order.account_email ?? "").trim();

  return {
    recipient,
    // Parked by staff: the caller stops here rather than mailing the customer
    // about an order that, as far as the business is concerned, did not happen.
    isDraft: order.is_draft === true,
    templateData: {
      customerName: shipping.name ?? order.account_name ?? "Customer",
      // order-confirmed.html prints the address back to the customer, so it is
      // part of the data every order email gets rather than that one's alone.
      customerEmail: recipient,
      orderId: order.order_number,
      orderDate: order.order_date,
      totalAmount: order.total_amount,
      paymentMethod: order.payment_method,
      items: order.items ?? "",
      // Only set when the customer gave a GSTIN at checkout. The template
      // prints these two rows together or not at all, so a business buyer can
      // check the number on the confirmation rather than on the invoice, when
      // it is too late to correct.
      gstNumber: gst.gst_number ?? null,
      gstBusinessName: gst.business_name ?? null,
      waybill: order.waybill,
      courierName: order.courier_name,
      deliveredDate: order.delivered_date,
      returnWindowDays: RETURN_WINDOW_DAYS,
      orderLink: `${process.env.FRONTEND_HOST_URL}/account?tab=orders`,
    },
  };
};

/**
 * Sends one of the order emails, at most once per order.
 *
 * Fire and forget by design — a mail server having a bad minute must not fail
 * the admin's status update or a courier's webhook, so nothing is thrown out of
 * here. It takes its own connection rather than the caller's transaction: the
 * claim has to survive independently of whatever else that transaction decides
 * to do, and an SMTP round trip has no business holding a database connection
 * open. Call it after the commit.
 */
export const sendOrderEmail = async (orderId: number, type: EmailType) => {
  try {
    const order = await getOrderEmailData(orderId);

    if (order == null) {
      logger.error({
        message: "Customer email skipped, order row not found",
        order_id: orderId,
        email_type: type,
      });
      return;
    }

    if (!order.recipient) {
      logger.error({
        message: "Customer email skipped, order has no email address",
        order_id: orderId,
        email_type: type,
      });
      return;
    }

    /**
     * A parked order tells the customer nothing. Returned before the claim on
     * purpose: the log row is what makes an email once-only, so claiming here
     * would silently burn the send for good. Left unclaimed, the email the
     * order is owed still goes out the first time it moves after it is
     * restored.
     */
    if (order.isDraft) {
      logger.info({
        message: "Customer email skipped, order is a draft",
        order_id: orderId,
        email_type: type,
      });
      return;
    }

    if (!(await claimEmail(orderId, type))) return;

    const sent = await sendEmail(order.recipient, type, order.templateData);

    // The claim is already in, so a failure here is a lost email rather than a
    // repeated one. Logged loudly for that reason — nothing will retry it.
    if (!sent.ok)
      logger.error({
        message: "Customer email claimed but failed to send",
        order_id: orderId,
        email_type: type,
        error: sent.error,
      });
  } catch (error) {
    logger.error({
      message: "Error while sending customer order email",
      order_id: orderId,
      email_type: type,
      stack: error,
    });
  }
};

/**
 * The one entry point for "this order just moved, tell the customer".
 *
 * Every place that writes order_status calls this straight after its commit,
 * and a status with no email attached quietly does nothing.
 */
export const notifyOrderStatus = async (orderId: number, status: string) => {
  const type = STATUS_EMAILS[status];

  if (!type) return;

  await sendOrderEmail(orderId, type);
};

/** "We have your order." Placement for COD, payment success for prepaid. */
export const notifyOrderReceived = async (orderId: number) =>
  sendOrderEmail(orderId, "ORDER_RECEIVED_EMAIL");
