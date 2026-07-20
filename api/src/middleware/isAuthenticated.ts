import { NextFunction, Response } from "express";
import asyncErrorHandler from "./asyncErrorHandler";
import { ErrorHandler } from "../utils/ErrorHandler";
import { CustomRequest, ITokenInfo } from "../types";
import { getAuthToken } from "../utils/getAuthToken";
import { verifyToken } from "../services/jwt";

export const isAuthenticated = asyncErrorHandler(
  async (req: CustomRequest, _: Response, next: NextFunction) => {
    if (req.token_info) {
      return next();
    }

    const token = getAuthToken(req);

    if (!token) throw new ErrorHandler(401, "Unauthorized");

    const { data, error } = await verifyToken<ITokenInfo>(token);
    if (error) throw new ErrorHandler(401, "Unauthorized");

    req.token_info = data || undefined;

    next();
  },
);

export const isAuthenticatedWithMsg =
  (msg?: string) =>
  async (req: CustomRequest, _: Response, next: NextFunction) => {
    if (req.token_info) {
      return next();
    }

    const token = getAuthToken(req);

    if (!token) throw new ErrorHandler(401, msg ?? "Unauthorized");

    const { data, error } = await verifyToken<ITokenInfo>(token);
    if (error) throw new ErrorHandler(401, msg ?? "Unauthorized");

    req.token_info = data || undefined;

    next();
  };
