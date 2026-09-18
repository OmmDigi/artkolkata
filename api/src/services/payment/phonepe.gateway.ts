import crypto from "crypto";
import {
  Env,
  RefundRequest,
  StandardCheckoutClient,
  StandardCheckoutPayRequest,
} from "@phonepe-pg/pg-sdk-node";
import { v4 as uuidv4 } from "uuid";
import {
  CreatePaymentLinkInput,
  describeInstrument,
  IPaymentGateway,
  PaymentEvent,
  PaymentInstrument,
  PaymentInstrumentType,
  PaymentLink,
  PaymentSnapshot,
  PaymentStatus,
  WebhookRequest,
} from "./payment.gateway";
import { ErrorHandler } from "../../utils/ErrorHandler";
import logger from "../../utils/logger";
import {
  findPaymentByOrderId,
  markPaymentRefunded,
} from "../../utils/recordPaymentEvent";

const toPaise = (rupees: number) => Math.round(rupees * 100);
const toRupees = (paise: number) => (paise ?? 0) / 100;

/**
 * PhonePe Standard Checkout.
 *
 * PhonePe hosts the payment page itself, so createPaymentLink hands back
 * PhonePe's own URL and no view of ours is involved.
 *
 * The id PhonePe echoes on every notification is the merchantOrderId we
 * generated, so that — not PhonePe's internal orderId — is what goes into
 * payments.provider_order_id and stays there. Overwriting it with PhonePe's
 * orderId would leave the later refund notification, which only ever names
 * originalMerchantOrderId, with nothing to match against.
 */
export class PhonePeGateway implements IPaymentGateway {
  readonly name = "phonepe" as const;
  readonly label = "PhonePe";

  private client: StandardCheckoutClient;
  private webhookUser: string;
  private webhookPass: string;

  constructor(
    merchantId: string,
    merchantKey: string,
    webhookUser: string,
    webhookPass: string,
  ) {
    if (!merchantId) throw new Error("PHONEPE_MERCHANT_ID is required");
    if (!merchantKey) throw new Error("PHONEPE_MERCHANT_KEY is required");
    if (!webhookUser) throw new Error("PHONEPE_WEBHOOK_USER is required");
    if (!webhookPass) throw new Error("PHONEPE_WEBHOOK_PASS is required");

    const env =
      process.env.NODE_ENV === "production" ? Env.PRODUCTION : Env.SANDBOX;

    // getInstance caches internally, so this is the one client the process
    // uses — building a new one per request re-does the token handshake.
    this.client = StandardCheckoutClient.getInstance(
      merchantId,
      merchantKey,
      1,
      env,
    );

    this.webhookUser = webhookUser;
    this.webhookPass = webhookPass;
  }

  createPaymentLink = async (
    input: CreatePaymentLinkInput,
  ): Promise<PaymentLink> => {
    const request = StandardCheckoutPayRequest.builder()
      .merchantOrderId(input.merchantOrderId)
      .amount(toPaise(input.amount))
      .redirectUrl(
        `${process.env.API_BASE_URL}/api/v1/payments/status?provider_order_id=${input.merchantOrderId}`,
      )
      .build();

    const response = await this.client.pay(request);

    if (!response?.redirectUrl)
      throw new ErrorHandler(502, "PhonePe did not return a payment page");

    return {
      providerOrderId: input.merchantOrderId,
      paymentPageUrl: response.redirectUrl,
    };
  };

  refundPayment = async (
    orderRowId: number,
    amount?: number,
  ): Promise<boolean> => {
    const payment = await findPaymentByOrderId(orderRowId);

    if (!payment) {
      logger.error({ message: "PhonePe refund: no payments row", orderRowId });
      return false;
    }

    if (payment.status !== "PAID") {
      logger.error({
        message: "PhonePe refund: payment is not in a refundable state",
        orderRowId,
        status: payment.status,
      });
      return false;
    }

    if (!payment.provider_order_id) {
      logger.error({
        message: "PhonePe refund: payments row has no provider_order_id",
        orderRowId,
      });
      return false;
    }

    // PhonePe has no full-refund shorthand — the amount is always explicit, so
    // an omitted one means everything the order took.
    const refundAmount = amount ?? parseFloat(payment.amount);

    try {
      const request = RefundRequest.builder()
        .merchantRefundId(uuidv4())
        .originalMerchantOrderId(payment.provider_order_id)
        .amount(toPaise(refundAmount))
        .build();

      const response = await this.client.refund(request);

      // PhonePe usually answers PENDING and settles later over the
      // pg.refund.completed webhook, so the row is only moved when PhonePe
      // says the money is actually back.
      if (response.state === "COMPLETED" || response.state === "CONFIRMED") {
        await markPaymentRefunded(
          payment.payment_id,
          payment.order_id,
          response.refundId,
          response,
        );
      }

      return response.state !== "FAILED";
    } catch (error) {
      logger.error({ message: "PhonePe refund failed", orderRowId, error });
      return false;
    }
  };

