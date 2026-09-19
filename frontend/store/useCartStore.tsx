import { create } from "zustand";
import {
  deleteRequest,
  getRequest,
  patchRequest,
  postRequest,
} from "@/lib/fetcher";

interface CartItem {
  id: number;
  variantId: number | null;
  quantity: number;
  product: any; // full merged product+variant object
}

interface CartState {
  cart: CartItem[];
  // the account cart has been read at least once this session
  hydrated: boolean;
  addToCart: (
    product: any,
    variantId: number | null,
    quantity?: number
  ) => void;
  removeFromCart: (id: number, variantId: number | null) => void;
  updateQuantity: (
    id: number,
    variantId: number | null,
    quantity: number
  ) => void;

  isInCart: (id: number, variantId: number | null) => boolean;
  getItemQty: (id: number, variantId: number | null) => number;
  // resolves once the account cart is gone too, so a caller that is about to
  // navigate away can wait for the DELETE instead of having it cancelled
  clearCart: () => Promise<void>;

  // read the account cart and make it the local one (call on app mount)
  hydrateCart: () => Promise<void>;
  // hand the guest cart over at login, quantities are summed server side
  mergeGuestCart: () => Promise<void>;
  // logout : drop what is on screen without touching the stored account cart
  resetLocalCart: () => void;
}

/**
 * A guest shops straight into localStorage. Once there is a token the same
 * actions also go to /api/v1/cart, which is what makes the cart follow the
 * customer to another device and what the CMS reads. The server answers every
 * write with the whole cart, so its reply is taken as the truth.
 */
const isLoggedIn = () =>
  typeof window !== "undefined" && !!localStorage.getItem("token");

const readLocalCart = (): CartItem[] => {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("cart") || "[]");
  } catch {
    return [];
  }
};

const writeLocalCart = (cart: CartItem[]) => {
  if (typeof window === "undefined") return;
  localStorage.setItem("cart", JSON.stringify(cart));
};

// One pending write per cart line, keyed by product + variant. A stepper held
// down fires a click per unit, and only the last one is worth sending.
const QUANTITY_SYNC_DELAY = 600;
const quantityTimers: Record<string, ReturnType<typeof setTimeout>> = {};

const lineKey = (id: number, variantId: number | null) =>
  `${id}:${variantId ?? 0}`;

const cancelPendingSync = (key: string) => {
  if (!quantityTimers[key]) return;
  clearTimeout(quantityTimers[key]);
  delete quantityTimers[key];
};

const cancelAllPendingSync = () => {
  Object.keys(quantityTimers).forEach(cancelPendingSync);
};

// rows come back in the store's own shape, only the extras are dropped
const toCartItems = (rows: any[]): CartItem[] =>
  (rows ?? []).map((row) => ({
    id: Number(row.id),
    variantId: row.variantId ?? null,
    quantity: Number(row.quantity),
    product: row.product,
  }));

