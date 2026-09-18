import { BrevoProvider } from "./brevo.provider";
import {
  EmailAddress,
  EmailProviderName,
  IEmailProvider,
} from "./email.provider";
import { NoneEmailProvider } from "./none.provider";
import { SmtpProvider } from "./smtp.provider";

export * from "./email.provider";
export { smtpConf } from "./smtp.provider";

/**
 * The live email provider, built once when the server starts.
 *
 * Constructing it at boot rather than per send means a missing key is a loud
 * startup failure instead of a customer never receiving their OTP, and every
 * call site then reads the same object.
 */
let provider: IEmailProvider | null = null;

const SUPPORTED: EmailProviderName[] = ["smtp", "brevo", "none"];

const build = (name: EmailProviderName): IEmailProvider => {
  if (name === "none") return new NoneEmailProvider();
  if (name === "brevo") return new BrevoProvider();
  return new SmtpProvider();
};

/**
 * Who the mail comes from.
 *
 * SMTP could get away with reusing SMTP_USER, since the login and the sender
 * were the same mailbox. Brevo cannot: it wants an explicit verified sender and
 * the api key carries no address of its own. MAIL_FROM_EMAIL is that address,
 * and it falls back to SMTP_USER so a deployment that has not set it keeps
 * sending exactly as before.
 *
 * `name` overrides the default display name — sendEmail uses it to keep the
 * per-email wording each template already had ("Email Verification OTP",
 * "Invoice From ...").
 */
// `||`, not `??`: the env file ships these keys present but blank, and an
// empty string is a value as far as ?? is concerned — it would send mail from
// nobody rather than falling back to SMTP_USER.
export const emailSender = (name?: string): EmailAddress => ({
  email: (process.env.MAIL_FROM_EMAIL || process.env.SMTP_USER || "").trim(),
  name: name || process.env.MAIL_FROM_NAME || process.env.COMPANY_NAME,
});

/**
 * The address the emails and rendered views tell a customer to write to.
 *
 * Separate from emailSender: mail goes out from a no-reply/transactional
 * mailbox, while this is the human one somebody actually reads. Falls back to
 * the sending address so a deployment that has not set SUPPORT_EMAIL still
 * prints a working address rather than an empty mailto: link.
 */
export const supportEmail = (): string =>
  (
    process.env.SUPPORT_EMAIL ||
    process.env.MAIL_FROM_EMAIL ||
    process.env.SMTP_USER ||
    ""
  ).trim();

/**
 * Reads EMAIL_PROVIDER and stands the provider up. Call once, from index.ts,
 * after dotenv has run.
 *
 * Throws on an unknown name instead of quietly falling back to SMTP. A typo
 * that fell back would look like it worked right up until someone checked why
 * the Brevo dashboard was empty; a refusal to start is visible in the first
 * second and fixed by editing one line of env.
 */
export const initEmailProvider = (): IEmailProvider => {
  const configured = (process.env.EMAIL_PROVIDER || "smtp")
    .trim()
    .toLowerCase() as EmailProviderName;

  if (!SUPPORTED.includes(configured))
    throw new Error(
      `EMAIL_PROVIDER "${configured}" is not supported. Use one of: ${SUPPORTED.join(", ")}`,
    );

  provider = build(configured);

  if (provider.name !== "none" && !emailSender().email)
    throw new Error(
      "No sender address — set MAIL_FROM_EMAIL (or SMTP_USER) to the address mail is sent from",
    );

  // Deliberately not awaited: a slow mail host should not hold the port
  // closed. It only has to reach the log before anyone notices a missing email.
  provider.verify().then((ok) => {
    if (!ok)
      console.log(
        `Email provider ${provider?.label} did not verify — mail will fail`,
      );
  });

  console.log(`Email provider: ${provider.label}`);

  return provider;
};

/**
 * Is there a real mail integration at all?
 *
 * getEmailProvider() always returns something, so this is the question a call
 * site asks when it has to *word* itself differently — telling an admin an
 * invoice was emailed, when the shop sends no email, is a lie. Call sites that
 * merely send go straight through the provider and get a harmless no-op.
 */
export const isEmailEnabled = (): boolean =>
  getEmailProvider().name !== "none";

/** The active provider. Every send goes through this. */
export const getEmailProvider = (): IEmailProvider => {
  if (!provider)
    throw new Error(
      "Email provider is not initialized — call initEmailProvider() at startup",
    );

  return provider;
};
