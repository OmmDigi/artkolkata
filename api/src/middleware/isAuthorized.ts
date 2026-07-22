import { NextFunction, Response } from "express";
import { CustomRequest, ITokenInfo, Role } from "../types";
import asyncErrorHandler from "./asyncErrorHandler";
import { ErrorHandler } from "../utils/ErrorHandler";
import { verifyToken } from "../services/jwt";
import { getAuthToken } from "../utils/getAuthToken";

export const isAuthorized = asyncErrorHandler(
  async (req: CustomRequest, _: Response, next: NextFunction) => {
    // if the tokeninfo already exist check user is authorize admin or not
    if (req.token_info) {
      if (req.token_info.role === "Admin") {
        return next();
      }
      throw new ErrorHandler(403, "Forbidden");
    }

    // if the tokeninfo not exist get the token and than check the authority
    const token = getAuthToken(req);

    if (!token) throw new ErrorHandler(403, "Forbidden");

    const { data, error } = await verifyToken<ITokenInfo>(token);
    if (error) throw new ErrorHandler(403, "Forbidden");

    req.token_info = data || undefined;

    if (data) {
      if (data.role === "Admin") {
        return next();
      }
      throw new ErrorHandler(403, "Forbidden");
    }
  }
);
