import SMTPTransport from "nodemailer/lib/smtp-transport";
import { generateEmailTemplate } from "./generateEmailTemplate";
import logger from "./logger";
import { email } from "..";

export type EmailType =
  | "SIGNUP_OTP"
  | "SEND_INVOICE"
  | "SEND_GUEST_EMAIL_PASSWORD"
  | "ORDER_CONFIRMED_EMAIL"
  | "INQUIRY-FORM";

export const sendEmail = async (
  to: string[] | string,
  type: EmailType,
  templateData?: ejs.Data,
) => {
  const sendForm = process.env.SMTP_USER;

  let mailOptions = {};

  if (type === "SIGNUP_OTP") {
    const html = await generateEmailTemplate(
      templateData ?? {},
      "signup-otp.html",
    );
    mailOptions = {
      from: `"Email Verification OTP" <${sendForm}>`, // Sender address
      to, // List of recipients
      subject: "Verify your email using the below OTP.", // Subject line
      html,
    };
  }

  if (type === "SEND_INVOICE") {
    const html = await generateEmailTemplate(
      templateData ?? {},
      "invoice.html",
    );
    mailOptions = {
      from: `"Invoice From Trinket and Casa" <${sendForm}>`, // Sender address
      to, // List of recipients
      subject: "Check Your Invoice Bellow", // Subject line
      html,
    };
  }

  if (type === "SEND_GUEST_EMAIL_PASSWORD") {
    const html = await generateEmailTemplate(
      templateData ?? {},
      "guest-email-details.html",
    );
    mailOptions = {
      from: `"Guest Account Details Trinket and Casa" <${sendForm}>`, // Sender address
      to, // List of recipients
      subject: "Your guest account details bellow", // Subject line
      html,
    };
  }

  if (type === "ORDER_CONFIRMED_EMAIL") {
    const html = await generateEmailTemplate(
      templateData ?? {},
      "order-confirmed.html",
    );
    mailOptions = {
      from: `"Your Order Is Confirmed" <${sendForm}>`, // Sender address
      to, // List of recipients
      subject: "Yeaa! Your oreder is successfully confirmed", // Subject line
      html,
    };
  }

  if (type === "INQUIRY-FORM") {
    const html = await generateEmailTemplate(
      templateData ?? {},
      "inquiry-form.html",
    );

    mailOptions = {
      from: `"Inquiry From Groceberry Website" <${sendForm}>`, // Sender address
      to, // List of recipients
      subject: "Inquiry From Groceberry Website", // Subject line
      html,
    };
  }

  return new Promise(
    (resolve: (value: SMTPTransport.SentMessageInfo) => void, reject) => {
      email.sendMail(mailOptions, (error, info) => {
        if (error) {
          const logPayload = {
            message: "Error sending email",
            stack: error,
          };
          logger.error(logPayload);
          resolve("Error" as any);
        }
        resolve(info);
      });
    },
  );
};
