import { NextFunction, Request, Response } from "express";
import { IError } from "../types";
import { httpResponse } from "../utils/httpResponse";
import logger from "../utils/logger";

const DBERRORS: any = {
  "42703": "undefined_column",
  "42601": "syntax_error",
};

const backErrorResponse = (
  err: IError,
  res: Response,
  mode: "prod" | "dev"
) => {
  if (err.isOperational) {
    //these errors will throw by me
    return httpResponse(
      res,
      err.statusCode,
      err.message,
      mode == "dev" ? err : null,
      err.key
    );
  } else if (err.code) {
    if (DBERRORS[err.code]) {
      return httpResponse(res, 400, DBERRORS[err.code], err, err.key);
    }
    httpResponse(res, 400, err.message, err, err.key);
  } else {
    httpResponse(res, 500, "Internal Server Error", err, err.key);
  }
};

export const globalErrorController = (
  err: IError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // const now = new Date();
  // const formatted = now.toLocaleString("en-US", {
  //   day: "2-digit",
  //   month: "long",
  //   year: "numeric",
  //   hour: "2-digit",
  //   minute: "2-digit",
  //   second: "2-digit",
  //   hour12: true,
  // });
  // console.log({
  //   error: err,
  //   url: req.url,
  //   method: req.method,
  //   time: formatted,
  // });

  const logPayload = {
    message: err.message,
    stack: err.stack,
    code: err.code,
    statusCode: err.statusCode || 500,
    url: req.url,
    method: req.method,
    body: req.body,
    query: req.query,
    ip: req.ip,
  };

  // log error with winston
  logger.error(logPayload);

  backErrorResponse(err, res, "dev");
};
