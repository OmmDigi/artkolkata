import { PoolClient } from "pg";
import { pool } from "..";
import { ErrorHandler } from "../utils/ErrorHandler";
import { sendEmail } from "../utils/sendEmail";
import logger from "../utils/logger";
import { normalizeIndianPhone, sendOtpSms } from "./sms";

export const OTP_EXPIRY_MINUTES = 5;

/**
 * What a customer signs in with: an email address or a mobile number, typed
 * into the same box. value is already normalised — trimmed email or the bare
 * 10-digit number — and is also the key the otp is stored under.
 */
export type LoginIdentifier =
  | { kind: "email"; value: string }
  | { kind: "phone"; value: string };

export const parseIdentifier = (raw: string): LoginIdentifier => {
  const input = raw.trim();

  if (input.includes("@")) return { kind: "email", value: input };

  const phone = normalizeIndianPhone(input);
  if (phone) return { kind: "phone", value: phone };

  throw new ErrorHandler(400, "Enter a valid email address or 10-digit mobile number");
};

/**
 * Matches the stored phone_no in the same canonical form normalizeIndianPhone
 * produces, so rows saved before numbers were normalised ("+91 98765 43210")
 * still match. Must stay identical to the expression in the
 * uq_users_registered_phone index, or lookups stop using it.
 */
const PHONE_KEY_SQL = `right(regexp_replace(users.phone_no, '\\D', '', 'g'), 10)`;

/**
 * WHERE fragment that finds the account an identifier belongs to.
 *
 * Phone lookups skip guest rows: guest checkout leaves one shadow row per
 * email, and several of them can carry the same number. Only registered
 * accounts are unique on phone, so only they can be found by it.
 */
export const identifierWhereSql = (id: LoginIdentifier, param: number) =>
  id.kind === "email"
    ? `users.email = $${param}`
    : `${PHONE_KEY_SQL} = $${param}
       AND COALESCE(users.is_guest, false) = false
       AND users.phone_no <> ''`;

/** Postgres error from uq_users_registered_phone — the number is taken. */
export const isPhoneTakenError = (error: unknown) =>
  (error as { code?: string; constraint?: string })?.code === "23505" &&
  (error as { constraint?: string }).constraint === "uq_users_registered_phone";

export const insertOtpToDatabase = async (
  /**
   * The email address or 10-digit phone the otp was sent to. The column is
   * still called email from when that was the only channel; the two forms can
   * never collide, so one table serves both.
   */
  target: string,
  otp: string,
  client?: PoolClient
) => {
  const pgClient = client ? client : pool;
  //store otp to the db with expire date 5 minit
  await pgClient.query(
    `INSERT INTO otps
         (email, otp)
        VALUES ($1, $2)
        ON CONFLICT (email)
        DO UPDATE
         SET otp = EXCLUDED.otp,
         created_at = CURRENT_TIMESTAMP`,
    [target, otp]
  );
};

/**
 * Sends an otp to an email address or phone. Email stays fire-and-forget as it
 * always was; SMS is awaited, because when it fails the customer is left with
 * no code and nothing on screen telling them so.
 */
export const deliverOtp = async (
  target: LoginIdentifier,
  otp: string | number,
  userName: string,
) => {
  if (target.kind === "email") {
    sendEmail(target.value, "SIGNUP_OTP", {
      userName,
      otpCode: otp,
      expiryMinutes: String(OTP_EXPIRY_MINUTES),
    });
    return;
  }

  try {
    await sendOtpSms(target.value, otp, OTP_EXPIRY_MINUTES);
  } catch (error) {
    logger.error({
      message: "Failed to send OTP SMS",
      detail: error instanceof Error ? error.message : String(error),
    });
    throw new ErrorHandler(
      502,
      "We could not send the OTP to your mobile number. Please try again in a moment.",
    );
  }
};

/**
 * Where an account's verification code goes: its phone when it has a usable
 * one, otherwise its email — accounts made before phone signup may have a
 * number the gateway would refuse.
 */
export const verificationTarget = (user: {
  phone_no?: string | null;
  email?: string | null;
}): LoginIdentifier | null => {
  const phone = normalizeIndianPhone(user.phone_no);
  if (phone) return { kind: "phone", value: phone };
  if (user.email) return { kind: "email", value: user.email };
  return null;
};
