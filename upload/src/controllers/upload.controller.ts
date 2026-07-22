import { Request, Response } from "express";
import asyncErrorHandler from "../middleware/asyncErrorHandler";
import { ErrorHandler } from "../utils/ErrorHandler";
import { ApiResponse } from "../utils/ApiResponse";
import { PRIVATE_FOLDER_NAME, PUBLIC_FOLDER_NAME } from "../constant";
import { IBlob } from "../types";
import { extractFolderName } from "../utils/extractFolderName";

export const uploadSingleFile = asyncErrorHandler(
  async (req: Request, res: Response) => {
    if (!req.file) throw new ErrorHandler(400, "No File For Upload");
    const userFolderName = extractFolderName(req.body.folder);

    const access = req.body.access || "public";
    // const proxy_endpoint = access === "private" ? req.body.proxy_endpoint : "";

    const pathName = `${
      access === "private" ? PRIVATE_FOLDER_NAME : PUBLIC_FOLDER_NAME
    }${userFolderName ? `/${userFolderName}` : ""}`;

    let download_url = "";

    if (access === "public") {
      download_url = `/${pathName}/${req.file.filename}`;
    } else {
      download_url = `/${pathName}/${req.file.filename}`;
    }

    const blobResult: IBlob = {
      url: download_url,
      contentDisposition: "",
      downloadUrl: download_url,
      pathname: `${pathName}/${req.file.filename}`,
      contentType: req.file.mimetype,
    };

    res
      .status(201)
      .json(new ApiResponse(201, "File uploaded successfully!", blobResult));
  }
);

export const uploadMultipleFile = asyncErrorHandler(async (req, res) => {
  if (!req.files) throw new ErrorHandler(400, "No Files For Upload");

  const userFolderName = extractFolderName(req.body.folder);
  const access = req.body.access || "public";

  const pathName = `${
    access === "private" ? PRIVATE_FOLDER_NAME : PUBLIC_FOLDER_NAME
  }${userFolderName ? `/${userFolderName}` : ""}`;

  const blobResult: IBlob[] = [];

  if (req.files.length === 0) throw new ErrorHandler(400, "No file for upload");

  if (Array.isArray(req.files)) {
    req.files.forEach((file) => {
      let download_url = "";

      if (access === "public") {
        download_url = `/${pathName}/${file.filename}`;
      } else {
        download_url = `/${pathName}/${file.filename}`;
      }

      blobResult.push({
        url: download_url,
        contentDisposition: "",
        downloadUrl: download_url,
        pathname: `${pathName}/${file.filename}`,
        contentType: file.mimetype,
      });
    });
  }

  res
    .status(201)
    .json(new ApiResponse(201, "Files are uploaded successfully!", blobResult));
});
