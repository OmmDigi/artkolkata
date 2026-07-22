import asyncErrorHandler from "../middleware/asyncErrorHandler";
import { promises as fs } from "fs";
import path from "path";
import { ApiResponse } from "../utils/ApiResponse";
import { ErrorHandler } from "../utils/ErrorHandler";

export const deleteFile = asyncErrorHandler(async (req, res) => {
  const query = req.query;
  if (!query.url)
    throw new ErrorHandler(400, "url or pathname is needed as query parameter");

  const url = query.url.toLocaleString();

  const hostname = process.env.HOST_NAME || "";
  const uploadsDir = path.resolve(__dirname, "../../uploads");
  const fileName = url.replace(`${hostname}/uploads/`, "");
  const deletePath = path.join(uploadsDir, fileName);

  if (!deletePath.startsWith(uploadsDir)) {
    throw new ErrorHandler(400, "Invalid file path");
  }

  await fs.unlink(deletePath);

  res
    .status(200)
    .json(new ApiResponse(200, "File Removed From Server", deletePath));
});
