import asyncErrorHandler from "../middleware/asyncErrorHandler";
import { promises as fs } from "fs";
import path from "path";
import { ApiResponse } from "../utils/ApiResponse";
import { ErrorHandler } from "../utils/ErrorHandler";
import { removeImageVariants } from "../services/image.service";
import { PRIVATE_FOLDER_NAME, PUBLIC_FOLDER_NAME } from "../constant";

export const deleteFile = asyncErrorHandler(async (req, res) => {
  const query = req.query;
  if (!query.url)
    throw new ErrorHandler(400, "url or pathname is needed as query parameter");

  const url = query.url.toLocaleString();

  // A private file is only ever addressed by its stored path, which starts with
  // the private folder name. Uploads to the public folder keep working exactly
  // as before, including when the caller passes a full url with the hostname.
  const isPrivate = url.replace(/^\/+/, "").startsWith(`${PRIVATE_FOLDER_NAME}/`);

  // Deleting a private file needs the same token that reads one — the public
  // folder is served to anyone, so nothing is gained by guarding it here, but a
  // private document must not be removable by a stranger with the path.
  if (isPrivate) {
    const token = (req.headers["authorization"] ?? "").toString().split(" ")[1];
    if (!token || token !== process.env.PRIVATE_FILE_ACCESS_TOKEN)
      throw new ErrorHandler(401, "Your are not able to access this resource");
  }

  const folderName = isPrivate ? PRIVATE_FOLDER_NAME : PUBLIC_FOLDER_NAME;
  const baseDir = path.resolve(__dirname, `../../${folderName}`);

  const hostname = process.env.HOST_NAME || "";
  const fileName = url
    .replace(`${hostname}/${folderName}/`, "")
    .replace(new RegExp(`^/*${folderName}/`), "");

  const deletePath = path.join(baseDir, fileName);

  if (!deletePath.startsWith(baseDir)) {
    throw new ErrorHandler(400, "Invalid file path");
  }

  // Drop the responsive variants first so they never outlive the original.
  // Private documents are pdfs and have none, so this is a no-op for them.
  const removedVariants = isPrivate
    ? []
    : await removeImageVariants(deletePath);

  await fs.unlink(deletePath);

  res.status(200).json(
    new ApiResponse(200, "File Removed From Server", {
      path: deletePath,
      removedVariants,
    })
  );
});
