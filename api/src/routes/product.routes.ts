import { Router } from "express";
import {
  addNewProduct,
  addProductTag,
  addNewRecipient,
  copyProduct,
  createNewCategory,
  createNewReview,
  createNewSubCategory,
  deleteProduct,
  deleteProductTag,
  deleteRecipient,
  deleteReview,
  deleteSingleCategory,
  deleteSingleSubCategory,
  getCategoryList,
  getProductFilterList,
  getProductList,
  getProductTagList,
  getRecipientList,
  getReviewAnalytics,
  getReviewList,
  getTopReviewList,
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
import { cacheResponse } from "../middleware/cacheResponse";
import { CACHE_TAGS } from "../services/cache.service";
import { rateLimits } from "../middleware/rateLimits";

export const productRoute = Router();

// A product response is assembled from its category, sub category, images,
// variant prices and approved reviews, so it has to die when any of those move.
const PRODUCT_READ_TAGS = [
  CACHE_TAGS.PRODUCTS,
  CACHE_TAGS.CATEGORIES,
  CACHE_TAGS.SUB_CATEGORIES,
  CACHE_TAGS.REVIEWS,
] as const;

productRoute
  .get(
    "/",
    rateLimits.publicRead,
    checkUser,
    cacheResponse({
      tags: PRODUCT_READ_TAGS,
      adminPermissions: ["1-3", "1-6"],
    }),
    getProductList,
  )
  .get(
    "/filters",
    rateLimits.publicRead,
    checkUser,
    cacheResponse({
      tags: PRODUCT_READ_TAGS,
      adminPermissions: ["1-3"],
    }),
    getProductFilterList,
  )
  .post("/", rateLimits.adminWrite, isAuthorizedV2(["1-3"]), addNewProduct)
  .put("/", rateLimits.adminWrite, isAuthorizedV2(["1-3"]), updateProduct)
  .delete("/:id", rateLimits.adminWrite, isAuthorizedV2(["1-3"]), deleteProduct)
  .post("/copy", rateLimits.adminWrite, isAuthorizedV2(["1-3"]), copyProduct)

  .get(
    "/tags",
    rateLimits.publicRead,
    cacheResponse({ tags: [CACHE_TAGS.PRODUCT_TAGS] }),
    getProductTagList,
  )
  .post("/tags", rateLimits.adminWrite, isAuthorizedV2(["1-3"]), addProductTag)
  .delete(
    "/tags/:id",
    rateLimits.adminWrite,
    isAuthorizedV2(["1-3"]),
    deleteProductTag,
  )

  .post(
    "/recipient",
    rateLimits.adminWrite,
    isAuthorizedV2(["1-3"]),
    addNewRecipient,
  )
  .put(
    "/recipient",
    rateLimits.adminWrite,
    isAuthorizedV2(["1-3"]),
    updateRecipient,
  )
  .get(
    "/recipient",
    rateLimits.publicRead,
    checkUser,
    cacheResponse({
      tags: [CACHE_TAGS.RECIPIENTS],
      adminPermissions: ["1-7"],
    }),
    getRecipientList,
  )
  .get(
    "/recipient/:id",
    rateLimits.publicRead,
    checkUser,
    cacheResponse({
      tags: [CACHE_TAGS.RECIPIENTS],
      adminPermissions: ["1-7"],
    }),
    getSingleRecipientList,
  )
  .delete(
    "/recipient/:id",
    rateLimits.adminWrite,
    isAuthorizedV2(["1-3"]),
    deleteRecipient,
  )

  .post(
    "/category",
    rateLimits.adminWrite,
    isAuthorizedV2(["1-3"]),
    createNewCategory,
  )
  .get(
    "/category",
    rateLimits.publicRead,
    checkUser,
    cacheResponse({
      tags: [CACHE_TAGS.CATEGORIES, CACHE_TAGS.SUB_CATEGORIES],
      adminPermissions: ["1-3"],
    }),
    getCategoryList,
  )
  .put(
    "/category",
    rateLimits.adminWrite,
    isAuthorizedV2(["1-3"]),
    updateCateogry,
  )
  .get(
    "/category/:id",
    rateLimits.publicRead,
    checkUser,
    cacheResponse({
      tags: [CACHE_TAGS.CATEGORIES, CACHE_TAGS.SUB_CATEGORIES],
      adminPermissions: ["1-3"],
    }),
    getSingleCategory,
  )
  .delete(
    "/category/:id",
    rateLimits.adminWrite,
    isAuthorizedV2(["1-3"]),
    deleteSingleCategory,
  )

  .post(
    "/sub-category",
    rateLimits.adminWrite,
    isAuthorizedV2(["1-3"]),
    createNewSubCategory,
  )
  .get(
    "/sub-category",
    rateLimits.publicRead,
    cacheResponse({
      tags: [CACHE_TAGS.SUB_CATEGORIES, CACHE_TAGS.CATEGORIES],
    }),
    getSubCategoryList,
  )
  .put(
    "/sub-category",
    rateLimits.adminWrite,
    isAuthorizedV2(["1-3"]),
    updateSubCateogry,
  )
  .get(
    "/sub-category/:id",
    rateLimits.publicRead,
    cacheResponse({
      tags: [CACHE_TAGS.SUB_CATEGORIES, CACHE_TAGS.CATEGORIES],
    }),
    getSingleSubCategory,
  )
  .delete(
    "/sub-category/:id",
    rateLimits.adminWrite,
    isAuthorizedV2(["1-3"]),
    deleteSingleSubCategory,
  )

  .post(
    "/reviews",
    rateLimits.reviewCreate,
    isAuthenticatedWithMsg("You must log in to give a review."),
    createNewReview,
  )
  .get(
    "/reviews",
    rateLimits.publicRead,
    checkUser,
    cacheResponse({
      tags: [CACHE_TAGS.REVIEWS, CACHE_TAGS.PRODUCTS],
      adminPermissions: ["1-6"],
    }),
    getReviewList,
  )
  .get(
    "/reviews/analytics",
    rateLimits.publicRead,
    checkUser,
    cacheResponse({
      tags: [CACHE_TAGS.REVIEWS],
      adminPermissions: ["1-6"],
    }),
    getReviewAnalytics,
  )
  .get(
    "/reviews/top",
    rateLimits.publicRead,
    cacheResponse({ tags: [CACHE_TAGS.REVIEWS, CACHE_TAGS.PRODUCTS] }),
    getTopReviewList,
  )
  .patch(
    "/reviews/:id",
    rateLimits.adminWrite,
    isAuthorizedV2(["1-3"]),
    updateReviewStatus,
  )
  .delete(
    "/reviews/:id",
    rateLimits.adminWrite,
    isAuthorizedV2(["1-3"]),
    deleteReview,
  )

  .get(
    "/:product",
    rateLimits.publicRead,
    checkUser,
    cacheResponse({
      tags: PRODUCT_READ_TAGS,
      adminPermissions: ["1-3"],
    }),
    getSingleProductWithId,
  );
