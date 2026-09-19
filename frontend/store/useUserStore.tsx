// The user store lives in @/hooks/useUserStore. This file used to hold a second
// copy of it, which meant the navbar's logout wrote to a different store than
// the axios interceptor and the OTP login did — and, worse, that copy's logout
// never cleared the cart or the wishlist, so the next customer on the browser
// inherited the previous one's. Re-exporting keeps the old import path working
// against the one real store.
export * from "@/hooks/useUserStore";
