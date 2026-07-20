import asyncErrorHandler from "../middleware/asyncErrorHandler";
import crypto from "crypto";
import { ErrorHandler } from "../utils/ErrorHandler";
import { doTransition } from "../utils/doTransition";
import { httpResponse } from "../utils/httpResponse";
import { processDelhiveryStatus, processShiprocketStatus } from "../services/webhook.service";
import { getAuthToken } from "../utils/getAuthToken";
import { pool } from "..";
import ShiprocketService, { ShiprocketOrderItem } from "../services/shiprocketService";
import logger from "../utils/logger";

export const verifyRazorpayPayment = asyncErrorHandler(async (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!webhookSecret)
    throw new ErrorHandler(404, "Razorpay webhook secret is required");

  try {
    const receivedSignature = req.headers["x-razorpay-signature"] as string;

    if (!Buffer.isBuffer(req.body)) {
      throw new ErrorHandler(400, "Invalid body format");
    }

    const generatedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(req.body)
      .digest("hex");

    if (generatedSignature === receivedSignature) {
      const body = JSON.parse(req.body.toString("utf8"));

      const payment = body.payload.payment.entity;
      const order_id = payment.order_id;
      const payment_id = payment.id;
      const created_at = payment.created_at;

      const date = new Date(created_at * 1000);
      const formattedDate = date
        .toISOString()
        .replace("T", " ")
        .replace("Z", "");

      await doTransition(async (client) => {
        if (body.event === "payment.captured") {
          const paymentInfo = await client.query(
            "UPDATE payments SET provider_payment_id = $1, status = 'PAID', created_at = $2::timestamp WHERE provider_order_id = $3 RETURNING order_id",
            [payment_id, formattedDate, order_id],
          );
          if (paymentInfo.rowCount == 0)
            throw new ErrorHandler(400, "Unable to update payment status");
          await client.query(
            "UPDATE orders SET payment_status = 'PAID' WHERE order_id = $1",
            [paymentInfo.rows[0].order_id],
          );
        } else if (body.event === "payment.failed") {
          const paymentInfo = await client.query(
            "UPDATE payments SET provider_payment_id = $1, status = 'FAILED', created_at = CURRENT_TIMESTAMP WHERE provider_order_id = $2 RETURNING order_id",
            [payment_id, order_id],
          );
          if (paymentInfo.rowCount == 0)
            throw new ErrorHandler(400, "Unable to update payment status");
          await client.query(
            "UPDATE orders SET payment_status = 'FAILED' WHERE order_id = $1",
            [paymentInfo.rows[0].order_id],
          );
        }
      });

      res.status(200).send("Razorpay Payment Verification Done");
    } else {
      console.log("❌ Invalid webhook signature");
      res.status(400).send("Invalid signature");
    }
  } catch (error) {
    console.error("Webhook processing error:", error);
    res.status(500).send("Error processing webhook");
  }
});

export const updateOrderStatusWebhook = asyncErrorHandler(async (req, res) => {
  // i need passwrod
  const token = getAuthToken(req);
  if (!token) throw new ErrorHandler(403, "Forbidden");

  const password = token;
  if (!password) throw new ErrorHandler(403, "Forbidden");

  if (password != process.env.DELHIVERY_WEBHOOK_SECRET)
    throw new ErrorHandler(403, "Forbidden");

  // offload the task to the background api
  processDelhiveryStatus(req.body);

  httpResponse(res, 200, "Thank you for your response");
});

