/**
 * The one place that says what an email provider is.
 *
 * Everything above this file — sendEmail(), and through it the signup OTP, the
 * order confirmation, the staff alert — talks to IEmailProvider and never to
 * nodemailer or Brevo directly. Adding a provider means writing one more
 * implementation and registering it in ./index.ts; no call site changes.
 */

export type EmailProviderName = "smtp" | "brevo" | "none";

export interface EmailAddress {
  /** Display name shown in the inbox. Optional; the address alone is valid. */
  name?: string;
  email: string;
}

export interface EmailAttachment {
  filename: string;
  /**
   * Raw bytes. Nodemailer takes the buffer as it is, Brevo wants base64 — each
   * implementation converts on its own so call sites never have to care.
   */
  content: Buffer;
  contentType?: string;
}

export interface EmailMessage {
  /** Always a list, even for one recipient, so implementations stop branching. */
  to: string[];
  from: EmailAddress;
  subject: string;
  html: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}

/**
 * Sending never throws — see the comment on IEmailProvider.send. This is how a
 * failure comes back instead.
 */
export interface SendEmailResult {
  ok: boolean;
  /** The provider's id for the accepted message, when it hands one back. */
  messageId?: string;
  /** Set only when ok is false. Already logged by the implementation. */
  error?: string;
}

export interface IEmailProvider {
  readonly name: EmailProviderName;
  /** Human wording for the boot log. */
  readonly label: string;

  /**
   * Hands the message to the provider.
   *
   * Resolves to { ok: false } rather than throwing. Most call sites — the OTP
   * on signup, the alert to order staff — do not await this, so a rejected
   * promise would become an unhandled rejection and, with it, a process-level
   * crash on a mail server having a bad minute. The implementation logs the
   * real error before returning.
   */
  send(message: EmailMessage): Promise<SendEmailResult>;

  /**
   * A cheap credential check, run once at boot so a wrong key is visible in the
   * startup log instead of in a customer never receiving their OTP.
   */
  verify(): Promise<boolean>;
}

/** "Name" <address@host> — the only format nodemailer's `from` field takes. */
export const formatAddress = (address: EmailAddress): string =>
  address.name ? `"${address.name}" <${address.email}>` : address.email;
