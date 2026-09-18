import { Router } from "express";
import {
  checkPaymentStatus,
  getRazorpayGatewayPage,
  paymentResultPage,
  reconcilePaymentStatus,
  refundPayment,
  updatePaymentStatus,
  verifyPayment,
} from "../controllers/payments.controller";
import { isAuthorizedV2 } from "../middleware/isAuthorizedV2";
import { rateLimits } from "../middleware/rateLimits";

export const paymentRoute = Router();

paymentRoute
  .get("/razorpay-gateway/:token", rateLimits.payment, getRazorpayGatewayPage)
  .post("/verify/:gatewayname", rateLimits.payment, verifyPayment)
  .get("/payment-result", rateLimits.paymentStatus, paymentResultPage)
  // Where the gateway returns the customer after checkout.
  .get("/status", rateLimits.paymentStatus, checkPaymentStatus)
  .post("/status", rateLimits.paymentStatus, checkPaymentStatus)
  // The redirect URL PhonePe already has on file for orders placed before the
  // gateway interface landed.
  .get("/phonepe/status", rateLimits.paymentStatus, checkPaymentStatus)
  .post("/phonepe/status", rateLimits.paymentStatus, checkPaymentStatus)
  .get(
    "/reconcile",
    rateLimits.adminRead,
    isAuthorizedV2(["1-5"]),
    reconcilePaymentStatus,
  )
  .post(
    "/refund/:orderid",
    rateLimits.adminWrite,
    isAuthorizedV2(["1-5"]),
    refundPayment,
  )
  .patch(
    "/:orderid",
    rateLimits.adminWrite,
    isAuthorizedV2(["1-5"]),
    updatePaymentStatus,
  );
