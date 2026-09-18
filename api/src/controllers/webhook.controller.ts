import asyncErrorHandler from "../middleware/asyncErrorHandler";
import crypto from "crypto";
import { ErrorHandler } from "../utils/ErrorHandler";
import { httpResponse } from "../utils/httpResponse";
import {
  processDelhiveryStatus,
  processShiprocketStatus,
} from "../services/webhook.service";
import { getAuthToken } from "../utils/getAuthToken";
import { getPaymentGateway } from "../services/payment";
import { recordPaymentEvent } from "../utils/recordPaymentEvent";

/**
 * The one endpoint every payment gateway notifies.
 *
 * Nothing here knows which gateway is live: the active IPaymentGateway
 * authenticates the call and flattens whatever it sent into a PaymentEvent,
 * and one shared writer puts it in the database. A new gateway needs no change
 * to this file.
 *
 * The old per-gateway paths are still routed here so the URLs already saved in
 * the PhonePe and Razorpay dashboards keep working.
 */
export const verifyPaymentWebhook = asyncErrorHandler(async (req, res) => {
  const gateway = getPaymentGateway();

  let event;

  try {
    event = gateway.verifyWebhook({
      rawBody: req.body,
      headers: req.headers,
    });
  } catch (error: any) {
    // A bad signature is not our bug to retry — refuse it and say nothing else.
    console.error(`\u274c Rejected ${gateway.label} webhook :`, error?.message);
    return res.status(401).send("Invalid webhook");
  }

  // A notification that does not move money. Acknowledged so the gateway stops
  // retrying it, and otherwise ignored.
  if (!event) return res.sendStatus(200);

  const { updated, orderId, skipped } = await recordPaymentEvent(event);

  console.log(
    `\ud83d\udce9 ${gateway.label} webhook : ${event.status} for ${event.providerOrderId}`,
    { updated, orderId, skipped },
  );

  // A paid order is not booked with the courier here. The boxes it ships in
  // are entered in the CMS by hand, so booking waits for an admin to confirm.

  // Answer fast: every gateway re-sends anything not acknowledged in seconds.
  return res.sendStatus(200);
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

/**
 * Shiprocket's tracking webhook. Registered in the Shiprocket panel under
 * Settings -> API -> Webhooks, where the same secret is entered as the token;
 * Shiprocket sends it back on every push as the x-api-key header, and that is
 * the only thing proving the call came from Shiprocket — there is no signature.
 */
export const updateShiprocketStatusWebhook = asyncErrorHandler(async (req, res) => {
  const secret = process.env.SHIPROCKET_WEBHOOK_TOKEN;

  // Refuse rather than run open: with no secret configured every caller on the
  // internet could rewrite order statuses.
  if (!secret) throw new ErrorHandler(403, "Forbidden");

  const suppliedKey =
    (req.headers["x-api-key"] as string) ?? getAuthToken(req) ?? "";

  const supplied = Buffer.from(suppliedKey);
  const expected = Buffer.from(secret);

  if (
    supplied.length !== expected.length ||
    !crypto.timingSafeEqual(supplied, expected)
  ) {
    throw new ErrorHandler(403, "Forbidden");
  }

  // Shiprocket retries anything that is not answered quickly, so acknowledge
  // first and do the database work in the background.
  processShiprocketStatus(req.body);

  httpResponse(res, 200, "Thank you for your response");
});