export const verifyPhonepePayment = asyncErrorHandler(async (req, res) => {
  // === 1. Check Basic Auth ===
  // PhonePe uses Basic Auth: username and password that you created in PhonePe dashboard.
  console.log("WEBHOOK CALLED");
  const incomingHeader = req.headers["authorization"];
  if (!incomingHeader) {
    return res
      .status(401)
      .json({ message: "Missing or invalid Authorization header" });
  }

  // Check against your configured webhook credentials
  const expectedUsername = process.env.PHONEPE_WEBHOOK_USER;
  const expectedPassword = process.env.PHONEPE_WEBHOOK_PASS;

  const expectedHash = crypto
    .createHash("sha256")
    .update(`${expectedUsername}:${expectedPassword}`)
    .digest("hex");

  if (expectedHash !== incomingHeader) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  // === 2. Parse payload ===
  const rawBody = req.body.toString("utf8");
  const event = JSON.parse(rawBody);

  // Now handle events:
  console.log("📩 Received PhonePe webhook event:", event);

  // Example: handle event types
  let status: string | null = null;
  let paymentid: string | null = null;
  let created_at: Date | null = null;
  let orderid: string | null = null;
  let dbSearchId : string | null = null;

  switch (event.event) {
    case "checkout.order.completed":
      // Process completed payment
      console.log("Order completed:", event.payload);
      status = "PAID";
      paymentid = event.payload.paymentDetails[0].transactionId;
      created_at = new Date(event.payload.paymentDetails[0].timestamp);
      orderid = event.payload.orderId;
      dbSearchId = event.payload.merchantOrderId;
      break;

    case "checkout.order.failed":
      console.log("Order failed:", event.payload);
      status = "FAILED";
      paymentid = event.payload.paymentDetails[0].transactionId;
      created_at = new Date(event.payload.paymentDetails[0].timestamp);
      orderid = event.payload.orderId;
      dbSearchId = event.payload.merchantOrderId;
      break;

    case "pg.refund.completed":
      console.log("Refund completed:", event.payload);
      status = "REFUNDED";
      created_at = new Date(event.payload.paymentDetails[0].timestamp);
      orderid = event.payload.orderId;
      dbSearchId = event.payload.originalMerchantOrderId;
      paymentid = event.payload.refundId; // Use refundId for tracking
      break;

    default:
      console.log("Unhandled PhonePe event:", event.event);
      return res.sendStatus(200); // Always ack unhandled events
  }

  let dbOrderId: number | null = null;

  await doTransition(async (client) => {
    const paymentInfo = await client.query(
      "UPDATE payments SET provider_payment_id = $1, status = $2, created_at = $3::timestamp, provider_order_id = $4 WHERE provider_order_id = $5 RETURNING order_id",
      [paymentid, status, created_at, orderid, dbSearchId],
    );
    if (paymentInfo.rowCount == 0)
      throw new ErrorHandler(400, "Unable to update payment status");
    dbOrderId = paymentInfo.rows[0].order_id;
    await client.query(
      "UPDATE orders SET payment_status = $1 WHERE order_id = $2",
      [status, dbOrderId],
    );
  });

  // For successful ONLINE payments: create Shiprocket order
  if (status === "PAID" && dbOrderId) {
    createShiprocketOrderForOnlinePayment(dbOrderId).catch((err) => {
      logger.error({ message: "Shiprocket order async failed for ONLINE order", error: err });
    });
  }

  // === 3. Respond with 200 status quickly ===
  // PhonePe considers webhook delivered if you return a 2xx status within a few seconds
  return res.sendStatus(200);
});

export const handleShiprocketWebhook = asyncErrorHandler(async (req, res) => {
  const token = getAuthToken(req);
  if (!token) throw new ErrorHandler(403, "Forbidden");
  if (token !== process.env.SHIPROCKET_WEBHOOK_SECRET)
    throw new ErrorHandler(403, "Forbidden");

  // Offload to background — respond immediately
  processShiprocketStatus(req.body);

  httpResponse(res, 200, "Thank you for your response");
});

// ============================================================
// HELPER — create Shiprocket order after ONLINE payment confirmed
// ============================================================
async function createShiprocketOrderForOnlinePayment(dbOrderId: number) {
  const orderRes = await pool.query(
    `SELECT o.order_id, o.order_number, o.subtotal, o.shipping_address,
            json_agg(
              json_build_object(
                'product_info', oi.product_info,
                'variant_info', oi.variant_info,
                'quantity',     oi.quantity,
                'price',        oi.price
              )
            ) AS items
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.order_id
     WHERE o.order_id = $1
     GROUP BY o.order_id`,
    [dbOrderId],
  );

  if (orderRes.rowCount === 0) return;

  const order  = orderRes.rows[0];
  const addr   = order.shipping_address;
  const srItems: ShiprocketOrderItem[] = (order.items as any[]).map((item) => {
    const info = item.variant_info ?? item.product_info;
    return {
      name:         info.product_name ?? info.name,
      sku:          info.sku ?? info.sku_id ?? `ITEM-${dbOrderId}`,
      units:        item.quantity,
      sellingPrice: parseFloat(item.price),
    };
  });

  const result = await ShiprocketService.createOrder({
    orderNumber:     order.order_number,
    orderDate:       new Date().toISOString().split("T")[0],
    customerName:    addr.name,
    customerEmail:   addr.email,
    customerPhone:   addr.phone,
    customerAddress: addr.address_line1,
    customerCity:    addr.city,
    customerState:   addr.state,
    customerPincode: addr.pincode,
    customerCountry: addr.country || "India",
    paymentMethod:   "ONLINE",
    subTotal:        parseFloat(order.subtotal),
    items:           srItems,
  });

  if (result.success && result.shiprocketOrderId) {
    await pool.query(
      "UPDATE orders SET shiprocket_order_id = $1, waybill = $2 WHERE order_id = $3",
      [result.shiprocketOrderId, result.awbCode ?? null, dbOrderId],
    );
  } else {
    logger.error({
      message: "Shiprocket order creation failed for ONLINE payment",
      dbOrderId,
      error: result.error,
    });
  }
}
