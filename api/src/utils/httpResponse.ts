import { Response } from "express";

export const httpResponse = (
  res: Response,
  status: number,
  message: string,
  data: null | any = null,
  key: string[] = [],
  totalPage: number = 0
) => {
  res.status(status).json({
    statusCode: status,
    message,
    success: status < 400,
    data,
    key,
    totalPage,
  });
};
