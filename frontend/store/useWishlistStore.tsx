import { create } from "zustand";
import { getRequest, postRequest, deleteRequest } from "@/lib/fetcher";

interface WishlistState {
  ids: number[]; // for the heart icons
  wishlist: any[]; // full products, for the wishlist page
  loading: boolean;
  fetchIds: () => Promise<void>;
  fetchWishlist: () => Promise<void>;
  toggleWishlist: (product: any) => Promise<void>;
  clear: () => void;
}

const timeouts: Record<number, NodeJS.Timeout> = {};

export const useWishlistStore = create<WishlistState>((set, get) => ({
  ids: [],
  wishlist: [],
  loading: false,

  // call once after login / on app mount
  fetchIds: async () => {
    try {
      const res: any = await getRequest("/api/v1/wishlist/ids");
      set({ ids: res.data ?? [] });
    } catch {
      set({ ids: [] }); // logged out — nothing to show
    }
  },

  // call on the wishlist page
  fetchWishlist: async () => {
    set({ loading: true });
    try {
      const res: any = await getRequest(
        "/api/v1/wishlist?limit=-1&variants=true",
      );
      set({
        wishlist: res.data ?? [],
        ids: (res.data ?? []).map((p: any) => p.id),
      });
    } catch {
      set({ wishlist: [] });
    } finally {
      set({ loading: false });
    }
  },

  toggleWishlist: async (product) => {
    if (!product?.id) return;

    const productId = Number(product.id);
    const exists = get().ids.includes(productId);

    // optimistic update so the heart flips instantly
    set((state) => ({
      ids: exists
        ? state.ids.filter((id) => id !== productId)
        : [...state.ids, productId],
      wishlist: exists
        ? state.wishlist.filter((p) => Number(p.id) !== productId)
        : state.wishlist,
    }));

    // debounce logic per product id
    if (timeouts[productId]) {
      clearTimeout(timeouts[productId]);
    }

    timeouts[productId] = setTimeout(async () => {
      // get the latest state after debounce settles
      const isNowInWishlist = get().ids.includes(productId);

      try {
        if (!isNowInWishlist) {
          await deleteRequest({ url: `/api/v1/wishlist/${productId}` });
        } else {
          await postRequest({
            url: "/api/v1/wishlist",
            body: { product_id: productId },
          });
        }
      } catch (err) {
        // request failed — put the icon back where it was prior to this exact call
        // (but ideally, we should revert to the actual server state.
        // For simplicity, we flip it back)
        set((state) => ({
          ids: isNowInWishlist
            ? state.ids.filter((id) => id !== productId)
            : [...state.ids, productId],
        }));
      }

      delete timeouts[productId];
    }, 500);
  },

  // call this from the logout handler
  clear: () => set({ ids: [], wishlist: [] }),
}));
