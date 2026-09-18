import { Router } from "express";
import {
  addToCart,
  clearCart,
  getCart,
  getCartSummary,
  getUserCart,
  mergeCart,
  removeFromCart,
  updateCartItem,
} from "../controllers/cart.controller";
import { isAuthenticated } from "../middleware/isAuthenticated";
import { isAuthorizedV2 } from "../middleware/isAuthorizedV2";
import { rateLimits } from "../middleware/rateLimits";

export const cartRoutes = Router();

cartRoutes
  // admin panel : needs the "Registered Users" permission (1-11)
  .get(
    "/user/:user_id",
    rateLimits.adminRead,
    isAuthorizedV2(["1-11"]),
    getUserCart,
  )

  // storefront : always scoped to the logged-in user
  .get("/", rateLimits.cart, isAuthenticated, getCart)
  .get("/summary", rateLimits.cart, isAuthenticated, getCartSummary)
  .post("/", rateLimits.cart, isAuthenticated, addToCart)
  // the guest cart handed over right after login
  .post("/merge", rateLimits.cart, isAuthenticated, mergeCart)
  .patch("/", rateLimits.cart, isAuthenticated, updateCartItem)
  .delete("/", rateLimits.cart, isAuthenticated, clearCart)
  .delete("/:product_id", rateLimits.cart, isAuthenticated, removeFromCart);
