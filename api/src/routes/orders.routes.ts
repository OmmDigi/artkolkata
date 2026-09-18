import { Router } from "express";
import {
  bookReplacementShipment,
  cancelGuestOrder,
  createOrder,
  getGuestOrder,
  deleteOrderInvoice,
  doCancel,
  doReturn,
  downloadInvoice,
  emailOrderInvoice,
  downloadPackingSlip,
  downloadPaymentSlip,
  generateOrderInvoice,
  generateOrderPackingSlip,
  getOrderList,
  getPriceBreakdown,
  getSingleOrderInfo,
  trackOrder,
  updateOrderStatus,
  updateShipmentBoxes,
  uploadOrderInvoice,
} from "../controllers/order.controller";
import { isAuthenticated } from "../middleware/isAuthenticated";
import { checkUser } from "../middleware/checkUser";
import { isAuthorizedV2 } from "../middleware/isAuthorizedV2";
import { rateLimits } from "../middleware/rateLimits";

export const orderRoutes = Router();
orderRoutes
  /**
   * checkUser, not isAuthenticated: a request with no session is a guest
   * checkout, not an error. createOrder branches on req.token_info and refuses
   * the guest path itself when the owner has switched guest checkout off, so
   * the route stays open and the policy stays in one place.
   */
  .post("/place-order", rateLimits.orderPlace, checkUser, createOrder)

  /**
   * The guest equivalents of the account order screens. They carry no session,
   * so the guest order token minted at checkout is both the identity and the
   * authorisation — read by the controller from a header or ?guest_token=.
   *
   * Both are declared before "/:orderid" below so the literal path wins over
   * the parameter.
   */
  .get("/guest/order", rateLimits.publicReadUncached, getGuestOrder)
  .post("/guest/cancel", rateLimits.orderMutate, cancelGuestOrder)
  .post("/price-breakdown", rateLimits.priceBreakdown, getPriceBreakdown)
  .get("/", rateLimits.adminRead, isAuthorizedV2(["1-5"]), getOrderList)
  .get("/track", rateLimits.orderTrack, trackOrder)
  .post("/return", rateLimits.orderMutate, isAuthenticated, doReturn)
  .post("/cancel", rateLimits.orderMutate, isAuthenticated, doCancel)
  .get("/invoice/:orderid", rateLimits.documentDownload, downloadInvoice)
  .get(
    "/payment-slip/:orderid",
    rateLimits.documentDownload,
    downloadPaymentSlip,
  )
  .patch("/", rateLimits.adminWrite, isAuthorizedV2(["1-5"]), updateOrderStatus)
  .put(
    "/:orderid/shipment-boxes",
    rateLimits.adminWrite,
    isAuthorizedV2(["1-5"]),
    updateShipmentBoxes,
  )
  .post(
    "/:orderid/replacement-shipment",
    rateLimits.adminWrite,
    isAuthorizedV2(["1-5"]),
    bookReplacementShipment,
  )
  .put(
    "/:orderid/invoice",
    rateLimits.adminWrite,
    isAuthorizedV2(["1-5"]),
    uploadOrderInvoice,
  )
  // rendering a pdf is real work, so both generate routes sit behind the admin
  // write limiter rather than the read one
  .post(
    "/:orderid/invoice/generate",
    rateLimits.adminWrite,
    isAuthorizedV2(["1-5"]),
    generateOrderInvoice,
  )
  // Emailing the invoice is an admin action, one press at a time, and it costs
  // an outbound email — the write limiter, not the read one.
  .post(
    "/:orderid/invoice/email",
    rateLimits.adminWrite,
    isAuthorizedV2(["1-5"]),
    emailOrderInvoice,
  )
  .post(
    "/:orderid/packing-slip/generate",
    rateLimits.adminWrite,
    isAuthorizedV2(["1-5"]),
    generateOrderPackingSlip,
  )
  .get(
    "/:orderid/packing-slip",
    rateLimits.documentDownload,
    isAuthorizedV2(["1-5"]),
    downloadPackingSlip,
  )
  .delete(
    "/:orderid/invoice",
    rateLimits.adminWrite,
    isAuthorizedV2(["1-5"]),
    deleteOrderInvoice,
  )
  .get(
    "/:orderid",
    rateLimits.adminRead,
    isAuthorizedV2(["1-5"]),
    getSingleOrderInfo,
  );
