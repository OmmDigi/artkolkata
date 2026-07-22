import { phonePe } from "../config/phonePe";
import asyncErrorHandler from "../middleware/asyncErrorHandler";
import { createToken, verifyToken } from "../services/jwt";
import { fetchAnPaymentInfo } from "../services/razorpay.service";
import { doTransition } from "../utils/doTransition";
import { doValidate } from "../utils/doValidate";
import { ErrorHandler } from "../utils/ErrorHandler";
import { httpResponse } from "../utils/httpResponse";
import {
  VCheckPhonePeStatus,
  VUpdatePaymentStatus,
} from "../validator/payment.validator";
import { testWebhook } from "../utils/testPhonepeWebhook";

export const getRazorpayGatewayPage = asyncErrorHandler(async (req, res) => {
  const token = req.params.token;
  if (!token) throw new ErrorHandler(400, "Token is required");

  const { error, data } = await verifyToken<{
    orderRowId: number;
    gatewayOrderId: string;
    amount: string;
  }>(token[0]);
  if (error) throw new ErrorHandler(403, "Invalid token");

  if (!data) throw new ErrorHandler(403, "Invalid token");

  res.render("razorpay-gateway", {
    orderId: data.gatewayOrderId, // Your Razorpay order ID
    amount: parseFloat(data.amount) * 100, // Amount in paise (500.00 INR)
    razorpayKey: process.env.RAZORPAY_KEY_ID, // Your Razorpay Key ID
    paymentToken: token,
    verifyPaymentApi: `${process.env.API_BASE_URL}/api/v1/payments/verify/razorpay`,
  });
});

export const verifyPayment = asyncErrorHandler(async (req, res) => {
  const gatewayName = req.params.gatewayname;

  if (gatewayName == "razorpay") {
    if (!req.body.razorpay_order_id)
      throw new ErrorHandler(400, "Razorpay Order Id Is Required!");

    const { items, count } = await fetchAnPaymentInfo(
      req.body.razorpay_order_id,
    );

    if (count === 0) {
      throw new ErrorHandler(400, "No Payment done yet");
    }

    const lastPayment = items[count - 1];
    const tokenOption = {
      pi: lastPayment.id,
      oi: lastPayment.order_id,
      pa: lastPayment.amount,
      ps: "success",
      m: "",
    };
    // database update will happen via webhook
    if (lastPayment.captured == true) {
      tokenOption.ps = "success";
      const token = createToken(tokenOption);
      httpResponse(res, 200, "Payment Successfully Completed", {
        paymentResultPage: `${process.env.API_BASE_URL}/api/v1/payments/payment-result?token=${token}`,
      });
    } else {
      tokenOption.ps = "failed";
      tokenOption.m = lastPayment.error_description ?? "";
      const token = createToken(tokenOption);
      httpResponse(res, 200, "Payment Failed", {
        paymentResultPage: `${process.env.API_BASE_URL}/api/v1/payments/payment-result?token=${token}`,
      });
    }
    return;
  }

  throw new ErrorHandler(400, "Unable to detact gateway name");
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
  }>(token.toString());
  if (error) throw new ErrorHandler(400, "Invalid token!");

  if (!data) throw new ErrorHandler(400, "Invalid token data");

  if (data.ps === "success") {
    return res.render("payment-result", {
      status: "success",
      paymentId: data.pi,
      orderId: data.oi,
      amount: data.pa / 100, // in paise
      // paymentMethod: 'UPI'  // Optional
    });
  }

  res.render("payment-result", {
    status: "failed",
    orderId: data.oi,
    amount: data.pa / 100, // in paise
    errorReason: data.m, // Optional
    paymentId: data.pi, // Optional - if transaction ID exists
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

export const checkPhonepePaymentStatus = asyncErrorHandler(async (req, res) => {
  const value = doValidate<{ merchant_order_id: string }>(
    VCheckPhonePeStatus,
    req.query,
  );

  const merchantOrderId = value.merchant_order_id;

  const paymentInfo = await phonePe().checkStatus(merchantOrderId);
  if (!paymentInfo.success) {
    if (process.env.NODE_ENV == "development") {
      testWebhook({
        amount: paymentInfo.data.amount,
        merchantOrderId: merchantOrderId,
        orderid: paymentInfo.data.orderId,
        state: paymentInfo.data.state as any,
        timestamp: paymentInfo.data.paymentInstrument[0].timestamp,
        type: "checkout.order.failed",
        paymentId: paymentInfo.data.paymentInstrument[0].transactionId,
      });
    }

    return res.render("payment-result", {
      status: "failed",
      errorReason: paymentInfo.message,
      paymentId: paymentInfo.data.paymentInstrument[0].transactionId,
      orderId: paymentInfo.data.orderId,
      amount: paymentInfo.data.paymentInstrument[0].amount / 100, // in paise
    });
  }

  if (process.env.NODE_ENV == "development") {
    testWebhook({
      amount: paymentInfo.data.amount,
      merchantOrderId: merchantOrderId,
      orderid: paymentInfo.data.orderId,
      state: paymentInfo.data.state as any,
      timestamp: paymentInfo.data.paymentInstrument[0].timestamp,
      type: "checkout.order.completed",
      paymentId: paymentInfo.data.paymentInstrument[0].transactionId,
    });
  }

  res.render("payment-result", {
    status: "success",
    paymentId: paymentInfo.data.paymentInstrument[0].transactionId,
    orderId: paymentInfo.data.orderId,
    amount: paymentInfo.data.paymentInstrument[0].amount / 100, // in paise
  });
});
