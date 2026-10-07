import axios from "axios";
import logger from "../utils/logger";

const SMS_BULK_API = "http://sms.ommdigitalsolution.com/api/SmsApi/SendBulkApi";

// The bulk endpoint refuses more than this in one request, so larger lists are
// split into several calls.
const MAX_NUMBERS_PER_REQUEST = 5000;

export interface SendSmsInput {
  /** One number or many. +91, spaces and dashes are stripped. */
  numbers: string | string[];
  message: string;
  /** DLT template the message was registered under. The text must match it. */
  templateId: string;
  flash?: boolean;
  /** Delivery report callback, e.g. https://site/sms/dlr?MsgID=#MESSAGEID#&Phno=#PHNO#&Status=#STATUS# */
  dlrUrl?: string;
}

export interface SendSmsResult {
  /** One entry per request sent — "Message ID : 56" as the gateway words it. */
  messages: string[];
  sent: number;
}

interface SmsGatewayResponse {
  Response?: { Message?: string };
  Status?: string;
}

/**
 * Read at call time rather than import time, so the module can be imported
 * before dotenv has run.
 */
function getCredentials() {
  const userId = process.env.SMS_USER_ID?.trim();
  const password = process.env.SMS_PASSWORD?.trim();
  const senderId = process.env.SMS_SENDER_ID?.trim();
  const entityId = process.env.SMS_ENTITY_ID?.trim();

  if (!userId || !password || !senderId || !entityId)
    throw new Error(
      "SMS needs SMS_USER_ID, SMS_PASSWORD, SMS_SENDER_ID and SMS_ENTITY_ID",
    );

  return { userId, password, senderId, entityId };
}

/**
 * Reduces "+91 98765-43210", "098765 43210" and the like to the bare 10-digit
 * Indian mobile number the gateway wants. null when the input is not one.
 * Also the canonical form phone numbers are stored and looked up in.
 */
export function normalizeIndianPhone(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");

  const number =
    digits.length === 12 && digits.startsWith("91")
      ? digits.slice(2)
      : digits.length === 11 && digits.startsWith("0")
        ? digits.slice(1)
        : digits;

  return /^[6-9]\d{9}$/.test(number) ? number : null;
}

/**
 * The gateway wants bare 10-digit Indian numbers. Anything that is not one
 * after stripping +91 / 0 is rejected here, since the gateway would bill for it
 * and then fail it.
 */
function normalizeNumbers(numbers: string | string[]): string[] {
  const list = Array.isArray(numbers) ? numbers : numbers.split(",");
  const valid = new Set<string>();
  const invalid: string[] = [];

  for (const raw of list) {
    if (!raw.replace(/\D/g, "")) continue;

    const number = normalizeIndianPhone(raw);
    if (number) valid.add(number);
    else invalid.push(raw);
  }

  if (invalid.length)
    throw new Error(`Invalid phone number(s): ${invalid.join(", ")}`);

  return [...valid];
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    chunks.push(items.slice(i, i + size));
  return chunks;
}

/**
 * Sends one message to any number of recipients through the Omm Digital bulk
 * SMS API. Throws on bad input, missing credentials, or any refusal from the
 * gateway, so callers decide whether a failed SMS should stop their flow.
 */
export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  const { userId, password, senderId, entityId } = getCredentials();

  if (!input.message?.trim()) throw new Error("SMS message is empty");
  if (!input.templateId?.trim()) throw new Error("SMS templateId is required");

  const numbers = normalizeNumbers(input.numbers);
  if (!numbers.length) throw new Error("No phone numbers to send SMS to");

  const messages: string[] = [];

  for (const batch of chunk(numbers, MAX_NUMBERS_PER_REQUEST)) {
    // URLSearchParams does the URL-encoding the gateway asks for on Password,
    // Msg and DlrUrl — encoding them by hand first would double-encode.
    const body = new URLSearchParams({
      UserID: userId,
      Password: password,
      SenderID: senderId,
      Phno: batch.join(","),
      Msg: input.message,
      EntityID: entityId,
      TemplateID: input.templateId,
      ...(input.flash ? { FlashMsg: "1" } : {}),
      ...(input.dlrUrl ? { DlrUrl: input.dlrUrl } : {}),
    });

    let data: SmsGatewayResponse;

    try {
      ({ data } = await axios.post<SmsGatewayResponse>(SMS_BULK_API, body, {
        headers: { "content-type": "application/x-www-form-urlencoded" },
        timeout: 15000,
      }));
    } catch (error) {
      const detail = axios.isAxiosError(error)
        ? JSON.stringify(error.response?.data ?? error.message)
        : error instanceof Error
          ? error.message
          : String(error);

      logger.error({
        message: "Error sending SMS",
        templateId: input.templateId,
        recipients: batch.length,
        detail,
      });

      throw new Error(`SMS request failed: ${detail}`);
    }

    // The gateway answers 200 even when it refuses — "Invalid UserID And
    // Password!" arrives with Status "WARNING" — so the body is the real result.
    const gatewayMessage = data?.Response?.Message ?? "";

    if (data?.Status !== "OK") {
      logger.error({
        message: "SMS gateway refused the request",
        templateId: input.templateId,
        recipients: batch.length,
        status: data?.Status,
        detail: gatewayMessage,
      });

      throw new Error(`SMS gateway refused: ${gatewayMessage || "unknown error"}`);
    }

    messages.push(gatewayMessage);
  }

  return { messages, sent: numbers.length };
}

/** DLT template registered for the account-verification OTP. */
const OTP_TEMPLATE_ID = "1777179128081426250";

/**
 * Sends the account OTP by SMS. The wording is the registered DLT template
 * word for word with only its two {#num#} slots filled — the gateway drops
 * anything that does not match it exactly, so do not edit the text here.
 */
export async function sendOtpSms(
  phone: string,
  otp: string | number,
  expiryMinutes: number,
): Promise<SendSmsResult> {
  return sendSms({
    numbers: phone,
    templateId: OTP_TEMPLATE_ID,
    message: `Your OTP for mobile number verification is ${otp}. This OTP is valid for ${expiryMinutes} minutes. Please do not share this OTP with anyone. - Thank you, ART Kolkata.`,
  });
}
