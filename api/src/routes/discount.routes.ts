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
  createDiscount,
  deleteDiscount,
  getDiscountList,
  getSingleDiscount,
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
  .get("/", checkUser, getDiscountList)
  .delete("/:id", isAuthorizedV2(["1-4"]), deleteDiscount)
  .post("/", isAuthorizedV2(["1-4"]), createDiscount)
  .post("/validate", isAuthenticated, validateDiscount)
  .put("/:id", isAuthorizedV2(["1-4"]), updateDiscount)
  .get("/:id", isAuthorizedV2(["1-4"]), getSingleDiscount)
