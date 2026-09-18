import { Request } from "express";
import { ErrorHandler } from "../utils/ErrorHandler";
import { createToken, verifyToken } from "./jwt";

/**
 * The capability a guest gets back when they place an order.
 *
 * A guest has no account and therefore no session, but they still have to be
 * able to open the confirmation page, download the invoice and cancel while
 * the order is still PENDING. This token is what stands in for the session:
 * it names exactly one order and grants nothing else.
 *
 * It is deliberately not an ITokenInfo. A guest token must never satisfy
 * isAuthenticated — the shadow users row it belongs to has no password and has
 * never been verified, so a token that could log into it would turn "typed an
 * email at checkout" into "owns that account". The `scope` field below is what
 * keeps the two apart: every guest route asserts it, and nothing that reads an
 * ITokenInfo ever sees this payload shape.
 */
export interface IGuestOrderToken {
  scope: "guest_order";
  order_id: number;
  order_number: string;
  /**
   * The address the order was placed with, kept so the confirmation page can
   * say where the receipt went without a second query, and so a token can be
   * recognised as stale if the order is ever moved to another account.
   */
  email: string;
  user_id: number;
}

/**
 * Long enough that the link in the confirmation email still opens once the
 * parcel has actually been delivered, short enough that a forwarded link stops
 * working eventually. A guest who wants permanent access sets a password and
 * gets a real account instead.
 */
const GUEST_TOKEN_TTL = "30d";

export const GUEST_TOKEN_QUERY_KEY = "guest_token";
export const GUEST_TOKEN_HEADER = "x-guest-order-token";

export const createGuestOrderToken = (
  payload: Omit<IGuestOrderToken, "scope">,
) =>
  createToken(
    { ...payload, scope: "guest_order" } satisfies IGuestOrderToken,
    { expiresIn: GUEST_TOKEN_TTL },
  );

/**
 * Pull the token off a request. Accepted in a header or the query string,
 * because both call sites are real: the storefront fetches the order with a
 * header, and the invoice link in the confirmation email is a plain URL the
 * browser follows with no javascript involved.
 */
export const readGuestOrderToken = (req: Request): string | null => {
  const header = req.headers[GUEST_TOKEN_HEADER];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  if (fromHeader && fromHeader.trim()) return fromHeader.trim();

  const fromQuery = req.query?.[GUEST_TOKEN_QUERY_KEY];
  if (typeof fromQuery === "string" && fromQuery.trim()) return fromQuery.trim();

  return null;
};

/**
 * Verify a token and return what it grants. Throws 401 rather than returning
 * null: every caller treats a bad token as a refusal, and returning null makes
 * it possible to forget to check.
 */
export const verifyGuestOrderToken = async (
  token: string,
): Promise<IGuestOrderToken> => {
  const { data, error } = await verifyToken<IGuestOrderToken>(token);

  if (error || !data || data.scope !== "guest_order") {
    throw new ErrorHandler(401, "This order link is invalid or has expired");
  }

  return data;
};

/** readGuestOrderToken + verifyGuestOrderToken, for the routes that require one. */
export const requireGuestOrderToken = async (
  req: Request,
): Promise<IGuestOrderToken> => {
  const token = readGuestOrderToken(req);
  if (!token) throw new ErrorHandler(401, "This order link is invalid or has expired");
  return verifyGuestOrderToken(token);
};
