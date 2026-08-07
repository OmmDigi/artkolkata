import { Router } from "express";
// import { isAuthorized } from "../middleware/isAuthorized";
// import {
//   createDiscount,
//   deleteDiscount,
//   getAllDiscountList,
//   validateDiscountController,
// } from "../controllers/discount.controller";
import { isAuthenticated } from "../middleware/isAuthenticated";
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

export const discountRoute = Router();

// discountRoute
//   .post("/", isAuthorized, createDiscount)
//   .get("/", getAllDiscountList)
//   .delete("/:id", isAuthorized, deleteDiscount)
//   .post("/validate", isAuthenticated, validateDiscountController)

discountRoute
  // automatic (no code) order value discounts.
  // registered before "/:id" so the literal path is not read as a coupon id
  .get("/auto-rules", checkUser, getAutoDiscountRules)
  .post("/auto-rules", isAuthorizedV2(["1-4"]), createAutoDiscountRule)
  .get("/auto-rules/:id", isAuthorizedV2(["1-4"]), getSingleAutoDiscountRule)
  .put("/auto-rules/:id", isAuthorizedV2(["1-4"]), updateAutoDiscountRule)
  .delete("/auto-rules/:id", isAuthorizedV2(["1-4"]), deleteAutoDiscountRule)

  .get("/", checkUser, getDiscountList)
  .delete("/:id", isAuthorizedV2(["1-4"]), deleteDiscount)
  .post("/", isAuthorizedV2(["1-4"]), createDiscount)
  .post("/validate", isAuthenticated, validateDiscount)
  .put("/:id", isAuthorizedV2(["1-4"]), updateDiscount)
  .get("/:id", isAuthorizedV2(["1-4"]), getSingleDiscount)
