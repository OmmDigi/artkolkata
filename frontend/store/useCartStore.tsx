import { create } from "zustand";

interface CartItem {
  id: number;
  variantId: number | null;
  quantity: number;
  product: any; // full merged product+variant object
}

interface CartState {
  cart: CartItem[];
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
}

export const useCartStore = create<CartState>((set, get) => ({
  cart:
    typeof window !== "undefined"
      ? JSON.parse(localStorage.getItem("cart") || "[]")
      : [],

  // ✅ ADD TO CART
  addToCart: (product, variantId, quantity = 1) =>
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

      localStorage.setItem("cart", JSON.stringify(newCart));
      return { cart: newCart };
    }),

  // ❌ REMOVE ITEM
  removeFromCart: (id, variantId) =>
    set((state) => {
      const newCart = state.cart.filter(
        (item) => !(item.id === id && item.variantId === variantId)
      );

      localStorage.setItem("cart", JSON.stringify(newCart));
      return { cart: newCart };
    }),

  // 🔄 UPDATE QUANTITY
  updateQuantity: (id, variantId, quantity) =>
    set((state) => {
      const newCart = state.cart.map((item) =>
        item.id === id && item.variantId === variantId
          ? { ...item, quantity }
          : item
      );

      localStorage.setItem("cart", JSON.stringify(newCart));
      return { cart: newCart };
    }),

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
}));
