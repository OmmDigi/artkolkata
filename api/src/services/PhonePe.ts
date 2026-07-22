import { Env, StandardCheckoutClient, StandardCheckoutPayRequest } from "@phonepe-pg/pg-sdk-node";
import { PaymentResponse } from "../types";

interface ICreateOrderPayload {
  merchantUserId: string;
  mobileNumber: string;
  amount: number;
  merchantTransactionId: string;
  redirectUrl: string;
  redirectMode: "POST" | "GET";
  paymentInstrument: object;
}

interface ICreateOrderResponse {
  success: boolean;
  code: string;
  message: string;
  data: {
    merchantId: string;
    merchantTransactionId: string;
    instrumentResponse: {
      type: string;
      redirectInfo: {
        url: string;
        method: "POST" | "GET";
      };
    };
  };
}

export class PhonePe {
  private MERCHANT_KEY: string | null = null;
  private MERCHANT_ID: string | null = null;
  private PHONEPE_MERCHANT_BASE_URL: string | null = null;
  private ENV_TYPE: Env = Env.SANDBOX;

  constructor(
    merchant_key: string,
    merchant_id: string,
    merchant_base_url: string,
    merchant_status_url: string,
  ) {
    if (merchant_key === "") throw new Error("merchant_key is required");
    if (merchant_id === "") throw new Error("merchant_id is required");
    if (merchant_base_url === "")
      throw new Error("merchant_base_url is required");
    if (merchant_status_url === "")
      throw new Error("merchant_status_url is required");

    this.MERCHANT_KEY = merchant_key;
    this.MERCHANT_ID = merchant_id;
    this.PHONEPE_MERCHANT_BASE_URL = merchant_base_url;
    this.ENV_TYPE =
      process.env.NODE_ENV === "development" ? Env.SANDBOX : Env.PRODUCTION;
  }

  createOrder = async (
    paymentPayload: ICreateOrderPayload,
  ): Promise<ICreateOrderResponse> => {
    if (this.MERCHANT_KEY === null)
      throw new Error("PHONEPE_MERCHANT_KEY is required");
    if (this.MERCHANT_ID === null)
      throw new Error("PHONEPE_MERCHANT_ID is required");
    if (this.PHONEPE_MERCHANT_BASE_URL === null)
      throw new Error("PHONEPE_MERCHANT_BASE_URL is required");

    if (this.ENV_TYPE === null)
      throw new Error("PHONEPE_MERCHANT_TYPE is required");

    const client = StandardCheckoutClient.getInstance(
      this.MERCHANT_ID,
      this.MERCHANT_KEY,
      1,
      this.ENV_TYPE,
    );

    const merchantOrderId = paymentPayload.merchantTransactionId;
    const amount = paymentPayload.amount;
    const redirectUrl = paymentPayload.redirectUrl;

    const request = StandardCheckoutPayRequest.builder()
      .merchantOrderId(merchantOrderId)
      .amount(Math.round(amount))
      .redirectUrl(redirectUrl)
      .build();
    const response = await client.pay(request);
    return {
      success: true,
      code: "200",
      message: "Phonepe Payment Page",
      data: {
        merchantId: this.MERCHANT_ID,
        merchantTransactionId: response.orderId,
        instrumentResponse: {
          type: "payment",
          redirectInfo: {
            url: response.redirectUrl,
            method: "GET",
          },
        },
      },
    };
  };

  // createOrder = async (
  //   paymentPayload: ICreateOrderPayload
  // ): Promise<ICreateOrderResponse> => {
  //   if (this.MERCHANT_KEY === null)
  //     throw new Error("PHONEPE_MERCHANT_KEY is required");
  //   if (this.MERCHANT_ID === null)
  //     throw new Error("PHONEPE_MERCHANT_ID is required");
  //   if (this.PHONEPE_MERCHANT_BASE_URL === null)
  //     throw new Error("PHONEPE_MERCHANT_BASE_URL is required");
  //   if (this.TYPE === null)
  //     throw new Error("PHONEPE_MERCHANT_TYPE is required");

  //   const client = StandardCheckoutClient.getInstance(
  //     this.MERCHANT_ID,
  //     this.MERCHANT_KEY,
  //     1,
  //     this.TYPE
  //   );

  //   const merchantOrderId = paymentPayload.merchantTransactionId;
  //   const amount = paymentPayload.amount;
  //   const redirectUrl = paymentPayload.redirectUrl;
  //   const metaInfo = MetaInfo.builder().udf1("udf1").udf2("udf2").build();

  //   const request = StandardCheckoutPayRequest.builder()
  //     .merchantOrderId(merchantOrderId)
  //     .amount(amount)
  //     .redirectUrl(redirectUrl)
  //     .metaInfo(metaInfo)
  //     .build();

  //   const newPaymentPayload = {
  //     merchantId: this.MERCHANT_ID,
  //     ...paymentPayload,
  //   };