  verifyWebhook = (request: WebhookRequest): PaymentEvent | null => {
    const received = request.headers["authorization"];

    if (typeof received !== "string")
      throw new ErrorHandler(401, "Missing PhonePe authorization header");

    // PhonePe sends the sha256 of the dashboard credentials, not basic auth.
    const expected = crypto
      .createHash("sha256")
      .update(`${this.webhookUser}:${this.webhookPass}`)
      .digest("hex");

    const a = Buffer.from(expected);
    const b = Buffer.from(received);

    if (a.length !== b.length || !crypto.timingSafeEqual(a, b))
      throw new ErrorHandler(401, "Invalid PhonePe credentials");

    if (!Buffer.isBuffer(request.rawBody))
      throw new ErrorHandler(400, "PhonePe webhook body must be raw");

    const body = JSON.parse(request.rawBody.toString("utf8"));
    const payload = body?.payload ?? {};
    const detail = payload.paymentDetails?.[0];

    const occurredAt = detail?.timestamp
      ? new Date(detail.timestamp)
      : new Date();

    switch (body?.event) {
      case "checkout.order.completed":
      case "pg.order.completed":
        return {
          status: "PAID",
          providerOrderId: payload.merchantOrderId,
          providerPaymentId: detail?.transactionId ?? null,
          amount: toRupees(payload.amount),
          instrument: this.toInstrument(detail),
          occurredAt,
          raw: body,
        };

      case "checkout.order.failed":
      case "pg.order.failed":
        return {
          status: "FAILED",
          providerOrderId: payload.merchantOrderId,
          providerPaymentId: detail?.transactionId ?? null,
          amount: toRupees(payload.amount),
          instrument: this.toInstrument(detail),
          occurredAt,
          raw: body,
        };

      case "pg.refund.completed":
        return {
          status: "REFUNDED",
          // A refund names the order it reverses, never the refund's own
          // merchantRefundId — that is what the payments row is keyed on.
          providerOrderId: payload.originalMerchantOrderId,
          providerPaymentId: payload.refundId ?? null,
          amount: toRupees(payload.amount),
          // A refund reverses a payment; it is not itself a way of paying, so
          // the instrument already on the row is the one that stands.
          instrument: null,
          occurredAt,
          raw: body,
        };

      default:
        // A failed attempt on an order the customer then retries, a failed
        // refund, anything new PhonePe adds: acknowledged, not acted on.
        return null;
    }
  };

  fetchPaymentStatus = async (
    providerOrderId: string,
  ): Promise<PaymentSnapshot> => {
    const response = await this.client.getOrderStatus(providerOrderId);
    const detail = response.paymentDetails?.[0];

    const status: PaymentStatus =
      response.state === "COMPLETED"
        ? "PAID"
        : response.state === "FAILED"
          ? "FAILED"
          : "PENDING";

    return {
      status,
      providerOrderId,
      providerPaymentId: detail?.transactionId ?? null,
      amount: toRupees(response.amount),
      instrument: this.toInstrument(detail),
      occurredAt: detail?.timestamp ? new Date(detail.timestamp) : new Date(),
      message:
        status === "PAID"
          ? "Payment successful"
          : (detail?.errorCode ?? `Payment ${response.state}`),
      raw: response,
    };
  };

  /**
   * Reads how the customer paid out of one paymentDetails entry.
   *
   * PhonePe splits this across two objects. paymentMode is the coarse kind,
   * rail carries the UPI side (the vpa, the utr the customer's bank shows),
   * and instrument carries the card or account side. Newer responses wrap both
   * in splitInstruments so a part-wallet part-UPI payment can name each half —
   * the first entry is the one that carried the bulk of it, and the older flat
   * shape is still read for orders placed before PhonePe moved them.
   */
  private toInstrument = (detail: any): PaymentInstrument | null => {
    if (!detail) return null;

    const split = detail.splitInstruments?.[0] ?? detail;
    const rail = split.rail ?? {};
    const instrument = split.instrument ?? {};

    const mode: string = detail.paymentMode ?? rail.type ?? "";

    const type: PaymentInstrumentType = mode.startsWith("UPI")
      ? "UPI"
      : mode === "CARD" || mode === "TOKEN"
        ? "CARD"
        : mode === "NET_BANKING"
          ? "NETBANKING"
          : mode === "WALLET" || rail.type === "PPI_WALLET"
            ? "WALLET"
            : mode === "EMI"
              ? "EMI"
              : rail.type === "UPI"
                ? "UPI"
                : "OTHER";

    // accountType is CREDIT / DEBIT / SAVINGS; only the card senses belong on
    // cardType, or a UPI payment from a savings account reads as a card.
    const accountType: string | null = instrument.accountType ?? null;
    const cardType =
      accountType === "CREDIT" || accountType === "DEBIT" ? accountType : null;

    // maskedAccountNumber is XXXXXXXX1234 — the trailing four is all that is
    // ever stored, and all PhonePe sends.
    const masked: string | null = instrument.maskedAccountNumber ?? null;
    const last4 = masked ? masked.replace(/\D/g, "").slice(-4) || null : null;

    return describeInstrument({
      type,
      upiId: rail.vpa ?? rail.upiId ?? null,
      cardLast4: type === "CARD" || type === "EMI" ? last4 : null,
      cardNetwork: instrument.cardNetwork ?? null,
      cardType,
      bank: instrument.bankId ?? instrument.ifsc ?? null,
      wallet: rail.type === "PPI_WALLET" ? "PhonePe" : null,
      // The utr is what a UPI customer reads off their own statement; the PG
      // rail names its authorization code instead.
      referenceId:
        rail.utr ?? rail.upiTransactionId ?? rail.authorizationCode ?? null,
    });
  };
}