export const useCartStore = create<CartState>((set, get) => {
  /**
   * The browser copy is pulled in on first use rather than when the module is
   * evaluated. The server renders this file too, where there is no
   * localStorage, so seeding `cart` from it made the server send an empty cart
   * and the browser immediately render a full one — a hydration mismatch that
   * React resolves by throwing the first render away.
   *
   * hydrateCart() does this on mount. Every action calls it as well, so a
   * click that somehow lands first still writes on top of the stored cart
   * instead of on top of an empty one.
   */
  const ensureLocalCart = () => {
    if (get().hydrated || typeof window === "undefined") return;
    set({ cart: readLocalCart(), hydrated: true });
  };

  // the server's reply is the whole cart, so it replaces what is on screen
  const applyServerCart = (res: any) => {
    const cart = toCartItems(res?.data);
    writeLocalCart(cart);
    set({ cart, hydrated: true });
  };

  // a failed write would leave the screen ahead of the account, so the cart is
  // pulled back from the server instead of guessing what got through
  const resync = async () => {
    try {
      applyServerCart(await getRequest("/api/v1/cart"));
    } catch {
      /* offline or logged out : the local cart stays as it is */
    }
  };

  /**
   * Sends the line's quantity once the clicking stops. The number is read when
   * the timer fires, not when it was scheduled, so ten taps on "+" are one
   * PATCH carrying the final quantity. PATCH sets rather than adds, which is
   * what makes a dropped or reordered request harmless.
   */
  const scheduleQuantitySync = (id: number, variantId: number | null) => {
    if (!isLoggedIn()) return;

    const key = lineKey(id, variantId);
    cancelPendingSync(key);

    quantityTimers[key] = setTimeout(() => {
      delete quantityTimers[key];

      const quantity = get().getItemQty(id, variantId);
      // the line was removed while the timer was running : the DELETE that
      // removed it has already told the server, nothing to send
      if (quantity <= 0) return;

      patchRequest({
        url: "/api/v1/cart",
        body: {
          product_id: Number(id),
          variant_id: variantId ?? null,
          quantity,
        },
      })
        .then(applyServerCart)
        .catch(resync);
    }, QUANTITY_SYNC_DELAY);
  };

  return {
    // starts empty on both sides of the render, filled by ensureLocalCart()
    cart: [],
    hydrated: false,

    // ✅ ADD TO CART
    addToCart: (product, variantId, quantity = 1) => {
      ensureLocalCart();

      set((state) => {
        const exists = state.cart.find(
          (item) => item.id === product.id && item.variantId === variantId
        );
        let newCart;

        if (exists) {
          // Item already exists → just increase quantity
          newCart = state.cart.map((item) =>
            item.id === product.id && item.variantId === variantId
              ? { ...item, quantity: item.quantity + quantity }
              : item
          );
        } else {
          // First time adding → store full product + variant details
          newCart = [
            ...state.cart,
            {
              id: product.id,
              variantId,
              quantity,
              product, // 🔥 product includes your merged price, options, images, variant info
            },
          ];
        }

        writeLocalCart(newCart);
        return { cart: newCart };
      });

      if (!isLoggedIn()) return;

      // A stepper on this line is still settling, and its PATCH carries the
      // whole quantity. Adding on top of that would count this click twice, so
      // the pending write is simply rescheduled with the new total.
      if (quantityTimers[lineKey(Number(product.id), variantId)]) {
        scheduleQuantitySync(Number(product.id), variantId);
        return;
      }

      postRequest({
        url: "/api/v1/cart",
        body: {
          product_id: Number(product.id),
          variant_id: variantId ?? null,
          quantity,
        },
      })
        .then(applyServerCart)
        .catch(resync);
    },

    // ❌ REMOVE ITEM
    removeFromCart: (id, variantId) => {
      ensureLocalCart();

      set((state) => {
        const newCart = state.cart.filter(
          (item) => !(item.id === id && item.variantId === variantId)
        );

        writeLocalCart(newCart);
        return { cart: newCart };
      });

      // whatever the stepper was about to send is moot now
      cancelPendingSync(lineKey(id, variantId));

      if (!isLoggedIn()) return;

      deleteRequest({
        url: `/api/v1/cart/${id}${
          variantId != null ? `?variant_id=${variantId}` : ""
        }`,
      })
        .then(applyServerCart)
        .catch(resync);
    },

    // 🔄 UPDATE QUANTITY
    updateQuantity: (id, variantId, quantity) => {
      ensureLocalCart();

      set((state) => {
        const newCart = state.cart.map((item) =>
          item.id === id && item.variantId === variantId
            ? { ...item, quantity }
            : item
        );

        writeLocalCart(newCart);
        return { cart: newCart };
      });

      // the screen has already moved, the account catches up once the clicking
      // stops rather than on every press
      scheduleQuantitySync(id, variantId);
    },

    // ❓ CHECK IF ITEM EXISTS
    isInCart: (id, variantId) =>
      get().cart.some((item) => item.id === id && item.variantId === variantId),

    // 🔢 GET ITEM QUANTITY
    getItemQty: (id, variantId) => {
      const item = get().cart.find(
        (i) => i.id === id && i.variantId === variantId
      );
      return item ? item.quantity : 0;
    },

    // 🗑️ CLEAR CART — also empties the account cart, this is what runs once an
    // order has been placed
    clearCart: async () => {
      // a stepper still settling would otherwise write a line back in
      cancelAllPendingSync();

      if (typeof window !== "undefined") localStorage.removeItem("cart");
      set({ cart: [], hydrated: true });

      if (!isLoggedIn()) return;

      try {
        await deleteRequest({ url: "/api/v1/cart" });
      } catch {
        /* the next write or reload resyncs it */
      }
    },

    hydrateCart: async () => {
      cancelAllPendingSync();

      // A guest's cart only ever exists in this browser, so hydrating is
      // reading it back. Nothing is requested: the cart endpoints all need a
      // session and a 401 here is noise, not information.
      if (!isLoggedIn()) {
        set({ cart: readLocalCart(), hydrated: true });
        return;
      }

      try {
        const res: any = await getRequest("/api/v1/cart");

        // An account with nothing stored but items sitting in this browser is
        // either a cart filled before this screen started saving to the server
        // or one filled while the request was failing, so it is handed over
        // rather than wiped. The other way round the server wins, which is
        // what stops a reload from doubling quantities.
        if ((res?.data?.length ?? 0) === 0 && readLocalCart().length > 0) {
          await get().mergeGuestCart();
          return;
        }

        applyServerCart(res);
      } catch {
        // keep whatever is in localStorage rather than blanking the cart
        set({ cart: readLocalCart(), hydrated: true });
      }
    },

    mergeGuestCart: async () => {
      cancelAllPendingSync();

      if (!isLoggedIn()) return;

      const localItems = readLocalCart()
        .filter((item) => item?.id)
        .map((item) => ({
          product_id: Number(item.id),
          variant_id: item.variantId ?? null,
          quantity: Math.max(1, Number(item.quantity) || 1),
        }));

      try {
        if (localItems.length > 0) {
          applyServerCart(
            await postRequest({
              url: "/api/v1/cart/merge",
              body: { items: localItems },
            })
          );
        } else {
          applyServerCart(await getRequest("/api/v1/cart"));
        }
      } catch {
        // login must not fail because of the cart hand-over
      }
    },

    // the next customer on this browser should not inherit the last one's cart
    resetLocalCart: () => {
      // a pending write from the customer who just logged out must not land
      cancelAllPendingSync();

      if (typeof window !== "undefined") localStorage.removeItem("cart");
      // known-empty, not unknown : nothing left to read back in
      set({ cart: [], hydrated: true });
    },
  };
});
