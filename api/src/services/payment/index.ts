import { IPaymentGateway, PaymentGatewayName } from "./payment.gateway";
import { PhonePeGateway } from "./phonepe.gateway";
import { RazorpayGateway } from "./razorpay.gateway";

export * from "./payment.gateway";

/**
 * The live gateway, built once when the server starts.
 *
 * Constructing it at boot rather than per request means a missing key is a
 * loud startup failure instead of a customer watching checkout break, and it
 * means the PhonePe client's token handshake happens once.
 */
let gateway: IPaymentGateway | null = null;

const SUPPORTED: PaymentGatewayName[] = ["phonepe", "razorpay"];

const build = (name: PaymentGatewayName): IPaymentGateway => {
  if (name === "razorpay")
    return new RazorpayGateway(
      process.env.RAZORPAY_KEY_ID ?? "",
      process.env.RAZORPAY_KEY_SECRET ?? "",
      process.env.RAZORPAY_WEBHOOK_SECRET ?? "",
    );

  return new PhonePeGateway(
    process.env.PHONEPE_MERCHANT_ID ?? "",
    process.env.PHONEPE_MERCHANT_KEY ?? "",
    process.env.PHONEPE_WEBHOOK_USER ?? "",
    process.env.PHONEPE_WEBHOOK_PASS ?? "",
  );
};

/**
 * Reads PAYMENT_GATEWAY and stands the gateway up. Call once, from index.ts,
 * after dotenv has run.
 *
 * Throws on an unknown name instead of quietly falling back. A typo that fell
 * back would send live orders to the wrong merchant account and nobody would
 * notice until the settlement did not arrive; a refusal to start is visible in
 * the first second and fixed by editing one line of env.
 */
export const initPaymentGateway = (): IPaymentGateway => {
  // PAYMENT_PROVIDER is the name this used to be called. Still read so an
  // existing deployment's env keeps working.
  const configured = (
    process.env.PAYMENT_GATEWAY ??
    process.env.PAYMENT_PROVIDER ??
    "phonepe"
  )
    .trim()
    .toLowerCase() as PaymentGatewayName;

  if (!SUPPORTED.includes(configured))
    throw new Error(
      `PAYMENT_GATEWAY "${configured}" is not supported. Use one of: ${SUPPORTED.join(", ")}`,
    );

  gateway = build(configured);

  console.log(`Payment gateway: ${gateway.label}`);

  return gateway;
};

/** The active gateway. Every payment call site goes through this. */
export const getPaymentGateway = (): IPaymentGateway => {
  if (!gateway)
    throw new Error(
      "Payment gateway is not initialized — call initPaymentGateway() at startup",
    );

  return gateway;
};
