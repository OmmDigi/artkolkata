import logger from "../../utils/logger";
import {
  EmailMessage,
  IEmailProvider,
  SendEmailResult,
} from "./email.provider";

/**
 * Sends nothing.
 *
 * Lets the api run locally, or in a staging copy, without SMTP or Brevo
 * credentials — and without a developer accidentally emailing a real customer
 * out of a restored production dump. Every send is logged so the flow is still
 * checkable, then reported as a success, because the call sites treat a failure
 * as something worth alerting about and nothing is actually wrong here.
 */
export class NoneEmailProvider implements IEmailProvider {
  readonly name = "none" as const;
  readonly label = "None (email disabled)";

  async send(message: EmailMessage): Promise<SendEmailResult> {
    logger.info({
      message: "Email not sent — EMAIL_PROVIDER is none",
      to: message.to,
      subject: message.subject,
    });

    return { ok: true };
  }

  async verify(): Promise<boolean> {
    return true;
  }
}
