import sharp from "sharp";
import path from "path";
import { promises as fs } from "fs";
import {
  IMAGE_VARIANT_QUALITY,
  IMAGE_VARIANT_SIZES,
  IMAGE_VARIANT_WIDTHS,
} from "../constant";
import { IImageVariant, IImageVariantResult } from "../types";

// Animated images and vectors are passed through untouched: resizing them here
// would either drop the animation or rasterise the vector.
const SKIPPED_MIME_TYPES = ["image/gif", "image/svg+xml", "image/avif"];

export const isResizableImage = (mimetype: string) =>
  mimetype.startsWith("image/") && !SKIPPED_MIME_TYPES.includes(mimetype);

/**
 * Builds the on-disk name of a variant: `banner-123456.png` -> `banner-123456-640w.webp`
 */
const variantFileName = (originalFileName: string, width: number) => {
  const ext = path.extname(originalFileName);
  const base = path.basename(originalFileName, ext);
  return `${base}-${width}w.webp`;
};

/**
 * Generates the webp variants for one uploaded image.
 *
 * `absoluteFilePath` is the file multer just wrote, `publicPath` is the url
 * prefix that same folder is served under (e.g. `/uploads/media-items`).
 *
 * Failures are swallowed on purpose - a broken variant should never fail the
 * upload itself, the caller falls back to the original file.
 */
export const generateImageVariants = async (
  absoluteFilePath: string,
  publicPath: string,
  mimetype: string
): Promise<IImageVariantResult> => {
  const empty: IImageVariantResult = { variants: [], srcset: "" };

  if (!isResizableImage(mimetype)) return empty;

  try {
    const fileName = path.basename(absoluteFilePath);
    const dir = path.dirname(absoluteFilePath);
    const image = sharp(absoluteFilePath, { failOn: "none" });
    const metadata = await image.metadata();

    const sourceWidth = metadata.width || 0;
    if (!sourceWidth) return empty;

    // Every breakpoint is written, upscaling where needed, so that a variant
    // URL derived by filename on the frontend is always there to be fetched.
    const targets = IMAGE_VARIANT_WIDTHS;

    const variants: IImageVariant[] = [];

    for (const width of targets) {
      const name = variantFileName(fileName, width);
      const outputPath = path.join(dir, name);

      const info = await image
        .clone()
        .rotate() // honours EXIF orientation before resizing
        .resize({ width }) // upscales when the source is narrower - see above
        .webp({ quality: IMAGE_VARIANT_QUALITY })
        .toFile(outputPath);

      variants.push({
        url: `${publicPath}/${name}`,
        pathname: `${publicPath.replace(/^\//, "")}/${name}`,
        width: info.width,
        height: info.height,
        size: info.size,
        contentType: "image/webp",
      });
    }

    return {
      variants,
      srcset: variants.map((v) => `${v.url} ${v.width}w`).join(", "),
      sizes: IMAGE_VARIANT_SIZES,
      width: sourceWidth,
      height: metadata.height,
    };
  } catch {
    return empty;
  }
};

/**
 * Removes every variant that belongs to an original file. Used by the delete
 * route so variants don't linger as orphans.
 */
export const removeImageVariants = async (absoluteFilePath: string) => {
  const ext = path.extname(absoluteFilePath);
  const base = path.basename(absoluteFilePath, ext);
  const dir = path.dirname(absoluteFilePath);

  let entries: string[] = [];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }

  const pattern = new RegExp(
    `^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-\\d+w\\.webp$`
  );

  const removed: string[] = [];
  for (const entry of entries) {
    if (!pattern.test(entry)) continue;
    try {
      await fs.unlink(path.join(dir, entry));
      removed.push(entry);
    } catch {
      // already gone, nothing to do
    }
  }

  return removed;
};
