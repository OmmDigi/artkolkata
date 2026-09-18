import { Request, Response } from "express";
import asyncErrorHandler from "../middleware/asyncErrorHandler";
import { ErrorHandler } from "../utils/ErrorHandler";
import { ApiResponse } from "../utils/ApiResponse";
import { PRIVATE_FOLDER_NAME, PUBLIC_FOLDER_NAME } from "../constant";
import { IBlob } from "../types";
import { extractFolderName } from "../utils/extractFolderName";
import { generateImageVariants } from "../services/image.service";

/**
 * Resolves the url prefix the uploaded files are served under, e.g.
 * `uploads/media-items`.
 */
const resolvePathName = (req: Request) => {
  const userFolderName = extractFolderName(req.body.folder);
  const access = req.body.access || "public";

  return `${
    access === "private" ? PRIVATE_FOLDER_NAME : PUBLIC_FOLDER_NAME
  }${userFolderName ? `/${userFolderName}` : ""}`;
};

/**
 * Turns a stored multer file into the blob payload, generating the responsive
 * webp variants along the way. The original file is always kept and returned as
 * `url`, so clients that ignore `srcset` keep working unchanged.
 */
const toBlob = async (
  file: Express.Multer.File,
  pathName: string
): Promise<IBlob> => {
  const download_url = `/${pathName}/${file.filename}`;

  const { variants, srcset, sizes, width, height } =
    await generateImageVariants(file.path, `/${pathName}`, file.mimetype);

  return {
    url: download_url,
    contentDisposition: "",
    downloadUrl: download_url,
    pathname: `${pathName}/${file.filename}`,
    contentType: file.mimetype,
    ...(srcset ? { srcset, sizes, width, height, variants } : {}),
  };
};

export const uploadSingleFile = asyncErrorHandler(
  async (req: Request, res: Response) => {
    if (!req.file) throw new ErrorHandler(400, "No File For Upload");

    const blobResult = await toBlob(req.file, resolvePathName(req));

    res
      .status(201)
      .json(new ApiResponse(201, "File uploaded successfully!", blobResult));
  }
);

export const uploadMultipleFile = asyncErrorHandler(async (req, res) => {
  if (!req.files) throw new ErrorHandler(400, "No Files For Upload");
  if (!Array.isArray(req.files) || req.files.length === 0)
    throw new ErrorHandler(400, "No file for upload");

  const pathName = resolvePathName(req);

  // Variants are generated in parallel; sharp releases the event loop while it
  // works so a batch of 10 images is bound by CPU, not by the loop.
  const blobResult: IBlob[] = await Promise.all(
    req.files.map((file) => toBlob(file, pathName))
  );

  res
    .status(201)
    .json(new ApiResponse(201, "Files are uploaded successfully!", blobResult));
});
