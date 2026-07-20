import path from "path";
import asyncErrorHandler from "../middleware/asyncErrorHandler";
import { ErrorHandler } from "../utils/ErrorHandler";
import { ApiResponse } from "../utils/ApiResponse";
import { PRIVATE_FOLDER_NAME } from "../constant";

export const viewPrivateFile = asyncErrorHandler(async (req, res) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader)
    throw new ErrorHandler(401, "Your are not able to access this resource");

  const token = authHeader.split(" ")[1];
  if (token !== process.env.PRIVATE_FILE_ACCESS_TOKEN)
    throw new ErrorHandler(401, "Your are not able to access this resource");

  const PRIVATE_DIR = path.join(__dirname, `../../${PRIVATE_FOLDER_NAME}`);

  const dynPath = req.params[0];
  const filepath = path.join(PRIVATE_DIR, dynPath);

  if (!filepath.includes(PRIVATE_FOLDER_NAME))
    throw new ErrorHandler(400, "Invalid path");

  res.sendFile(filepath, (err) => {
    if (err) {
      res.status(404).json(new ApiResponse(404, "File not found"));
    }
  });
});
