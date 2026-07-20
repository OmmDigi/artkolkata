import { NextFunction, Response } from "express";
import { CustomRequest, ITokenInfo, RoteIds } from "../types";
import asyncErrorHandler from "./asyncErrorHandler";
import { ErrorHandler } from "../utils/ErrorHandler";
import { verifyToken } from "../services/jwt";
import { getAuthToken } from "../utils/getAuthToken";
import { checkPermission } from "../utils/checkPermissions";

export const isAuthorizedV2 = (routeId: RoteIds[], condition : "or" | "and" = "and") =>
  asyncErrorHandler(
    async (req: CustomRequest, _: Response, next: NextFunction) => {
      // if the tokeninfo already exist check user is authorize admin or not
      if (req.token_info) {
        // if (req.token_info.role === "Admin") {
        //   return next();
        // }
        // now check if the current request user has this route permission permission or not
        if (!checkPermission(req.token_info.permissions, routeId, condition)) {
          throw new ErrorHandler(403, "Forbidden");
        }
        return next();
      }

      // if the tokeninfo not exist get the token and than check the authority
      const token = getAuthToken(req);

      if (!token) throw new ErrorHandler(403, "Forbidden");

      const { data, error } = await verifyToken<ITokenInfo>(token);
      if (error) throw new ErrorHandler(403, "Forbidden");

      if (!data) throw new ErrorHandler(403, "Forbidden For Not Token Data");

      if (!checkPermission(data.permissions, routeId, condition)) {
        throw new ErrorHandler(403, "Forbidden");
      }

      req.token_info = data;

      next();
    },
  );
