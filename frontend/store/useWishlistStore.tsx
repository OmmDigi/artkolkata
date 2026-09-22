import { create } from "zustand";
import { getRequest, postRequest, deleteRequest } from "@/lib/fetcher";

interface WishlistState {
  ids: number[]; // for the heart icons
  wishlist: any[]; // full products, for the wishlist page
  // the wishlist has been read back at least once this session
  hydrated: boolean;
  loading: boolean;

  isInWishlist: (id: number) => boolean;
  toggleWishlist: (product: any) => void;

  // read the stored wishlist and make it the local one (call on app mount)
  hydrateWishlist: () => Promise<void>;
  // the wishlist page asks for a fresh read
  fetchWishlist: () => Promise<void>;
  fetchIds: () => Promise<void>;
  // hand the guest wishlist over at login, the two lists are unioned server side
  mergeGuestWishlist: () => Promise<void>;
  // logout : drop what is on screen without touching the stored account wishlist
  clear: () => void;
}

/**
 * A guest saves straight into localStorage. Once there is a token the same
 * toggles also go to /api/v1/wishlist, which is what makes the wishlist follow
 * the customer to another device and what the CMS reads. This mirrors the cart
 * store — the two behave the same way on purpose.
 */
const isLoggedIn = () =>
  typeof window !== "undefined" && !!localStorage.getItem("token");

const readLocalWishlist = (): any[] => {
  if (typeof window === "undefined") return [];
  try {
    const saved = JSON.parse(localStorage.getItem("wishlist") || "[]");
    return Array.isArray(saved) ? saved.filter((p) => p?.id) : [];
  } catch {
    return [];
  }
};

const writeLocalWishlist = (wishlist: any[]) => {
  if (typeof window === "undefined") return;
  localStorage.setItem("wishlist", JSON.stringify(wishlist));
};

const toIds = (wishlist: any[]) => wishlist.map((p) => Number(p.id));

// One pending write per product. A heart tapped twice is back where it
// started, and only the last state is worth sending.
const TOGGLE_SYNC_DELAY = 500;
const timers: Record<number, ReturnType<typeof setTimeout>> = {};

const cancelPendingSync = (productId: number) => {
  if (!timers[productId]) return;
  clearTimeout(timers[productId]);
  delete timers[productId];
};

const cancelAllPendingSync = () => {
  Object.keys(timers).forEach((id) => cancelPendingSync(Number(id)));
};

export const useWishlistStore = create<WishlistState>((set, get) => {
  /**
   * The browser copy is pulled in on first use rather than when the module is
   * evaluated: the server renders this file too, where there is no
   * localStorage, so seeding the state from it would make the server send an
   * empty wishlist and the browser immediately render a full one — a hydration
   * mismatch React resolves by throwing the first render away.
   */
  const ensureLocalWishlist = () => {
    if (get().hydrated || typeof window === "undefined") return;
    const wishlist = readLocalWishlist();
    set({ wishlist, ids: toIds(wishlist), hydrated: true });
  };

  // the server's reply is the whole wishlist, so it replaces what is on screen
  const applyServerWishlist = (res: any) => {
    const wishlist = res?.data ?? [];
    writeLocalWishlist(wishlist);
    set({ wishlist, ids: toIds(wishlist), hydrated: true });
  };

  // a failed write would leave the screen ahead of the account, so the list is
  // pulled back from the server instead of guessing what got through
  const resync = async () => {
    try {
      applyServerWishlist(
        await getRequest("/api/v1/wishlist?limit=-1&variants=true"),
      );
    } catch {
      /* offline or logged out : the local wishlist stays as it is */
    }
  };

  /**
   * Sends the product's final state once the tapping stops. Whether it is in
   * the list is read when the timer fires, not when it was scheduled, so a
   * heart tapped on and off again sends nothing at all.
   */
  const scheduleSync = (productId: number) => {
    if (!isLoggedIn()) return;

    cancelPendingSync(productId);

    timers[productId] = setTimeout(() => {
      delete timers[productId];

      const request = get().ids.includes(productId)
        ? postRequest({
            url: "/api/v1/wishlist",
            body: { product_id: productId },
          })
        : deleteRequest({ url: `/api/v1/wishlist/${productId}` });

      request.catch(resync);
    }, TOGGLE_SYNC_DELAY);
  };

  return {
    // starts empty on both sides of the render, filled by hydrateWishlist()
    ids: [],
    wishlist: [],
    hydrated: false,
    loading: false,

    isInWishlist: (id) => get().ids.includes(Number(id)),

    toggleWishlist: (product) => {
      if (!product?.id) return;

      ensureLocalWishlist();

      const productId = Number(product.id);

      set((state) => {
        const exists = state.ids.includes(productId);

        const wishlist = exists
          ? state.wishlist.filter((p) => Number(p.id) !== productId)
          : [{ ...product, id: productId }, ...state.wishlist];

        writeLocalWishlist(wishlist);
        return { wishlist, ids: toIds(wishlist) };
      });

      // the heart has already flipped, the account catches up once the tapping
      // stops rather than on every press
      scheduleSync(productId);
    },

    hydrateWishlist: async () => {
      cancelAllPendingSync();

      // A guest's wishlist only ever exists in this browser, so hydrating is
      // reading it back. Nothing is requested: the wishlist endpoints all need
      // a session and a 401 here is noise, not information.
      if (!isLoggedIn()) {
        const wishlist = readLocalWishlist();
        set({ wishlist, ids: toIds(wishlist), hydrated: true });
        return;
      }

      try {
        const res: any = await getRequest(
          "/api/v1/wishlist?limit=-1&variants=true",
        );

        // An account with nothing stored but products saved in this browser is
        // a wishlist filled before signing in, so it is handed over rather
        // than wiped. The other way round the server wins.
        if ((res?.data?.length ?? 0) === 0 && readLocalWishlist().length > 0) {
          await get().mergeGuestWishlist();
          return;
        }

        applyServerWishlist(res);
      } catch {
        // keep whatever is in localStorage rather than blanking the wishlist
        const wishlist = readLocalWishlist();
        set({ wishlist, ids: toIds(wishlist), hydrated: true });
      }
    },

    fetchWishlist: async () => {
      set({ loading: true });
      try {
        await get().hydrateWishlist();
      } finally {
        set({ loading: false });
      }
    },

    // kept for the callers that only need the heart icons painted
    fetchIds: async () => {
      await get().hydrateWishlist();
    },

    mergeGuestWishlist: async () => {
      cancelAllPendingSync();

      if (!isLoggedIn()) return;

      const productIds = Array.from(new Set(toIds(readLocalWishlist())));

      try {
        if (productIds.length > 0) {
          applyServerWishlist(
            await postRequest({
              url: "/api/v1/wishlist/merge",
              body: { product_ids: productIds },
            }),
          );
        } else {
          applyServerWishlist(
            await getRequest("/api/v1/wishlist?limit=-1&variants=true"),
          );
        }
      } catch {
        // login must not fail because of the wishlist hand-over
      }
    },

    // the next customer on this browser should not inherit the last one's
    // wishlist : the account keeps its own copy on the server
    clear: () => {
      // a pending write from the customer who just logged out must not land
      cancelAllPendingSync();

      if (typeof window !== "undefined") localStorage.removeItem("wishlist");
      // known-empty, not unknown : nothing left to read back in
      set({ ids: [], wishlist: [], hydrated: true });
    },
  };
});
