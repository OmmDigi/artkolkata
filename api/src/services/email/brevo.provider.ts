import axios from "axios";
import logger from "../../utils/logger";
import {
  EmailMessage,
  IEmailProvider,
  SendEmailResult,
} from "./email.provider";

const BREVO_API_BASE = "https://api.brevo.com/v3";

/**
 * Mail over Brevo's transactional HTTP API.
 *
 * Worth having alongside SMTP because the API answers on 443 — the port every
 * host leaves open — while 587 and 465 are blocked outright by a fair number of
 * cloud providers, and because the response carries a messageId that can be
 * matched against the Brevo dashboard when someone swears an email never came.
 *
 * The sender address must be a verified sender on the Brevo account, otherwise
 * every call comes back 400. Verify it in Brevo before pointing MAIL_FROM_EMAIL
 * at a new address.
 */
export class BrevoProvider implements IEmailProvider {
  readonly name = "brevo" as const;
  readonly label = "Brevo API";

  private readonly apiKey: string;

  constructor() {
    const apiKey = process.env.BREVO_API_KEY?.trim();

    if (!apiKey)
      throw new Error("EMAIL_PROVIDER=brevo needs BREVO_API_KEY");

    this.apiKey = apiKey;
  }

  private get headers() {
    return {
      "api-key": this.apiKey,
      accept: "application/json",
      "content-type": "application/json",
    };
  }

  async send(message: EmailMessage): Promise<SendEmailResult> {
    try {
      const { data } = await axios.post(
        `${BREVO_API_BASE}/smtp/email`,
        {
          sender: { email: message.from.email, name: message.from.name },
          to: message.to.map((email) => ({ email })),
          subject: message.subject,
          htmlContent: message.html,
          ...(message.replyTo ? { replyTo: { email: message.replyTo } } : {}),
          // Brevo takes attachments base64 encoded and calls the field "name",
          // not "filename".
          ...(message.attachments?.length
            ? {
                attachment: message.attachments.map((file) => ({
                  name: file.filename,
                  content: file.content.toString("base64"),
                })),
              }
            : {}),
        },
        {
          headers: this.headers,
          // Without this the request inherits axios' default of no timeout, and
          // a hung Brevo would hold an order confirmation open forever.
          timeout: 15000,
        },
      );

      return { ok: true, messageId: data?.messageId };
    } catch (error) {
      // Brevo explains the refusal in the body — "sender not valid", "unknown
      // parameter" — and that line is the whole debugging story, so it goes in
      // the log rather than a bare "Request failed with status code 400".
      const detail = axios.isAxiosError(error)
        ? JSON.stringify(error.response?.data ?? error.message)
        : error instanceof Error
          ? error.message
          : String(error);

      logger.error({
        message: "Error sending email over Brevo API",
        subject: message.subject,
        detail,
      });

      return { ok: false, error: detail };
    }
  }

  async verify(): Promise<boolean> {
    try {
      await axios.get(`${BREVO_API_BASE}/account`, {
        headers: this.headers,
        timeout: 10000,
      });
      return true;
    } catch (error) {
      logger.error({
        message: "BREVO_API_KEY failed to verify",
        detail: axios.isAxiosError(error)
          ? JSON.stringify(error.response?.data ?? error.message)
          : String(error),
      });
      return false;
    }
  }
}
