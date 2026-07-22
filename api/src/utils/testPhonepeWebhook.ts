import axios from "axios";

interface IProps {
  type: "checkout.order.completed" | "checkout.order.failed";
  orderid: string;
  merchantOrderId: string;
  state: "COMPLETED" | "FAILED";
  amount: number;
  timestamp: number;
  paymentId : string;
}
export async function testWebhook(props: IProps) {
  const username = process.env.PHONEPE_WEBHOOK_USER; // must match PHONEPE_WEBHOOK_USER
  const password = process.env.PHONEPE_WEBHOOK_PASS; // must match PHONEPE_WEBHOOK_PASS

  const basicAuth = Buffer.from(`${username}:${password}`).toString("base64");

  const payload = {
    event: props.type,
    payload: {
      orderId: props.orderid,
      merchantId: "merchantId",
      merchantOrderId: props.merchantOrderId,
      state: props.state,
      amount: props.amount,
      expireAt: 1724866793837,
      paymentDetails: [
        {
          paymentMode: "UPI_QR",
          transactionId: props.paymentId,
          timestamp: props.timestamp,
          amount: props.amount,
          state: props.state,
        },
      ],
    },
  };

  try {
    const response = await axios.post(
      "http://192.168.0.192:8080/api/v1/webhook/phonepe/verify",
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${basicAuth}`,
        },
      },
    );

    console.log("✅ Status:", response.status);
    console.log("✅ Response:", response.data);
  } catch (error: any) {
    console.error("❌ Error:", error.response?.status, error.response?.data);
  }
}
