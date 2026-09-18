import { pool } from "..";
import asyncErrorHandler from "../middleware/asyncErrorHandler";
import { createToken, verifyToken } from "../services/jwt";
import { getPaymentGateway } from "../services/payment";
import { doTransition } from "../utils/doTransition";
import { doValidate } from "../utils/doValidate";
import { ErrorHandler } from "../utils/ErrorHandler";
import { httpResponse } from "../utils/httpResponse";
import {
  getRefundableOrder,
  recordPaymentEvent,
  saveRefundDetails,
} from "../utils/recordPaymentEvent";
import {
  VCheckPaymentStatus,
  VRefundPayment,
  VUpdatePaymentStatus,
} from "../validator/payment.validator";
import { CustomRequest } from "../types";

/**
 * Whether the order behind a gateway payment was placed without an account.
 *
 * The result page needs it because the two cases end in different places: an
 * account holder is sent to their order history, and a guest has none, so they
 * go to the guest confirmation page instead — which reads the order token the
 * storefront saved before it handed the customer to the gateway.
 *
 * Never throws. A lookup that fails only costs the "view your order" button
 * pointing at the account page, and that must not turn a successful payment
 * into an error screen.
 */
const isGuestPaymentOrder = async (
  providerOrderId: string | null | undefined,
): Promise<boolean> => {
  if (!providerOrderId) return false;

  try {
    const { rows } = await pool.query<{ is_guest_order: boolean }>(
      `SELECT COALESCE(o.is_guest_order, false) AS is_guest_order
         FROM payments p
         JOIN orders o ON o.order_id = p.order_id
        WHERE p.provider_order_id = $1
        ORDER BY p.payment_id DESC
        LIMIT 1`,
      [providerOrderId],
    );

    return rows[0]?.is_guest_order === true;
  } catch {
    return false;
  }
};

/**
 * The page a Razorpay checkout runs in. Razorpay has no hosted page for this
 * integration, so the gateway hands the customer here and the view loads
 * Razorpay's script. The token was signed when the order was created, which is
 * what stops the amount or the order id being edited in the address bar.
 */
export const getRazorpayGatewayPage = asyncErrorHandler(async (req, res) => {
  const token = req.params.token;
  if (!token) throw new ErrorHandler(400, "Token is required");

  const { error, data } = await verifyToken<{
    orderRowId: number;
    gatewayOrderId: string;
    amount: number | string;
  }>(token.toString());

  if (error || !data) throw new ErrorHandler(403, "Invalid token");

  const amount =
    typeof data.amount === "string" ? parseFloat(data.amount) : data.amount;

  res.render("razorpay-gateway", {
    orderId: data.gatewayOrderId,
    amount: Math.round(amount * 100), // Razorpay checkout wants paise
    razorpayKey: process.env.RAZORPAY_KEY_ID,
    paymentToken: token,
    verifyPaymentApi: `${process.env.API_BASE_URL}/api/v1/payments/verify/razorpay`,
  });
});

/**
 * Called by the Razorpay checkout script the moment it closes. This only
 * decides which result page the customer sees — the database is written from
 * the gateway's own notification, which is the version that can be trusted.
 */
export const verifyPayment = asyncErrorHandler(async (req, res) => {
  const gateway = getPaymentGateway();
  const gatewayName = req.params.gatewayname;

  if (gatewayName !== gateway.name)
    throw new ErrorHandler(400, `${gatewayName} is not the active gateway`);

  const providerOrderId = req.body.razorpay_order_id ?? req.body.order_id;

  if (!providerOrderId)
    throw new ErrorHandler(400, "Gateway order id is required");

  const snapshot = await gateway.fetchPaymentStatus(providerOrderId);

  // Belt and braces: the webhook normally gets here first, but a webhook that
  // is slow or lost should not leave a paid order sitting at PENDING.
  await recordPaymentEvent(snapshot);

  const token = createToken({
    pi: snapshot.providerPaymentId ?? "",
    oi: snapshot.providerOrderId,
    pa: snapshot.amount,
    ps: snapshot.status === "PAID" ? "success" : "failed",
    m: snapshot.status === "PAID" ? "" : snapshot.message,
    // carried in the token because paymentResultPage renders from it alone
    g: await isGuestPaymentOrder(snapshot.providerOrderId),
  });

  httpResponse(
    res,
    200,
    snapshot.status === "PAID"
      ? "Payment Successfully Completed"
      : "Payment Failed",
    {
      paymentResultPage: `${process.env.API_BASE_URL}/api/v1/payments/payment-result?token=${token}`,
    },
  );
});

