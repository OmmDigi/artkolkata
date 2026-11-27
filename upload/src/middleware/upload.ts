import multer from "multer";
import path from "path";
import fs from "fs";
import { Request, RequestHandler } from "express";
import { ErrorHandler } from "../utils/ErrorHandler";
import { PRIVATE_FOLDER_NAME, PUBLIC_FOLDER_NAME } from "../constant";
import { extractFolderName } from "../utils/extractFolderName";

const storage = multer.diskStorage({
  destination: (req: Request, file, cb) => {
    if (!req.body.folder) {
      cb(
        new ErrorHandler(400, "Folder name is required ex : /images") as any,
        ""
      );
      return;
    }

    const folder = extractFolderName(req.body.folder || "/any"); // user passed folder name
    const access = req.body.access || "public";

    const UPLOADING_FOLDER_NAME =
      access === "private" ? PRIVATE_FOLDER_NAME : PUBLIC_FOLDER_NAME;
    const BASE_UPLOAD_DIR = path.join(
      __dirname,
      `../../${UPLOADING_FOLDER_NAME}`
    );

    const uploadPath = path.join(BASE_UPLOAD_DIR, folder);

    if (!uploadPath.includes(UPLOADING_FOLDER_NAME)) {
      cb(new ErrorHandler(400, "Please use a normal folder name") as any, "");
      return;
    }

    // Create the folder if it doesn't exist
    fs.mkdirSync(uploadPath, { recursive: true });

    cb(null, uploadPath);
  },
  filename: (_, file, cb) => {
    // const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    // const ext = path.extname(file.originalname);
    // cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    const fileName = path.basename(file.originalname, ext);
    cb(null, `${fileName}-${uniqueSuffix}${ext}`);
  },
});

const fileFilter: multer.Options["fileFilter"] = (req, file, cb) => {
  if (
    file.mimetype.startsWith("image/") ||
    file.mimetype === "application/pdf"
  ) {
    cb(null, true);
  } else {
    cb(new ErrorHandler(400, "Unsupported File") as any);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 300 * 1024 * 1024, // 200MB
  },
});

/**
 * Videos for the CMS Videos tab. They get their own route and their own limit
 * so that raising the ceiling for video does not raise it for every image
 * upload too. nginx allows a large body on the video route only, so the
 * two limits need to change together.
 */
export const MAX_VIDEO_SIZE_MB = 100;

const VIDEO_MIME_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

const videoUpload = multer({
  storage,
  fileFilter: (_, file, cb) => {
    if (VIDEO_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new ErrorHandler(400, "Only MP4, WebM or MOV videos can be uploaded") as any
      );
    }
  },
  limits: {
    fileSize: MAX_VIDEO_SIZE_MB * 1024 * 1024,
    files: 1,
  },
});

/** single "file" field, with multer's too-large error turned into a readable one */
export const uploadSingleVideo: RequestHandler = (req, res, next) => {
  videoUpload.single("file")(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return next(
        new ErrorHandler(413, `Video must be ${MAX_VIDEO_SIZE_MB} MB or smaller`)
      );
    }
    next(err);
  });
};
