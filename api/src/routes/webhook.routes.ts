import { Router } from "express";
import express from "express";
import {
  handleShiprocketWebhook,
  updateOrderStatusWebhook,
  verifyPhonepePayment,
  verifyRazorpayPayment,
} from "../controllers/webhook.controller";

export const webHookRoutes = Router();

webHookRoutes
  .post(
    "/order-status",
    express.json({ limit: "100mb" }),
    updateOrderStatusWebhook,
  )
  .post(
    "/razorpay/verify",
    express.raw({ type: "application/json" }),
    verifyRazorpayPayment,
  )
  .post(
    "/phonepe/verify",
    express.raw({ type: "application/json" }),
    verifyPhonepePayment,
  )
  .post(
    "/shiprocket/tracking",
    express.json({ limit: "100mb" }),
    handleShiprocketWebhook,
  );
