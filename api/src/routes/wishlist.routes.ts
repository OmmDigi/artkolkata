import { Router } from "express";
import {
  addToWishlist,
  clearWishlist,
  getUserWishlist,
  getWishlist,
  getWishlistProductIds,
  removeFromWishlist,
} from "../controllers/wishlist.controller";
import { isAuthenticated } from "../middleware/isAuthenticated";
import { isAuthorizedV2 } from "../middleware/isAuthorizedV2";
import { rateLimits } from "../middleware/rateLimits";

export const wishlistRoutes = Router();

wishlistRoutes
  // admin panel : needs the "Registered Users" permission (1-11)
  .get(
    "/user/:user_id",
    rateLimits.adminRead,
    isAuthorizedV2(["1-11"]),
    getUserWishlist,
  )

  // storefront : always scoped to the logged-in user
  .get("/", rateLimits.wishlist, isAuthenticated, getWishlist)
  .get("/ids", rateLimits.wishlist, isAuthenticated, getWishlistProductIds)
  .post("/", rateLimits.wishlist, isAuthenticated, addToWishlist)
  .delete("/", rateLimits.wishlist, isAuthenticated, clearWishlist)
  .delete(
    "/:product_id",
    rateLimits.wishlist,
    isAuthenticated,
    removeFromWishlist,
  );
