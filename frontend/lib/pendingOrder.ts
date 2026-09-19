/**
 * The order a customer was handed to the payment gateway for.
 *
 * A COD order is done the moment place-order answers, so the cart is emptied
 * there and then. An ONLINE one is not: the customer is sent off to the
 * gateway and may never come back, or may come back having failed. Emptying
 * the cart before they pay would leave someone who abandoned the payment page
 * with nothing to retry, so the cart is kept and this marker records what to
 * look for when they return.
 *
 * OrderCompletionWatcher reads it, asks the API what became of that order and
 * clears the cart only once the payment is PAID.
 */
const PENDING_ORDER_KEY = "pendingOrder";

// A marker older than this is from a checkout the customer walked away from.
// Keeping it forever would mean re-checking a dead order on every page load.
const PENDING_ORDER_TTL = 6 * 60 * 60 * 1000;

export interface PendingOrder {
  orderNumber: string;
  isGuestOrder: boolean;
  placedAt: number;
}

export const setPendingOrder = (
  orderNumber: string,
  isGuestOrder: boolean,
) => {
  if (typeof window === "undefined" || !orderNumber) return;
  try {
    localStorage.setItem(
      PENDING_ORDER_KEY,
      JSON.stringify({ orderNumber, isGuestOrder, placedAt: Date.now() }),
    );
  } catch {
    /* storage blocked : the cart simply is not auto-cleared */
  }
};

export const getPendingOrder = (): PendingOrder | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PENDING_ORDER_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as PendingOrder;
    if (!parsed?.orderNumber) return null;

    if (Date.now() - (parsed.placedAt ?? 0) > PENDING_ORDER_TTL) {
      clearPendingOrder();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const clearPendingOrder = () => {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(PENDING_ORDER_KEY);
  } catch {
    /* nothing to clear */
  }
};
