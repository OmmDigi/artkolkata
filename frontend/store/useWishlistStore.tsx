import { create } from "zustand";

interface WishlistItem {
  id: string | number;
  [key: string]: any;
}

interface WishlistState {
  wishlist: WishlistItem[];
  toggleWishlist: (item: WishlistItem) => void;
}

const loadWishlistFromLocalStorage = (): WishlistItem[] => {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem("wishlist");
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

export const useWishlistStore = create<WishlistState>((set) => ({
  wishlist: [],

  toggleWishlist: (item) =>
    set((state) => {
      // 🛑 HARD GUARD
      if (!item || !item.id) {
        console.warn("Invalid wishlist item:", item);
        return state;
      }

      const exists = state.wishlist.some((i) => i?.id === item.id);

      const updatedWishlist = exists
        ? state.wishlist.filter((i) => i?.id !== item.id)
        : [...state.wishlist, item];

      localStorage.setItem("wishlist", JSON.stringify(updatedWishlist));

      return { wishlist: updatedWishlist };
    }),
}));

// 🔥 hydrate after mount
if (typeof window !== "undefined") {
  const stored = loadWishlistFromLocalStorage();
  useWishlistStore.setState({ wishlist: stored });
}
