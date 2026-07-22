import { Router } from "express";
import {
  createOrder,
  doCancel,
  doReturn,
  downloadInvoice,
  getOrderList,
  getSingleOrderInfo,
  trackOrder,
  updateOrderStatus,
} from "../controllers/order.controller";
import { isAuthenticated } from "../middleware/isAuthenticated";
import { isAuthorizedV2 } from "../middleware/isAuthorizedV2";

export const orderRoutes = Router();
orderRoutes
  .post("/place-order", isAuthenticated, createOrder)
  .get("/", isAuthorizedV2(["1-5"]), getOrderList)
  .get("/track", trackOrder)
  .post("/return", isAuthenticated, doReturn)
  .post("/cancel", isAuthenticated, doCancel)
  .get("/invoice/:orderid", downloadInvoice)
  .patch("/", isAuthorizedV2(["1-5"]), updateOrderStatus)
  .get("/:orderid", isAuthorizedV2(["1-5"]), getSingleOrderInfo)