export const paymentResultPage = asyncErrorHandler(async (req, res) => {
  const token = req.query.token;
  if (!token) throw new ErrorHandler(400, "Need token");

  const { data, error } = await verifyToken<{
    pi: string;
    oi: string;
    pa: number;
    ps: string;
    m: string;
    g?: boolean;
  }>(token.toString());

  if (error || !data) throw new ErrorHandler(400, "Invalid token!");

  if (data.ps === "success") {
    return res.render("payment-result", {
      status: "success",
      paymentId: data.pi,
      orderId: data.oi,
      amount: data.pa,
      isGuestOrder: data.g === true,
    });
  }

  res.render("payment-result", {
    status: "failed",
    orderId: data.oi,
    amount: data.pa,
    errorReason: data.m,
    paymentId: data.pi,
    isGuestOrder: data.g === true,
  });
});

export const updatePaymentStatus = asyncErrorHandler(async (req, res) => {
  const value = doValidate(VUpdatePaymentStatus, {
    ...req.params,
    ...req.body,
  });

  await doTransition(async (client) => {
    const { rowCount } = await client.query(
      `UPDATE orders SET payment_status = $1 WHERE order_id = $2 AND payment_method != 'ONLINE'`,
      [value.status, value.orderid],
    );

    if (rowCount == 0)
      throw new ErrorHandler(
        400,
        "Unable to update payment status as it's online payment",
      );

    await client.query(`UPDATE payments SET status = $1 WHERE order_id = $2`, [
      value.status,
      value.orderid,
    ]);
  });

  httpResponse(res, 200, "Payment status successfully updated");
});

/**
 * Where the gateway drops the customer back after they pay, and the reconcile
 * path for the customer who closed the tab before that happened. Asks the
 * gateway what really happened, writes it, then shows the result.
 *
 * This is a browser landing page, so it renders rather than returning JSON.
 */
export const checkPaymentStatus = asyncErrorHandler(async (req, res) => {
  const value = doValidate<{
    provider_order_id?: string;
    merchant_order_id?: string;
  }>(VCheckPaymentStatus, req.query);

  const providerOrderId = value.provider_order_id ?? value.merchant_order_id;

  if (!providerOrderId)
    throw new ErrorHandler(400, "provider_order_id is required");

  const snapshot = await getPaymentGateway().fetchPaymentStatus(providerOrderId);

  await recordPaymentEvent(snapshot);

  const isGuestOrder = await isGuestPaymentOrder(snapshot.providerOrderId);

  if (snapshot.status === "PAID") {
    return res.render("payment-result", {
      status: "success",
      paymentId: snapshot.providerPaymentId,
      orderId: snapshot.providerOrderId,
      amount: snapshot.amount,
      isGuestOrder,
    });
  }

  res.render("payment-result", {
    status: "failed",
    errorReason: snapshot.message,
    paymentId: snapshot.providerPaymentId,
    orderId: snapshot.providerOrderId,
    amount: snapshot.amount,
    isGuestOrder,
  });
});

/**
 * The same reconcile, for staff. Returns JSON instead of a page so the CMS can
 * chase up an order whose webhook never landed.
 */
