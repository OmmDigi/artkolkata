import path from "path";
import fs from "fs";
import sharp from "sharp";
import asyncErrorHandler from "../middleware/asyncErrorHandler";
import { ErrorHandler } from "../utils/ErrorHandler";
import { ApiResponse } from "../utils/ApiResponse";
import { PRIVATE_FOLDER_NAME, PUBLIC_FOLDER_NAME } from "../constant";

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

/**
 * Serves a public image re-encoded as PNG: `/api/v1/view/png/site/logo.webp`.
 *
 * It exists for the pdf documents the api generates. Those are drawn by
 * react-pdf, which understands PNG and JPEG only, while an uploaded logo is
 * usually webp — the format this server itself prefers everywhere else. The
 * conversion belongs here rather than in the api because sharp already runs
 * here for the responsive variants.
 *
 * `?bg=RRGGBB` flattens the image onto that colour first. A logo drawn for a
 * dark site header is usually light lettering on transparency, which is
 * invisible on the white page of an invoice; the background it was designed for
 * has to be painted back in.
 *
 * The result is written next to the original as `<name>-png.png`
 * (`<name>-png-RRGGBB.png` when flattened) and reused, so a logo is converted
 * once and not on every invoice.
 */
export const viewPngVariant = asyncErrorHandler(async (req, res) => {
  const PUBLIC_DIR = path.join(__dirname, `../../${PUBLIC_FOLDER_NAME}`);

  const source = path.join(PUBLIC_DIR, req.params[0]);

  if (!source.startsWith(PUBLIC_DIR)) throw new ErrorHandler(400, "Invalid path");
  if (!fs.existsSync(source))
    throw new ErrorHandler(404, "No file exists at this path");

  const requestedBg = (req.query.bg ?? "").toString().replace(/^#/, "");
  const background = /^[0-9a-fA-F]{6}$/.test(requestedBg)
    ? requestedBg.toLowerCase()
    : null;

  const converted = path.join(
    path.dirname(source),
    `${path.basename(source, path.extname(source))}-png${
      background ? `-${background}` : ""
    }.png`
  );

  if (!fs.existsSync(converted)) {
    const pipeline = sharp(source);

    if (background) {
      pipeline.flatten({ background: `#${background}` });
    }

    await pipeline.png().toFile(converted);
  }

  res.type("png");
  res.sendFile(converted, (err) => {
    if (err) res.status(404).json(new ApiResponse(404, "File not found"));
  });
});
