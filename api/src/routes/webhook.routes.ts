import { Router } from "express";
import express from "express";
import {
  updateOrderStatusWebhook,
  updateShiprocketStatusWebhook,
  verifyPaymentWebhook,
} from "../controllers/webhook.controller";

export const webHookRoutes = Router();

// Razorpay signs the exact bytes it sent, so the payment webhook must see the
// unparsed body — express.raw, never express.json, and "*/*" so a gateway that
// labels its content type differently still arrives as a Buffer.
const rawBody = express.raw({ type: "*/*", limit: "5mb" });

webHookRoutes
  .post(
    "/order-status",
    express.json({ limit: "100mb" }),
    updateOrderStatusWebhook,
  )
  // The courier rejects any webhook URL containing its own name ("shiprocket",
  // "kartrocket", "sr", "kr"), so this path stays generic. Delhivery already
  // owns "/order-status" above, hence the "/tracking" prefix here.
  .post(
    "/tracking/order-status",
    express.json({ limit: "100mb" }),
    updateShiprocketStatusWebhook,
  )
  // The endpoint to give any new gateway.
  .post("/payment", rawBody, verifyPaymentWebhook)
  // The paths already saved in the PhonePe and Razorpay dashboards. Same
  // handler — the active gateway decides how to authenticate the call, so
  // neither path is tied to the gateway named in it.
  .post("/razorpay/verify", rawBody, verifyPaymentWebhook)
  .post("/phonepe/verify", rawBody, verifyPaymentWebhook);
