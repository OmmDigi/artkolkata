import crypto from "crypto";
import Razorpay from "razorpay";
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
import { createToken } from "../jwt";
import { ErrorHandler } from "../../utils/ErrorHandler";
import logger from "../../utils/logger";
import {
  findPaymentByOrderId,
  markPaymentRefunded,
} from "../../utils/recordPaymentEvent";

const toPaise = (rupees: number) => Math.round(rupees * 100);
const toRupees = (paise: number) => paise / 100;

/**
 * Razorpay.
 *
 * Razorpay has no hosted page of its own for this integration — the checkout
 * is a script that has to run in a page we own. So createPaymentLink returns
 * our own /payments/razorpay-gateway/:token URL, which renders
 * views/razorpay-gateway.ejs. The token is signed, so the amount and the order
 * id cannot be edited in the address bar on the way to it.
 */
export class RazorpayGateway implements IPaymentGateway {
  readonly name = "razorpay" as const;
  readonly label = "Razorpay";

  private client: Razorpay;
  private webhookSecret: string;

  constructor(keyId: string, keySecret: string, webhookSecret: string) {
    if (!keyId) throw new Error("RAZORPAY_KEY_ID is required");
    if (!keySecret) throw new Error("RAZORPAY_KEY_SECRET is required");
    if (!webhookSecret)
      throw new Error("RAZORPAY_WEBHOOK_SECRET is required");

    this.client = new Razorpay({ key_id: keyId, key_secret: keySecret });
    this.webhookSecret = webhookSecret;
  }

  createPaymentLink = async (
    input: CreatePaymentLinkInput,
  ): Promise<PaymentLink> => {
    const order = await this.client.orders.create({
      amount: toPaise(input.amount),
      currency: "INR",
      payment_capture: true,
      notes: {
        order_row_id: String(input.orderRowId),
        merchant_order_id: input.merchantOrderId,
      },
    });

    // Razorpay's own order id is what every webhook for this payment carries,
    // so that is the key the payments row is found by.
    const paymentToken = createToken({
      orderRowId: input.orderRowId,
      gatewayOrderId: order.id,
      amount: input.amount,
    });

    return {
      providerOrderId: order.id,
      paymentPageUrl: `${process.env.API_BASE_URL}/api/v1/payments/razorpay-gateway/${paymentToken}`,
    };
  };

  refundPayment = async (
    orderRowId: number,
    amount?: number,
  ): Promise<boolean> => {
    const payment = await findPaymentByOrderId(orderRowId);

    if (!payment) {
      logger.error({
        message: "Razorpay refund: no payments row",
        orderRowId,
      });
      return false;
    }

    if (payment.status !== "PAID") {
      // A PENDING or FAILED row never took money, and a REFUNDED one is done.
      logger.error({
        message: "Razorpay refund: payment is not in a refundable state",
        orderRowId,
        status: payment.status,
      });
      return false;
    }

    const paymentId = await this.resolvePaymentId(payment.provider_payment_id, payment.provider_order_id);

    if (!paymentId) {
      logger.error({
        message: "Razorpay refund: no captured payment found for the order",
        orderRowId,
      });
      return false;
    }

    try {
      const refund = await this.client.payments.refund(paymentId, {
        // Omitting amount refunds the whole payment, which is what Razorpay
        // does when the key is absent — so only send it for a partial.
        ...(amount === undefined ? {} : { amount: toPaise(amount) }),
        speed: "normal",
      });

      // "processed" is settled. "pending" means Razorpay took it but the bank
      // has not confirmed; the refund.processed webhook closes that out, so
      // the row is left alone rather than claiming money has moved.
      if (refund.status === "processed") {
        await markPaymentRefunded(
          payment.payment_id,
          payment.order_id,
          refund.id,
          refund,
        );
      }

      return refund.status !== "failed";
    } catch (error) {
      logger.error({
        message: "Razorpay refund failed",
        orderRowId,
        error,
      });
      return false;
    }
  };

  verifyWebhook = (request: WebhookRequest): PaymentEvent | null => {
    const received = request.headers["x-razorpay-signature"];

    if (typeof received !== "string")
      throw new ErrorHandler(401, "Missing Razorpay signature");

    if (!Buffer.isBuffer(request.rawBody))
      throw new ErrorHandler(400, "Razorpay webhook body must be raw");

    const expected = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(request.rawBody)
      .digest("hex");

    const a = Buffer.from(expected);
    const b = Buffer.from(received);

    if (a.length !== b.length || !crypto.timingSafeEqual(a, b))
      throw new ErrorHandler(401, "Invalid Razorpay signature");

    const body = JSON.parse(request.rawBody.toString("utf8"));
    const paymentEntity = body?.payload?.payment?.entity;
    const refundEntity = body?.payload?.refund?.entity;

    switch (body?.event) {
      case "payment.captured":
        return {
          status: "PAID",
          providerOrderId: paymentEntity.order_id,
          providerPaymentId: paymentEntity.id,
          amount: toRupees(paymentEntity.amount),
          instrument: this.toInstrument(paymentEntity),
          occurredAt: new Date(paymentEntity.created_at * 1000),
          raw: body,
        };

      case "payment.failed":
        return {
          status: "FAILED",
          providerOrderId: paymentEntity.order_id,
          providerPaymentId: paymentEntity.id,
          amount: toRupees(paymentEntity.amount),
          instrument: this.toInstrument(paymentEntity),
          occurredAt: new Date(paymentEntity.created_at * 1000),
          raw: body,
        };

      case "refund.processed":
        return {
          status: "REFUNDED",
          // The refund event still carries the payment it reverses, and that
          // payment carries the order id the payments row is keyed on.
          providerOrderId: paymentEntity.order_id,
          providerPaymentId: refundEntity?.id ?? null,
          amount: toRupees(refundEntity?.amount ?? paymentEntity.amount),
          // A refund is not a way of paying — the instrument already recorded
          // for the payment it reverses is the one that stands.
          instrument: null,
          occurredAt: new Date((refundEntity?.created_at ?? paymentEntity.created_at) * 1000),
          raw: body,
        };

      default:
        // Everything else Razorpay pushes (order.paid, refund.created, the
        // settlement events) is either duplicate news or none of our business.
        return null;
    }
  };

