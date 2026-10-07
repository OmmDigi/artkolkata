import { pool } from "..";
import { IShippingAddress } from "../types";
import { ErrorHandler } from "./ErrorHandler";
import { normalizeIndianPhone } from "../services/sms";
import { PHONE_KEY_SQL } from "../services/users.service";
import { doTransition } from "./doTransition";

export interface IResolvedGuest {
  id: number;
  /** null for a guest who gave only a phone number */
  email: string | null;
  /** false when an existing guest row was reused rather than created here */
  created: boolean;
}

/**
 * Find or create the shadow users row a guest order hangs off.
 *
 * Runs on the pool, NOT on the order's transaction client, and so commits
 * immediately. It has to: the idempotency reservation is keyed by user_id and
 * itself commits before the order transaction opens, so the row must already
 * exist and be visible to other connections by then.
 *
 * The cost of that is an orphan users row when the order transaction later
 * rolls back — a guest with no orders. It is the same shape of leftover an
 * abandoned signup leaves behind, it is invisible to the customer, and the next
 * order from that email reuses it instead of adding another.
 *
 * A guest row is not an account:
 *
 *   password    NULL   — decrypt() is never reached, so login always fails
 *   is_verified false  — nobody has proved they own the address
 *   is_guest    true   — what the CMS filters on, and what signup clears
 *
 * Throws 409 when the email already belongs to a real account. That is the
 * whole reason this is a lookup and not a blind insert: without it an
 * unauthenticated stranger could type a customer's address at checkout and
 * attach an order to their history.
 */
export const resolveGuestUser = async (
  shipping: IShippingAddress,
): Promise<IResolvedGuest> => {
  // Stored lowercase so a guest typing Bob@x.com and then bob@x.com is one
  // person, and — more importantly — so neither spelling slips past the
  // existing-account check below.
  const email = shipping.email?.trim().toLowerCase() ?? "";
  const name = shipping.fullName.trim().slice(0, 255);
  const phone = (shipping.phone ?? "").trim().slice(0, 20);

  if (!email) return resolvePhoneOnlyGuest(name, phone);

  const existing = await findByEmail(email);

  if (existing) {
    assertClaimable(existing);

    // Keep the name and phone in step with the latest order, so the CMS shows
    // the details the customer actually gave rather than whatever they typed
    // the first time.
    await pool.query(
      `UPDATE users SET name = $2, phone_no = $3 WHERE id = $1`,
      [existing.id, name, phone],
    );

    return { id: existing.id, email, created: false };
  }

  const inserted = await pool.query<{ id: number }>(
    `INSERT INTO users (name, email, phone_no, password, is_verified, is_guest, role)
     VALUES ($1, $2, $3, NULL, false, true, 'User')
     ON CONFLICT (email) DO NOTHING
     RETURNING id`,
    [name, email, phone],
  );

  if (inserted.rowCount === 1) {
    return { id: inserted.rows[0].id, email, created: true };
  }

  // Lost the race against a concurrent checkout with the same email — two tabs,
  // or a double submit that beat the idempotency key to it. Re-read and apply
  // the same rule, so the second request is refused for exactly the reason the
  // first would have been.
  const raced = await findByEmail(email);

  if (!raced) {
    throw new ErrorHandler(
      409,
      "Could not start this order, please try again",
    );
  }

  assertClaimable(raced);

  return { id: raced.id, email, created: false };
};

type GuestCandidate = {
  id: number;
  is_guest: boolean | null;
  has_password: boolean;
  is_active: boolean | null;
};

const findByEmail = async (email: string): Promise<GuestCandidate | null> => {
  const { rows } = await pool.query<GuestCandidate>(
    `SELECT id,
            is_guest,
            password IS NOT NULL AS has_password,
            is_active
       FROM users
      WHERE LOWER(email) = $1`,
    [email],
  );

  return rows[0] ?? null;
};

/**
 * Whether this row may be used for a guest order.
 *
 * has_password is checked as well as is_guest because the flag is the newer of
 * the two: a row that predates guest checkout has is_guest NULL, and treating
 * NULL as "guest" would hand every existing customer's account to anyone who
 * knows their email address.
 */
function assertClaimable(user: GuestCandidate) {
  if (user.is_guest !== true || user.has_password) {
    throw new ErrorHandler(
      409,
      "An account already exists for this email. Please log in to place this order.",
      // The storefront switches the checkout to the login step on this key
      // rather than string-matching the message.
      ["ACCOUNT_EXISTS"],
    );
  }

  // A guest row can be disabled from the CMS the same way an account can, and
  // it has to mean the same thing here as it does at login.
  if (user.is_active === false) {
    throw new ErrorHandler(
      400,
      "This email address is not able to place orders",
      ["ACCOUNT_DISABLED"],
    );
  }
}

/**
 * A guest who left the email blank. The row is keyed on the phone instead:
 * the newest email-less guest row with this number is reused, otherwise a new
 * one is made with email NULL (which UNIQUE(email) lets any number of rows
 * share).
 *
 * There is no ACCOUNT_EXISTS check here, and none is needed. The email check
 * exists because a guest row and an account cannot share an email, so the
 * order would land in the account. Guest rows are left out of the unique phone
 * index, so this order always gets a row of its own — and OTP login on that
 * number later claims it, orders included.
 */
const resolvePhoneOnlyGuest = async (
  name: string,
  rawPhone: string,
): Promise<IResolvedGuest> => {
  const phone = normalizeIndianPhone(rawPhone);
  if (!phone)
    throw new ErrorHandler(
      400,
      "Enter a valid 10-digit phone number or an email address",
    );

  let resolved: IResolvedGuest | null = null;

  // Committed on its own, like the email path, for the same reason. The lock
  // makes a double submit wait for the first to make its row and then reuse
  // it, so both land on one user id and the idempotency key catches the second.
  await doTransition(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `guest-phone:${phone}`,
    ]);

    const { rows } = await client.query<{ id: number; is_active: boolean | null }>(
      `SELECT id, is_active
         FROM users
        WHERE ${PHONE_KEY_SQL} = $1
          AND users.is_guest = true
          AND users.password IS NULL
          AND users.email IS NULL
        ORDER BY id DESC
        LIMIT 1`,
      [phone],
    );

    if (rows[0]) {
      if (rows[0].is_active === false)
        throw new ErrorHandler(
          400,
          "This phone number is not able to place orders",
          ["ACCOUNT_DISABLED"],
        );

      await client.query(
        `UPDATE users SET name = $2, phone_no = $3 WHERE id = $1`,
        [rows[0].id, name, phone],
      );
      resolved = { id: rows[0].id, email: null, created: false };
      return;
    }

    const inserted = await client.query<{ id: number }>(
      `INSERT INTO users (name, email, phone_no, password, is_verified, is_guest, role)
       VALUES ($1, NULL, $2, NULL, false, true, 'User')
       RETURNING id`,
      [name, phone],
    );
    resolved = { id: inserted.rows[0].id, email: null, created: true };
  });

  return resolved!;
};
