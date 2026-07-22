import { Router } from "express";
import {
  checkPhonepePaymentStatus,
  getRazorpayGatewayPage,
  paymentResultPage,
  updatePaymentStatus,
  verifyPayment,
} from "../controllers/payments.controller";
// import { isAuthorized } from "../middleware/isAuthorized";
import { isAuthorizedV2 } from "../middleware/isAuthorizedV2";

export const paymentRoute = Router();

paymentRoute
  .get("/razorpay-gateway/:token", getRazorpayGatewayPage)
  .post("/verify/:gatewayname", verifyPayment)
  .get("/payment-result", paymentResultPage)
  .get("/phonepe/status", checkPhonepePaymentStatus)
  .patch("/:orderid", isAuthorizedV2(["1-5"]), updatePaymentStatus)