export const reconcilePaymentStatus = asyncErrorHandler(async (req, res) => {
  const providerOrderId = req.query.provider_order_id?.toString();

  if (!providerOrderId)
    throw new ErrorHandler(400, "provider_order_id is required");

  const gateway = getPaymentGateway();
  const snapshot = await gateway.fetchPaymentStatus(providerOrderId);
  const { updated, orderId, skipped } = await recordPaymentEvent(snapshot);

  httpResponse(res, 200, "Payment status fetched", {
    provider: gateway.label,
    provider_order_id: providerOrderId,
    status: snapshot.status,
    // How they paid, as the gateway reports it right now. Null when nothing
    // has been attempted yet.
    payment_instrument: snapshot.instrument?.type ?? null,
    instrument_label: snapshot.instrument?.label ?? null,
    order_id: orderId,
    updated,
    skipped,
  });
});

/**
 * The refund an admin submits from the CMS.
 *
 * Only staff holding the Orders permission reach this — see the route. Two
 * ways through:
 *
 *  - through the gateway, which actually moves the money; or
 *  - skipped, which moves nothing and only records that the admin settled it
 *    in the gateway's own portal, or handed cash back for a COD order.
 *
 * Either way the amount, the note and who decided it are written down, because
 * a refund is a human decision and the next person to open the order needs to
 * see what was done and why.
 */
export const refundPayment = asyncErrorHandler(async (req: CustomRequest, res) => {
  const value = doValidate<{
    orderid: number;
    amount: number;
    skip_gateway: boolean;
    note: string;
  }>(VRefundPayment, { ...req.params, ...req.body });

  const refundable = await getRefundableOrder(value.orderid);

  if (!refundable)
    throw new ErrorHandler(404, "This order has no payment to refund");

  const { payment, remaining } = refundable;

  // Nothing was ever taken from a PENDING or FAILED payment. A payment already
  // fully refunded has nothing left, which the remaining check below catches.
  if (payment.status !== "PAID" && payment.status !== "REFUNDED")
    throw new ErrorHandler(
      400,
      `A ${payment.status ?? "PENDING"} payment cannot be refunded`,
    );

  if (remaining <= 0)
    throw new ErrorHandler(400, "This payment has already been fully refunded");

  if (value.amount > remaining)
    throw new ErrorHandler(
      400,
      `Only ₹${remaining} is left to refund on this order`,
    );

  const adminUserId = req.token_info?.id ?? null;

  // ---- Skipped: record only, move nothing. ----
  if (value.skip_gateway) {
    await saveRefundDetails({
      paymentId: payment.payment_id,
      orderRowId: payment.order_id,
      amount: value.amount,
      note: value.note,
      adminUserId,
      viaGateway: false,
      // Nothing is pending on a gateway, so the admin's word settles it.
      settle: true,
    });

    return httpResponse(res, 200, "Refund recorded without calling the gateway", {
      order_id: value.orderid,
      amount: value.amount,
      via_gateway: false,
      status: "REFUNDED",
    });
  }

  // ---- Through the gateway. ----
  const gateway = getPaymentGateway();

  if (payment.payment_method !== "ONLINE")
    throw new ErrorHandler(
      400,
      "A COD order was never paid through a gateway — record the refund instead",
    );

  // The estate can be switched between gateways, and an order paid through the
  // old one cannot be refunded through the new one's api.
  if (payment.provider && payment.provider !== gateway.label)
    throw new ErrorHandler(
      400,
      `This order was paid through ${payment.provider}, but ${gateway.label} is live. Refund it in the ${payment.provider} portal and record it here instead`,
    );

  const accepted = await gateway.refundPayment(value.orderid, value.amount);

  if (!accepted)
    throw new ErrorHandler(
      400,
      `${gateway.label} refused the refund. Check the gateway portal, then record the refund here if it went through there`,
    );

  // The gateway decides when the money is actually back: Razorpay usually
  // settles at once and has already marked the row, PhonePe confirms later
  // over the webhook. Either way this only writes the audit trail.
  await saveRefundDetails({
    paymentId: payment.payment_id,
    orderRowId: payment.order_id,
    amount: value.amount,
    note: value.note,
    adminUserId,
    viaGateway: true,
    settle: false,
  });

  const settled = await getRefundableOrder(value.orderid);

  httpResponse(res, 200, `${gateway.label} accepted the refund`, {
    order_id: value.orderid,
    amount: value.amount,
    via_gateway: true,
    status: settled?.payment.status ?? payment.status,
  });
});
