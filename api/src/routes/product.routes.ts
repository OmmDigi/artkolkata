import { Router } from "express";
import {
  addNewProduct,
  addNewRecipient,
  copyProduct,
  createNewCategory,
  createNewReview,
  createNewSubCategory,
  deleteProduct,
  deleteRecipient,
  deleteReview,
  deleteSingleCategory,
  deleteSingleSubCategory,
  getCategoryList,
  getProductList,
  getRecipientList,
  getReviewList,
  getSingleCategory,
  getSingleProductWithId,
  getSingleRecipientList,
  getSingleSubCategory,
  getSubCategoryList,
  // getSingleProduct,
  updateCateogry,
  updateProduct,
  updateRecipient,
  updateReviewStatus,
  updateSubCateogry,
} from "../controllers/product.controller";
import { checkUser } from "../middleware/checkUser";
import {
  isAuthenticated,
  isAuthenticatedWithMsg,
} from "../middleware/isAuthenticated";
import { isAuthorizedV2 } from "../middleware/isAuthorizedV2";

export const productRoute = Router();

productRoute
  .get("/", checkUser, getProductList)
  .post("/", isAuthorizedV2(["1-3"]), addNewProduct)
  .put("/", isAuthorizedV2(["1-3"]), updateProduct)
  .delete("/:id", isAuthorizedV2(["1-3"]), deleteProduct)
  .post("/copy", isAuthorizedV2(["1-3"]), copyProduct)

  .post("/recipient", isAuthorizedV2(["1-3"]), addNewRecipient)
  .put("/recipient", isAuthorizedV2(["1-3"]), updateRecipient)
  .get("/recipient", checkUser, getRecipientList)
  .get("/recipient/:id", checkUser, getSingleRecipientList)
  .delete("/recipient/:id", isAuthorizedV2(["1-3"]), deleteRecipient)

  .post("/category", isAuthorizedV2(["1-3"]), createNewCategory)
  .get("/category", checkUser, getCategoryList)
  .put("/category", isAuthorizedV2(["1-3"]), updateCateogry)
  .get("/category/:id", checkUser, getSingleCategory)
  .delete("/category/:id", isAuthorizedV2(["1-3"]), deleteSingleCategory)

  .post("/sub-category", isAuthorizedV2(["1-3"]), createNewSubCategory)
  .get("/sub-category", getSubCategoryList)
  .put("/sub-category", isAuthorizedV2(["1-3"]), updateSubCateogry)
  .get("/sub-category/:id", getSingleSubCategory)
  .delete("/sub-category/:id", isAuthorizedV2(["1-3"]), deleteSingleSubCategory)

  .post(
    "/reviews",
    isAuthenticatedWithMsg("You must log in to give a review."),
    createNewReview,
  )
  .get("/reviews", checkUser, getReviewList)
  .patch("/reviews/:id", isAuthorizedV2(["1-3"]), updateReviewStatus)
  .delete("/reviews/:id", isAuthorizedV2(["1-3"]), deleteReview)

  .get("/:product", checkUser, getSingleProductWithId);
