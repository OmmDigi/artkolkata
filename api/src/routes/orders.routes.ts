import { Router } from "express";
import {
  createOrder,
  deleteOrderInvoice,
  doCancel,
  doReturn,
  downloadInvoice,
  downloadPaymentSlip,
  getOrderList,
  getPriceBreakdown,
  getSingleOrderInfo,
  trackOrder,
  updateOrderStatus,
  updateShipmentBoxes,
  uploadOrderInvoice,
} from "../controllers/order.controller";
import { isAuthenticated } from "../middleware/isAuthenticated";
import { isAuthorizedV2 } from "../middleware/isAuthorizedV2";

export const orderRoutes = Router();
orderRoutes
  .post("/place-order", isAuthenticated, createOrder)
  .post("/price-breakdown", getPriceBreakdown)
  .get("/", isAuthorizedV2(["1-5"]), getOrderList)
  .get("/track", trackOrder)
  .post("/return", isAuthenticated, doReturn)
  .post("/cancel", isAuthenticated, doCancel)
  .get("/invoice/:orderid", downloadInvoice)
  .get("/payment-slip/:orderid", downloadPaymentSlip)
  .patch("/", isAuthorizedV2(["1-5"]), updateOrderStatus)
  .put("/:orderid/shipment-boxes", isAuthorizedV2(["1-5"]), updateShipmentBoxes)
  .put("/:orderid/invoice", isAuthorizedV2(["1-5"]), uploadOrderInvoice)
  .delete("/:orderid/invoice", isAuthorizedV2(["1-5"]), deleteOrderInvoice)
  .get("/:orderid", isAuthorizedV2(["1-5"]), getSingleOrderInfo)