  //   const payload = Buffer.from(JSON.stringify(newPaymentPayload)).toString(
  //     "base64"
  //   );
  //   const keyIndex = 1;
  //   const string = payload + "/pg/v2/pay" + this.MERCHANT_KEY;
  //   crypto.SHA256(string);
  //   // const sha256 = crypto.createHash('sha256').update(string).digest('hex')
  //   const sha256 = crypto.SHA256(string).toString();
  //   const checksum = sha256 + "###" + keyIndex;

  //   client.pay(request).then((response) => {
  //     const checkoutPageUrl = response.redirectUrl;
  //   });

  //   const axiosOptions = {
  //     method: "POST",
  //     url: this.PHONEPE_MERCHANT_BASE_URL,
  //     headers: {
  //       accept: "application/json",
  //       "Content-Type": "application/json",
  //       "X-VERIFY": checksum,
  //     },
  //     data: {
  //       request: payload,
  //     },
  //   };

  //   const response = await axios.request(axiosOptions);
  //   // return response.data.data.instrumentResponse.redirectInfo.url;
  //   return response.data;
  // };

  // checkStatus = async (
  //   merchantTransactionId: string
  // ): Promise<PaymentResponse> => {
  //   if (this.MERCHANT_KEY === null)
  //     throw new Error("PHONEPE_MERCHANT_KEY is required");
  //   if (this.MERCHANT_ID === null) throw new Error("MERCHANT_ID is required");
  //   if (this.PHONEPE_MERCHANT_STATUS_URL === null)
  //     throw new Error("PHONEPE_MERCHANT_STATUS_URL is required");

  //   const keyIndex = 1;
  //   const string =
  //     `/pg/v1/status/${this.MERCHANT_ID}/${merchantTransactionId}` +
  //     this.MERCHANT_KEY;
  //   // const sha256 = crypto.createHash('sha256').update(string).digest('hex')
  //   const sha256 = crypto.SHA256(string).toString();
  //   const checksum = sha256 + "###" + keyIndex;

  //   const option = {
  //     method: "GET",
  //     url: `${this.PHONEPE_MERCHANT_STATUS_URL}/${this.MERCHANT_ID}/${merchantTransactionId}`,
  //     headers: {
  //       accept: "application/json",
  //       "Content-Type": "application/json",
  //       "X-VERIFY": checksum,
  //       "X-MERCHANT-ID": this.MERCHANT_ID,
  //     },
  //   };

  //   return (await axios.request(option)).data;
  // };

  checkStatus = async (merchantOrderId: string): Promise<PaymentResponse> => {
    if (this.MERCHANT_KEY === null)
      throw new Error("PHONEPE_MERCHANT_KEY is required");
    if (this.MERCHANT_ID === null)
      throw new Error("PHONEPE_MERCHANT_ID is required");
    if (this.PHONEPE_MERCHANT_BASE_URL === null)
      throw new Error("PHONEPE_MERCHANT_BASE_URL is required");

    if (this.ENV_TYPE === null)
      throw new Error("PHONEPE_MERCHANT_TYPE is required");

    const client = StandardCheckoutClient.getInstance(
      this.MERCHANT_ID,
      this.MERCHANT_KEY,
      1,
      this.ENV_TYPE,
    );

    const response = await client.getOrderStatus(merchantOrderId);
    return {
      success: response.paymentDetails[0].state === "COMPLETED",
      code: "200",
      message: response.state,
      data: {
        amount: response.amount,
        orderId: response.orderId!,
        state: response.state,
        transactionId: response.paymentDetails[0].transactionId,
        responseCode: "200",
        paymentInstrument: response.paymentDetails,
      },
    };
  };

  checkTransitionStatus = async (
    transactionId: string,
  ): Promise<PaymentResponse> => {
    if (this.MERCHANT_KEY === null)
      throw new Error("PHONEPE_MERCHANT_KEY is required");
    if (this.MERCHANT_ID === null)
      throw new Error("PHONEPE_MERCHANT_ID is required");
    if (this.PHONEPE_MERCHANT_BASE_URL === null)
      throw new Error("PHONEPE_MERCHANT_BASE_URL is required");

    if (this.ENV_TYPE === null)
      throw new Error("PHONEPE_MERCHANT_TYPE is required");

    const client = StandardCheckoutClient.getInstance(
      this.MERCHANT_ID,
      this.MERCHANT_KEY,
      1,
      this.ENV_TYPE,
    );

    const response = await client.getTransactionStatus(transactionId);
    return {
      success: response.paymentDetails[0].state === "COMPLETED",
      code: "200",
      message: response.state,
      data: {
        amount: response.amount,
        orderId: response.orderId!,
        state: response.state,
        transactionId: response.paymentDetails[0].transactionId,
        responseCode: "200",
        paymentInstrument: response.paymentDetails,
      },
    };
  };
}
