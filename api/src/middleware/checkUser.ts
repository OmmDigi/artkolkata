import { NextFunction, Response } from "express";
import { CustomRequest, ITokenInfo } from "../types";
import asyncErrorHandler from "./asyncErrorHandler";
import { verifyToken } from "../services/jwt";
import { getAuthToken } from "../utils/getAuthToken";

// this middleware to check is the user is he admin or a user if user hide the private content only admin can show private data
export const checkUser = asyncErrorHandler(
  async (req: CustomRequest, _: Response, next: NextFunction) => {
    // if the tokeninfo already exist just go next
    if (req.token_info) {
      return next();
    }

    // if the tokeninfo not exist get the token and than check the token
    const token = getAuthToken(req);

    if (!token) {
      return next();
    }

    const { data, error } = await verifyToken<ITokenInfo>(token);
    // console.log("Inside Check User.ts", data)
    if (error) {
      // console.log(error)
      return next();
    }

    req.token_info = data || undefined;

    next();
  }
);
