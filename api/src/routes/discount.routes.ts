import { Router } from "express";
// import { isAuthorized } from "../middleware/isAuthorized";
// import {
//   createDiscount,
//   deleteDiscount,
//   getAllDiscountList,
//   validateDiscountController,
// } from "../controllers/discount.controller";
import { isAuthorized } from "../middleware/isAuthorized";
import {
  createAutoDiscountRule,
  createDiscount,
  deleteAutoDiscountRule,
  deleteDiscount,
  getAutoDiscountRules,
  getDiscountList,
  getSingleAutoDiscountRule,
  getSingleDiscount,
  updateAutoDiscountRule,
  updateDiscount,
  validateDiscount,
} from "../controllers/discount.controller";
import { checkUser } from "../middleware/checkUser";
import { isAuthorizedV2 } from "../middleware/isAuthorizedV2";
import { rateLimits } from "../middleware/rateLimits";

export const discountRoute = Router();

// discountRoute
//   .post("/", isAuthorized, createDiscount)
//   .get("/", getAllDiscountList)
//   .delete("/:id", isAuthorized, deleteDiscount)
//   .post("/validate", isAuthenticated, validateDiscountController)

discountRoute
  // automatic (no code) order value discounts.
  // registered before "/:id" so the literal path is not read as a coupon id
  .get(
    "/auto-rules",
    rateLimits.publicReadUncached,
    checkUser,
    getAutoDiscountRules,
  )
  .post(
    "/auto-rules",
    rateLimits.adminWrite,
    isAuthorizedV2(["1-4"]),
    createAutoDiscountRule,
  )
  .get(
    "/auto-rules/:id",
    rateLimits.adminRead,
    isAuthorizedV2(["1-4"]),
    getSingleAutoDiscountRule,
  )
  .put(
    "/auto-rules/:id",
    rateLimits.adminWrite,
    isAuthorizedV2(["1-4"]),
    updateAutoDiscountRule,
  )
  .delete(
    "/auto-rules/:id",
    rateLimits.adminWrite,
    isAuthorizedV2(["1-4"]),
    deleteAutoDiscountRule,
  )

  .get("/", rateLimits.publicReadUncached, checkUser, getDiscountList)
  .delete(
    "/:id",
    rateLimits.adminWrite,
    isAuthorizedV2(["1-4"]),
    deleteDiscount,
  )
  .post("/", rateLimits.adminWrite, isAuthorizedV2(["1-4"]), createDiscount)
  /**
   * checkUser, not isAuthenticated: applying a coupon is part of checkout, and
   * checkout no longer requires a session. validateDiscount reads nothing off
   * req.token_info — it is cart maths over the posted lines — and
   * POST /orders/price-breakdown already runs the same calculation with the
   * same code for anyone. Requiring a session here only meant a guest could
   * see the discounted total but never press Apply, and place-order would then
   * take the code from them anyway. Abuse is capped the same way it is there:
   * rateLimits.couponValidate is keyed by ip, not by user.
   */
  .post("/validate", rateLimits.couponValidate, checkUser, validateDiscount)
  .put("/:id", rateLimits.adminWrite, isAuthorizedV2(["1-4"]), updateDiscount)
  .get(
    "/:id",
    rateLimits.adminRead,
    isAuthorizedV2(["1-4"]),
    getSingleDiscount,
  );
