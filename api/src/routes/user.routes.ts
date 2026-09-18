import { Router } from "express";
import {
  checkUserLoginInfo,
  deleteUserAddress,
  getSingleUser,
  getUserList,
  getUserOrdersList,
  login,
  loginWithGoogle,
  saveUserAddress,
  saveUserInfo,
  saveUserPermission,
  sendOtp,
  signUp,
  verifyGoogleLogin,
  verifyOtp,
} from "../controllers/user.controller";
import { isAuthenticated } from "../middleware/isAuthenticated";
import { isAuthorizedV2 } from "../middleware/isAuthorizedV2";
import { rateLimits } from "../middleware/rateLimits";

export const userRoute = Router();

userRoute
  .get(
    "/is-login",
    rateLimits.publicReadUncached,
    isAuthenticated,
    checkUserLoginInfo,
  )

  .post("/save", rateLimits.adminWrite, isAuthorizedV2(["1-11"]), saveUserInfo) // save user info
  .post(
    "/employee/save",
    rateLimits.adminWrite,
    isAuthorizedV2(["1-12"]),
    saveUserInfo,
  )

  .post(
    "/employee/permission",
    rateLimits.adminWrite,
    isAuthorizedV2(["1-12"]),
    saveUserPermission,
  ) // permission can only be done to employee

  .post(
    "/my-address",
    rateLimits.accountWrite,
    isAuthenticated,
    saveUserAddress,
  ) // logged-in user manages own addresses
  .delete(
    "/my-address",
    rateLimits.accountWrite,
    isAuthenticated,
    deleteUserAddress,
  )

  .post(
    "/address",
    rateLimits.adminWrite,
    isAuthorizedV2(["1-11"]),
    saveUserAddress,
  )
  .post(
    "/employee/address",
    rateLimits.adminWrite,
    isAuthorizedV2(["1-12"]),
    saveUserAddress,
  )

  .delete(
    "/address",
    rateLimits.adminWrite,
    isAuthorizedV2(["1-11"]),
    deleteUserAddress,
  )
  .delete(
    "/employee/address",
    rateLimits.adminWrite,
    isAuthorizedV2(["1-12"]),
    deleteUserAddress,
  )

  // Credential endpoints. login and send-otp each carry two limiters: one
  // counted per target account, one counted per source address. Neither is
  // sufficient alone — the first lets an attacker spread guesses across many
  // accounts, the second lets them rotate addresses against one account.
  .post("/signup", rateLimits.signup, signUp)
  .post("/login", rateLimits.loginIp, rateLimits.login, login)
  .post("/verify-otp", rateLimits.otpVerify, verifyOtp)
  .post("/send-otp", rateLimits.otpSendIp, rateLimits.otpSend, sendOtp)
  .get("/", rateLimits.adminRead, isAuthorizedV2(["1-11"]), getUserList)
  .get("/employee", rateLimits.adminRead, isAuthorizedV2(["1-12"]), getUserList)

  .get("/login/google", rateLimits.oauth, loginWithGoogle)
  .get("/login/google/verify", rateLimits.oauth, verifyGoogleLogin)

  .get(
    "/orders",
    rateLimits.publicReadUncached,
    isAuthenticated,
    getUserOrdersList,
  )

  .get(
    "/profile",
    rateLimits.publicReadUncached,
    isAuthenticated,
    getSingleUser,
  ) //get user profile info
  .get("/:id", rateLimits.adminRead, isAuthorizedV2(["1-11"]), getSingleUser) // get single user info admin panel
  .get(
    "/employee/:id",
    rateLimits.adminRead,
    isAuthorizedV2(["1-12"]),
    getSingleUser,
  ); // get single employee info from admin panel
