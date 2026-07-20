import Razorpay from "razorpay";
import { Orders } from "razorpay/dist/types/orders";
// import { generateReceiptNumber } from "../utils/generateReceiptNumber";
import { Payments } from "razorpay/dist/types/payments";

type ROptions =
  | Orders.RazorpayOrderCreateRequestBody
  | Orders.RazorpayTransferCreateRequestBody
  | Orders.RazorpayAuthorizationCreateRequestBody;

export const createRazorpayOrder = async (
  productAmount: number,
  more_options?: ROptions
) => {
  const keyID = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  const razorpay = new Razorpay({
    key_id: keyID,
    key_secret: keySecret,
  });

  // const receipt_no = await generateReceiptNumber(institute);
  // if (!receipt_no) throw new Error("Unable To Create Receipt");

  const options:
    | Orders.RazorpayOrderCreateRequestBody
    | Orders.RazorpayTransferCreateRequestBody
    | Orders.RazorpayAuthorizationCreateRequestBody = {
    amount: productAmount,
    currency: "INR",
    // receipt: receipt_no,
    payment_capture: true,
    ...more_options,
  };

  return razorpay.orders.create(options);
};

export const fetchAnOrderInfo = async (order_id: string) => {
  const keyID = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const razorpay = new Razorpay({
    key_id: keyID,
    key_secret: keySecret,
  });

  return razorpay.orders.fetch(order_id);
};

export const fetchAnPaymentInfo = async (order_id: string) => {
  const keyID = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const razorpay = new Razorpay({
    key_id: keyID,
    key_secret: keySecret,
  });

  return await razorpay.orders.fetchPayments(order_id);
};

export const getPaymentList = async () => {
  const keyID = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const razorpay = new Razorpay({
    key_id: keyID,
    key_secret: keySecret,
  });

  const options_to_add: Payments.RazorpayPaymentQuery | undefined = {
    count: 100, // Number of payments to fetch (max 100)
    skip: 0, // Number of payments to skip
    // from: 1640995200, // Unix timestamp - payments from this date
    // to: 1672531200, // Unix timestamp - payments till this date
    // You can also filter by specific payment methods, status, etc.
  };

  // return razorpay.orders.all({
  //   receipt : "FBD/2025/41819"
  // })

  return await razorpay.payments.all(options_to_add);
};