  fetchPaymentStatus = async (
    providerOrderId: string,
  ): Promise<PaymentSnapshot> => {
    const { items, count } = await this.client.orders.fetchPayments(providerOrderId);

    if (count === 0) {
      return {
        status: "PENDING",
        providerOrderId,
        providerPaymentId: null,
        amount: 0,
        instrument: null,
        occurredAt: new Date(),
        message: "No payment attempted yet",
        raw: { items },
      };
    }

    // The newest attempt is the one that decides the order: a customer who
    // failed once and paid on the retry has paid.
    const payment = items[count - 1];

    const status: PaymentStatus =
      payment.status === "refunded"
        ? "REFUNDED"
        : payment.status === "captured"
          ? "PAID"
          : payment.status === "failed"
            ? "FAILED"
            : "PENDING";

    return {
      status,
      providerOrderId,
      providerPaymentId: payment.id,
      amount: toRupees(Number(payment.amount)),
      instrument: await this.withCardDetails(payment),
      occurredAt: new Date(Number(payment.created_at) * 1000),
      message:
        status === "PAID"
          ? "Payment successful"
          : (payment.error_description ?? `Payment ${payment.status}`),
      raw: payment,
    };
  };

  /**
   * Reads how the customer paid out of a Razorpay payment entity.
   *
   * Razorpay puts the kind in method and the details in a sibling key named
   * after it — card for a card, vpa for UPI, bank for net banking, wallet for
   * a wallet — so each is read from where that method actually puts it.
   */
  private toInstrument = (payment: any): PaymentInstrument | null => {
    if (!payment) return null;

    const method: string = payment.method ?? "";

    const type: PaymentInstrumentType =
      method === "upi"
        ? "UPI"
        : method === "card"
          ? "CARD"
          : method === "emi"
            ? "EMI"
            : method === "netbanking" || method === "bank_transfer"
              ? "NETBANKING"
              : method === "wallet"
                ? "WALLET"
                : method === "paylater"
                  ? "PAY_LATER"
                  : "OTHER";

    const card = payment.card ?? {};
    const acquirer = payment.acquirer_data ?? {};

    return describeInstrument({
      type,
      // Newer responses nest the vpa under upi; older ones put it at the top.
      upiId: payment.upi?.vpa ?? payment.vpa ?? null,
      cardLast4: card.last4 ?? null,
      cardNetwork: card.network ?? null,
      cardType: card.type ? card.type.toUpperCase() : null,
      bank: card.issuer ?? payment.bank ?? null,
      wallet: payment.wallet ?? null,
      // rrn for a card, utr for UPI — whichever Razorpay filled in is the one
      // the customer can quote to their own bank.
      referenceId:
        acquirer.rrn ??
        acquirer.upi_transaction_id ??
        acquirer.bank_transaction_id ??
        acquirer.auth_code ??
        null,
    });
  };

  /**
   * The same, for a payment fetched off an order.
   *
   * fetchPayments does not always expand the card, and a support ticket about
   * a card payment is exactly the one that needs the last four — so when only
   * a card_id came back, it is looked up. Best effort: a failed lookup costs
   * the card details, never the payment status the caller came for.
   */
  private withCardDetails = async (
    payment: any,
  ): Promise<PaymentInstrument | null> => {
    if (payment?.method !== "card" && payment?.method !== "emi")
      return this.toInstrument(payment);

    if (payment.card || !payment.card_id) return this.toInstrument(payment);

    try {
      const card = await this.client.payments.fetchCardDetails(payment.id);
      return this.toInstrument({ ...payment, card });
    } catch (error) {
      logger.error({
        message: "Razorpay: could not fetch card details",
        paymentId: payment.id,
        error,
      });
      return this.toInstrument(payment);
    }
  };

  /**
   * The payments row carries the payment id once the webhook has been by, but
   * a refund can be asked for before that — so fall back to asking Razorpay
   * which payment on the order was actually captured.
   */
  private resolvePaymentId = async (
    storedPaymentId: string | null,
    providerOrderId: string | null,
  ): Promise<string | null> => {
    if (storedPaymentId) return storedPaymentId;
    if (!providerOrderId) return null;

    const { items, count } = await this.client.orders.fetchPayments(providerOrderId);

    if (count === 0) return null;

    const captured = items.find((item) => item.status === "captured");
    return captured?.id ?? null;
  };
}
