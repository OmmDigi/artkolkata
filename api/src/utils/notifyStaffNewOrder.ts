import { pool } from "..";
import { ORDERS_PERMISSION_ID } from "../constant";
import logger from "./logger";
import { sendEmail } from "./sendEmail";

// Every staff member who is allowed to work on orders gets told when a new one
// lands. "Allowed to work on orders" is the same thing the CMS sidebar means by
// it : an active Employee holding the Orders route id in user_permissions.
const getOrderStaffEmails = async (): Promise<string[]> => {
  const { rows } = await pool.query(
    `
    SELECT u.email
    FROM users u

    JOIN user_permissions up
    ON up.user_id = u.id

    WHERE (u.role = 'Employee' OR u.role = 'Admin')
      AND u.is_active = true
      AND u.email IS NOT NULL
      AND jsonb_exists(up.permissions, $1)
    `,
    [ORDERS_PERMISSION_ID],
  );

  return rows.map((row) => row.email as string);
};

const getOrderSummary = async (orderId: number) => {
  const { rows, rowCount } = await pool.query(
    `
    SELECT
      o.order_number,
      TO_CHAR(o.created_at, 'DD Mon YYYY, HH12:MI AM') AS order_date,
      o.total_amount,
      o.payment_method,
      o.order_status,
      u.name AS account_name,
      u.email AS account_email,
      COALESCE(o.shipping_address, '{}'::jsonb) AS shipping_details,
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
  return rows[0];
};

// Fire and forget : a failure here must never fail the customer's checkout, so
// nothing is thrown out of this function — it only logs.
export const notifyStaffNewOrder = async (orderId: number) => {
  try {
    const [staffEmails, order] = await Promise.all([
      getOrderStaffEmails(),
      getOrderSummary(orderId),
    ]);

    if (staffEmails.length === 0) {
      logger.info({
        message: "New order placed but no active order staff to notify",
        order_id: orderId,
      });
      return;
    }

    if (order == null) {
      logger.error({
        message: "New order staff alert skipped, order row not found",
        order_id: orderId,
      });
      return;
    }

    // Orders placed before the shipping_address JSONB migration have no
    // snapshot, so fall back to the account details the same way the customer
    // confirmation email does.
    const shipping = order.shipping_details ?? {};

    await sendEmail(staffEmails, "NEW_ORDER_STAFF_ALERT", {
      orderId: order.order_number,
      orderDate: order.order_date,
      orderStatus: order.order_status,
      paymentMethod: order.payment_method,
      totalAmount: order.total_amount,
      items: order.items ?? "",
      customerName: shipping.name ?? order.account_name ?? "Not available",
      customerEmail: shipping.email ?? order.account_email ?? "",
      customerPhone: shipping.phone ?? "",
      shippingAddress: [
        shipping.address_line1,
        shipping.city,
        shipping.state,
        shipping.pincode,
        shipping.country,
      ]
        .filter(Boolean)
        .join(", "),
      cmsOrderLink: process.env.CMS_HOST_URL
        ? `${process.env.CMS_HOST_URL}/orders`
        : null,
    });
  } catch (error) {
    logger.error({
      message: "Unable to send the new order alert to order staff",
      order_id: orderId,
      stack: error,
    });
  }
};
