export const GUEST_ORDER_KEY = "guestOrder";

export const setGuestOrderToken = (token: string) => {
  if (typeof window !== "undefined") {
    localStorage.setItem(GUEST_ORDER_KEY, token);
  }
};

export const getGuestOrderToken = (): string | null => {
  if (typeof window !== "undefined") {
    return localStorage.getItem(GUEST_ORDER_KEY);
  }
  return null;
};

export const clearGuestOrderToken = () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem(GUEST_ORDER_KEY);
  }
};
