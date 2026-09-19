/**
 * Idempotency keys for POST /orders/place-order.
 *
 * The API refuses the call without one (utils/idempotency.ts): placing an
 * order is not safe to repeat, so the client sends a key that stays the same
 * across its own retries and the server does the work at most once for it.
 *
 * The key is parked in sessionStorage rather than component state because the
 * checkout page is remounted by a failed request, a back navigation, or a
 * bounce off the payment gateway, and all three of those are the same attempt
 * as far as the customer is concerned. It is dropped once the order is placed,
 * so the next checkout starts a new one.
 */
const CHECKOUT_KEY = "checkoutIdempotencyKey";

const randomKey = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Old Safari and any non-secure origin. 32 hex chars is inside the API's
  // 16..128 range and random enough not to collide with another customer.
  return Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join("");
};

/** The key for the checkout attempt in progress, minting one if there is none. */
export const getCheckoutIdempotencyKey = (): string => {
  if (typeof window === "undefined") return randomKey();

  try {
    const existing = sessionStorage.getItem(CHECKOUT_KEY);
    if (existing && existing.length >= 16 && existing.length <= 128) {
      return existing;
    }
    const key = randomKey();
    sessionStorage.setItem(CHECKOUT_KEY, key);
    return key;
  } catch {
    // private mode with storage blocked : a fresh key per call still satisfies
    // the API, it just stops protecting against a double submit
    return randomKey();
  }
};

/**
 * Call once the order exists. Anything after this point is a new order and
 * must not be replayed into the last one's reservation.
 */
export const resetCheckoutIdempotencyKey = () => {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(CHECKOUT_KEY);
  } catch {
    /* nothing to clear */
  }
};
