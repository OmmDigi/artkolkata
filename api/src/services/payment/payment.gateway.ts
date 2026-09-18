/**
 * The one place that says what a payment gateway is.
 *
 * Everything above this file — the order controller, the webhook controller,
 * the status page — talks to IPaymentGateway and never to PhonePe or Razorpay
 * directly. Adding a gateway means writing one more implementation and
 * registering it in ./index.ts; no call site changes.
 */

export type PaymentGatewayName = "phonepe" | "razorpay";

// The four states a payments row can be in. Mirrors the CHECK-less status
// column on the payments table and the values the CMS filters on.
export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";

export interface CreatePaymentLinkInput {
  /**
   * The id we generate and own. It is what goes into
   * payments.provider_order_id for gateways that echo it back (PhonePe), and
   * what the gateway's own order id is minted against (Razorpay).
   */
  merchantOrderId: string;
  /** orders.order_id — the row the payment belongs to. */
  orderRowId: number;
  /** Rupees, not paise. Every implementation converts on its own. */
  amount: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
}

export interface PaymentLink {
  /**
   * What gets written to payments.provider_order_id, and therefore the key
   * every later webhook and status poll is matched on. It is whatever the
   * gateway will send back to identify this order — never overwrite it.
   */
  providerOrderId: string;
  /** Where the customer's browser is sent to pay. */
  paymentPageUrl: string;
}

/**
 * How the customer actually paid.
 *
 * "ONLINE" on the order only says money moved over the internet. Support, a
 * chargeback and a refund all need the next level down — the UPI id, the last
 * four of the card, the bank behind a net banking transfer — so every gateway
 * flattens its own instrument payload into this one shape.
 */
export type PaymentInstrumentType =
  | "UPI"
  | "CARD"
  | "NETBANKING"
  | "WALLET"
  | "EMI"
  | "PAY_LATER"
  | "COD"
  | "OTHER";

export interface PaymentInstrument {
  type: PaymentInstrumentType;
  /**
   * One line meant for a human: "UPI - somnath@ybl", "Visa credit card
   * xxxx 4242 - HDFC". Built by describeInstrument so every gateway words it
   * the same way and the CMS only has to print it.
   */
  label: string;
  /** The VPA, when they paid by UPI. */
  upiId?: string | null;
  /** Last four digits, when they paid by card. Never the full number. */
  cardLast4?: string | null;
  /** Visa, Mastercard, RuPay, Amex. */
  cardNetwork?: string | null;
  /** CREDIT, DEBIT or PREPAID. */
  cardType?: string | null;
  /** Issuing bank, or the bank behind a net banking transfer. */
  bank?: string | null;
  /** Wallet brand, when they paid from one. */
  wallet?: string | null;
  /**
   * UTR / RRN / auth code — the number that shows on the customer's own bank
   * statement, which is what they quote when they say the money left but the
   * order never confirmed.
   */
  referenceId?: string | null;
}

const titleCase = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();

/**
 * Turns the pieces a gateway managed to extract into the one line the CMS
 * shows. Lives here rather than in each gateway so PhonePe and Razorpay do not
 * drift into wording the same card two different ways.
 */
export const describeInstrument = (
  parts: Omit<PaymentInstrument, "label">,
): PaymentInstrument => {
  const label = (() => {
    switch (parts.type) {
      case "UPI":
        return parts.upiId ? `UPI - ${parts.upiId}` : "UPI";

      case "CARD":
      case "EMI": {
        // Whatever the gateway gave us, in the order a person reads it:
        // network, credit or debit, the masked number, then the issuer.
        const words = [
          parts.cardNetwork ? titleCase(parts.cardNetwork) : null,
          parts.cardType ? parts.cardType.toLowerCase() : null,
          parts.type === "EMI" ? "card EMI" : "card",
          parts.cardLast4 ? `xxxx ${parts.cardLast4}` : null,
        ].filter(Boolean);

        // Capitalised because the network is optional: without one the line
        // would otherwise start "card xxxx 1111" mid-sentence.
        const head = titleCase(words.join(" ")[0]) + words.join(" ").slice(1);

        return parts.bank ? `${head} - ${parts.bank}` : head;
      }

      case "NETBANKING":
        return parts.bank ? `Net banking - ${parts.bank}` : "Net banking";

      case "WALLET":
        return parts.wallet
          ? `Wallet - ${titleCase(parts.wallet)}`
          : "Wallet";

      case "PAY_LATER":
        return parts.bank ? `Pay later - ${parts.bank}` : "Pay later";

      case "COD":
        return "Cash on delivery";

      default:
        return "Other";
    }
  })();

  return { ...parts, label };
};

/**
 * A gateway notification, flattened to the handful of fields the database
 * cares about. Both the webhook and the status poll produce this shape, so one
 * writer (recordPaymentEvent) serves both paths.
 */
export interface PaymentEvent {
  status: PaymentStatus;
  /** Matched against payments.provider_order_id. */
  providerOrderId: string;
  /** The gateway's transaction / payment / refund id, when it sent one. */
  providerPaymentId: string | null;
  /** Rupees. */
  amount: number;
  /**
   * How they paid, when the gateway said. Null when it did not — a failed
   * attempt or a refund notification often carries no instrument at all, and
   * the writer keeps whatever is already on the row rather than blanking it.
   */
  instrument: PaymentInstrument | null;
  occurredAt: Date;
  /** Kept verbatim in payments.response for support and disputes. */
  raw: unknown;
}

/** What a status poll answers with — an event plus something to show a human. */
export interface PaymentSnapshot extends PaymentEvent {
  message: string;
}

/** The raw request a webhook handler hands to the gateway for verification. */
export interface WebhookRequest {
  /**
   * The unparsed body. Razorpay signs the exact bytes, so this must be the
   * Buffer express.raw produced and not a re-serialized object.
   */
  rawBody: Buffer;
  headers: Record<string, string | string[] | undefined>;
}

export interface IPaymentGateway {
  readonly name: PaymentGatewayName;
  /** Human-readable, stored in payments.provider and shown in the CMS. */
  readonly label: string;

  /**
   * Creates the order at the gateway and returns the page to send the
   * customer to. Throws if the gateway refuses — the caller is inside the
   * order transaction, so a throw correctly rolls the order back.
   */
  createPaymentLink(input: CreatePaymentLinkInput): Promise<PaymentLink>;

  /**
   * Refunds a paid order, in full when amount is omitted and partially
   * otherwise. Returns whether the gateway accepted the refund — accepted, not
   * necessarily settled: PhonePe confirms asynchronously over the webhook, so
   * the payments row only flips to REFUNDED once the gateway says it is done.
   */
  refundPayment(orderRowId: number, amount?: number): Promise<boolean>;

  /**
   * Authenticates an incoming webhook and flattens it.
   *
   * Throws when the signature or credentials do not check out — the caller
   * answers 401 and writes nothing. Returns null for a genuine notification
   * that does not move money (an attempt-failed ping, a refund we do not act
   * on), which the caller acknowledges with 200 and ignores.
   */
  verifyWebhook(request: WebhookRequest): PaymentEvent | null;

  /**
   * Asks the gateway where a payment actually stands. This is the fallback for
   * the customer who closed the tab before the redirect landed, and the
   * reconcile path for a webhook that never arrived.
   */
  fetchPaymentStatus(providerOrderId: string): Promise<PaymentSnapshot>;
}
