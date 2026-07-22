import { phonePe } from "../config/phonePe";
import { createToken } from "./jwt";
import { createRazorpayOrder } from "./razorpay.service";

interface IProps {
  provider: "razorpay" | "phonepe";
  userName: string;
  userPhoneNumber: string;
  marchentOrderId: string;
  amount: number;
  dbOrderRowId: number;
}

export const createPaymentGatewayOrder = async ({
  marchentOrderId,
  provider,
  userName,
  userPhoneNumber,
  amount,
  dbOrderRowId,
}: IProps): Promise<{ orderid: string; paymentPageUrl: string }> => {
  if (provider === "razorpay") {
    const { id } = await createRazorpayOrder(amount * 100);
    const paymentToken = createToken({
      orderRowId: dbOrderRowId,
      gatewayOrderId: id,
      amount: amount,
    });

    return {
      orderid: id,
      paymentPageUrl: `${process.env.API_BASE_URL}/api/v1/payments/razorpay-gateway/${paymentToken}`,
    };
  }

  // for phoepe
  const { success, data } = await phonePe().createOrder({
    merchantUserId: userName,
    mobileNumber: userPhoneNumber,
    amount: amount * 100,
    merchantTransactionId: marchentOrderId,
    redirectUrl: `${process.env.API_BASE_URL}/api/v1/payments/phonepe/status?merchant_order_id=${marchentOrderId}`,
    redirectMode: "POST",
    paymentInstrument: {
      type: "PAY_PAGE",
    },
  });

  if (!success) {
    throw new Error("Unable to create order of phone pe");
  }

  return {
    orderid: marchentOrderId,
    paymentPageUrl: data.instrumentResponse.redirectInfo.url,
  };
};
