import { useSyncExternalStore } from "react";

// nothing ever changes after the first client render, so there is nothing to
// subscribe to
const noopSubscribe = () => () => {};

/**
 * False while rendering on the server and during hydration, true afterwards.
 *
 * For UI whose correct form depends on something only the browser knows —
 * localStorage, in practice — and which would be wrong, rather than merely
 * incomplete, if the server guessed. Checkout uses it so the "you are checking
 * out as a guest" banner is not baked into the HTML of a page a logged-in
 * customer requested.
 */
export const useIsHydrated = () =>
  useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
