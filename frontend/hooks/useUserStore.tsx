import { create } from "zustand";
import { persist } from "zustand/middleware";
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

// hook
export const useIsLoggedIn = () => {
  const user = useUserStore((state) => state.user);
  const token =
    user?.token || typeof window !== "undefined"
      ? window.localStorage.getItem("token")
      : "";
  return !!token;
};
