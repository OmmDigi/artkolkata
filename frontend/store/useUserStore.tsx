import { create } from "zustand";

interface User {
  id?: string;
  name?: string;
  email?: string;
  token?: string;
}

interface UserState {
  user: User | null;
  setUser: (user: User) => void;
  logout: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  setUser: (user) => {
    if (user.token) localStorage.setItem("token", user.token);
    set({ user });
  },
  logout: () => {
    localStorage.removeItem("token");
    set({ user: null });
  },
}));

// hook
export const useIsLoggedIn = () => {
  const user = useUserStore((state) => state.user);
  const token =
    user?.token || typeof window != "undefined"
      ? window.localStorage.getItem("token")
      : "";
  return !!token;
};
