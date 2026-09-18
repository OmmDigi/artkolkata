import ejs from "ejs";
import { generateEmailTemplate } from "./generateEmailTemplate";
import logger from "./logger";
import {
  EmailAttachment,
  SendEmailResult,
  emailSender,
  getEmailProvider,
} from "../services/email";

export type EmailType =
  | "SIGNUP_OTP"
  | "WELCOME_EMAIL"
  | "ORDER_RECEIVED_EMAIL"
  | "ORDER_SHIPPED_EMAIL"
  | "ORDER_OUT_FOR_DELIVERY_EMAIL"
  | "ORDER_DELIVERED_EMAIL"
  | "SEND_INVOICE"
  | "SEND_GUEST_EMAIL_PASSWORD"
  | "ORDER_CONFIRMED_EMAIL"
  | "INQUIRY-FORM"
  | "NEW_ORDER_STAFF_ALERT";

interface EmailDefinition {
  /** File under templates/, rendered by ejs. */
  template: string;
  /**
   * The display name beside the from address. The address itself is the same
   * for every email and comes from emailSender(); only this wording changes.
   */
  fromName: (templateData: ejs.Data) => string;
  subject: (templateData: ejs.Data) => string;
}

/**
 * One row per kind of email the shop sends. Subject and from-name are functions
 * because a couple of them read the order out of the template data.
 */
const EMAILS: Record<EmailType, EmailDefinition> = {
  SIGNUP_OTP: {
    template: "signup-otp.html",
    fromName: () => "Email Verification OTP",
    subject: () => "Verify your email using the below OTP.",
  },
  WELCOME_EMAIL: {
    template: "welcome.html",
    fromName: () => `Welcome to ${process.env.COMPANY_NAME}`,
    subject: () => `Welcome to ${process.env.COMPANY_NAME}!`,
  },
  ORDER_RECEIVED_EMAIL: {
    template: "order-received.html",
    fromName: () => `Order Received ${process.env.COMPANY_NAME}`,
    subject: (templateData) =>
      `We have your order${templateData?.orderId ? ` - ${templateData.orderId}` : ""}`,
  },
  ORDER_SHIPPED_EMAIL: {
    template: "order-shipped.html",
    fromName: () => `Your Order Has Shipped`,
    subject: (templateData) =>
      `Your order is on its way${templateData?.orderId ? ` - ${templateData.orderId}` : ""}`,
  },
  ORDER_OUT_FOR_DELIVERY_EMAIL: {
    template: "out-for-delivery.html",
    fromName: () => `Out For Delivery`,
    subject: (templateData) =>
      `Arriving today${templateData?.orderId ? ` - ${templateData.orderId}` : ""}`,
  },
  ORDER_DELIVERED_EMAIL: {
    template: "order-delivered.html",
    fromName: () => `Order Delivered`,
    subject: (templateData) =>
      `Your order has been delivered${templateData?.orderId ? ` - ${templateData.orderId}` : ""}`,
  },
  SEND_INVOICE: {
    template: "invoice.html",
    fromName: () => `Invoice From ${process.env.COMPANY_NAME}`,
    subject: () => "Check Your Invoice Bellow",
  },
  SEND_GUEST_EMAIL_PASSWORD: {
    template: "guest-email-details.html",
    fromName: () => `Guest Account Details ${process.env.COMPANY_NAME}`,
    subject: () => "Your guest account details bellow",
  },
  ORDER_CONFIRMED_EMAIL: {
    template: "order-confirmed.html",
    fromName: () => "Your Order Is Confirmed",
    subject: () => "Yeaa! Your oreder is successfully confirmed",
  },
  "INQUIRY-FORM": {
    template: "inquiry-form.html",
    fromName: () => `Inquiry From ${process.env.COMPANY_NAME} Website`,
    subject: () => `Inquiry From ${process.env.COMPANY_NAME} Website`,
  },
  NEW_ORDER_STAFF_ALERT: {
    template: "new-order-staff.html",
    fromName: () => `New Order ${process.env.COMPANY_NAME}`,
    subject: (templateData) =>
      `New order received${templateData?.orderId ? ` - ${templateData.orderId}` : ""}`,
  },
};

/**
 * Renders one of the shop's emails and hands it to whichever provider
 * EMAIL_PROVIDER selected — SMTP, the Brevo API, or nothing at all. Nothing
 * here knows which one it is.
 *
 * Never throws: most call sites fire and forget, so a failure comes back as
 * { ok: false } and is already in the log by then.
 *
 * `attachments` is for the emails that carry a file — the invoice PDF. Whether
 * that becomes a nodemailer attachment or a base64 blob in a Brevo request body
 * is the provider's problem, not this function's.
 */
export const sendEmail = async (
  to: string[] | string,
  type: EmailType,
  templateData?: ejs.Data,
  attachments?: EmailAttachment[],
): Promise<SendEmailResult> => {
  const definition = EMAILS[type];
  const data = templateData ?? {};

  const html = await generateEmailTemplate(data, definition.template);

  // A template that would not render is not a mail worth sending. The render
  // error is already in the log; sending anyway would put whatever ejs managed
  // to produce — historically the word "Error" — in front of a customer.
  if (!html) {
    logger.error({
      message: "Email not sent — template failed to render",
      type,
      template: definition.template,
    });

    return { ok: false, error: "Template render failed" };
  }

  return getEmailProvider().send({
    to: Array.isArray(to) ? to : [to],
    from: emailSender(definition.fromName(data)),
    subject: definition.subject(data),
    html,
    attachments,
  });
};
