import { NextFunction, Request, Response } from "express";
import { IError } from "../types";
import { ApiResponse } from "../utils/ApiResponse";

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
    res
      .status(err.statusCode)
      .json(
        new ApiResponse(
          err.statusCode,
          err.message,
          mode == "dev" ? err : null,
          err.key
        )
      );
  } else if (err.code) {
    if (DBERRORS[err.code]) {
      return res
        .status(400)
        .json(new ApiResponse(400, DBERRORS[err.code], err, err.key));
    }

    res.status(400).json(new ApiResponse(400, err.message, err, err.key));
  } else {
    res
      .status(500)
      .json(new ApiResponse(500, "Internal Server Error", err, err.key));
  }
};

export const globalErrorController = (
  err: IError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // if(process.env.NODE_ENV === "development") {
  //   console.log(err);
  // }
  backErrorResponse(err, res, "prod");
};
