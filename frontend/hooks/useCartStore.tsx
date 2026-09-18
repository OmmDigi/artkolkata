// The cart store lives in @/store/useCartStore. This file used to hold a second
// copy of it, which meant a component importing from here wrote to a different
// store than the navbar read from, so items added from the account page never
// showed up in the sidebar. Re-exporting keeps the old import path working
// against the one real store.
export * from "@/store/useCartStore";
