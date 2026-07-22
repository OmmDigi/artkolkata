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

export const userRoute = Router();

userRoute
  .get("/is-login", isAuthenticated, checkUserLoginInfo)

  .post("/save", isAuthorizedV2(["1-11"]), saveUserInfo) // save user info
  .post("/employee/save", isAuthorizedV2(["1-12"]), saveUserInfo)

  .post("/employee/permission", isAuthorizedV2(["1-12"]), saveUserPermission) // permission can only be done to employee

  .post("/my-address", isAuthenticated, saveUserAddress) // logged-in user manages own addresses
  .delete("/my-address", isAuthenticated, deleteUserAddress)

  .post("/address", isAuthorizedV2(["1-11"]), saveUserAddress)
  .post("/employee/address", isAuthorizedV2(["1-12"]), saveUserAddress)

  .delete("/address", isAuthorizedV2(["1-11"]), deleteUserAddress)
  .delete("/employee/address", isAuthorizedV2(["1-12"]), deleteUserAddress)

  .post("/signup", signUp)
  .post("/login", login)
  .post("/verify-otp", verifyOtp)
  .post("/send-otp", sendOtp)
  .get("/", isAuthorizedV2(["1-11"]), getUserList)
  .get("/employee", isAuthorizedV2(["1-12"]), getUserList)

  .get("/login/google", loginWithGoogle)
  .get("/login/google/verify", verifyGoogleLogin)

  .get("/orders", isAuthenticated, getUserOrdersList)

  .get("/profile", isAuthenticated, getSingleUser) //get user profile info
  .get("/:id", isAuthorizedV2(["1-11"]), getSingleUser) // get single user info admin panel
  .get("/employee/:id", isAuthorizedV2(["1-12"]), getSingleUser); // get single employee info from admin panel
