import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useSyncExternalStore } from "react";
import { useWishlistStore } from "@/store/useWishlistStore";
import { useCartStore } from "@/store/useCartStore";

export interface User {
  id?: string;
  name?: string;
  email?: string;
  token?: string;
  role?: string;
}

interface UserState {
  user: User | null;
  setUser: (user: User) => void;
  logout: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => {
        if (user.token) localStorage.setItem("token", user.token);
        set({ user });
      },
      logout: () => {
        localStorage.removeItem("token");
        set({ user: null });
        useWishlistStore.getState().clear();
        // the account cart stays on the server, only this browser is cleared
        useCartStore.getState().resetLocalCart();
      },
    }),
    {
      name: "user-store", // name of the item in the storage (must be unique)
    }
  )
);

/**
 * Whether there is a usable session.
 *
 * The token lives in localStorage, which the server does not have. Reading it
 * while rendering therefore made the server and the first client render
 * disagree, and React threw a hydration mismatch. useSyncExternalStore is the
 * supported way to read something React does not own: it renders the server
 * snapshot (false) during hydration and corrects to the real value in the same
 * pass, before the browser paints.
 *
 * Subscribing to the user store picks up a login or a logout without a reload;
 * the `storage` event picks up the same happening in another tab.
 *
 * (The previous version read `user?.token || typeof window !== "undefined" ? … : ""`,
 * which JavaScript groups as `(user?.token || isBrowser) ? … : ""` — the token
 * never took part in the decision.)
 */
const subscribeToSession = (onChange: () => void) => {
  const unsubscribe = useUserStore.subscribe(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    unsubscribe();
    window.removeEventListener("storage", onChange);
  };
};

const hasToken = () => !!localStorage.getItem("token");

export const useIsLoggedIn = () =>
  useSyncExternalStore(
    subscribeToSession,
    hasToken,
    // the server has no token and must say so, or hydration disagrees
    () => false,
  );
