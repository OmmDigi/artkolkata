import nodemailer, { Transporter } from "nodemailer";
import logger from "../../utils/logger";
import {
  EmailMessage,
  IEmailProvider,
  SendEmailResult,
  formatAddress,
} from "./email.provider";

/**
 * The nodemailer transport settings. Unchanged from the shape this project has
 * always used, so an existing .env keeps working untouched.
 */
export const smtpConf = () => {
  const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587");
  return {
    host: process.env.SMTP_HOST,
    port: SMTP_PORT, // Use 465 for SSL or 587 for TLS
    secure: SMTP_PORT === 465, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER, // Your email address
      pass: process.env.SMTP_PASSWORD, // Your email account password
    },
  };
};

/** Mail over a plain SMTP connection — the original path, now behind the interface. */
export class SmtpProvider implements IEmailProvider {
  readonly name = "smtp" as const;
  readonly label = "SMTP (nodemailer)";

  private readonly transport: Transporter;

  constructor() {
    const conf = smtpConf();

    // One transport for the process. Nodemailer pools the connection itself,
    // and building it here means a missing credential is a boot failure rather
    // than a silent no-op on the first OTP.
    if (!conf.host || !conf.auth.user || !conf.auth.pass)
      throw new Error(
        "EMAIL_PROVIDER=smtp needs SMTP_HOST, SMTP_USER and SMTP_PASSWORD",
      );

    this.transport = nodemailer.createTransport(conf);
  }

  async send(message: EmailMessage): Promise<SendEmailResult> {
    try {
      const info = await this.transport.sendMail({
        from: formatAddress(message.from),
        to: message.to,
        subject: message.subject,
        html: message.html,
        replyTo: message.replyTo,
        attachments: message.attachments?.map((file) => ({
          filename: file.filename,
          content: file.content,
          contentType: file.contentType,
        })),
      });

      return { ok: true, messageId: info.messageId };
    } catch (error) {
      logger.error({
        message: "Error sending email over SMTP",
        subject: message.subject,
        stack: error,
      });

      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async verify(): Promise<boolean> {
    try {
      await this.transport.verify();
      return true;
    } catch (error) {
      logger.error({ message: "SMTP credentials failed to verify", stack: error });
      return false;
    }
  }
}
