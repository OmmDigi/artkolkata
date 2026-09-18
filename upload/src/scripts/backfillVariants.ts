/**
 * Generates the responsive webp variants for images that were uploaded before
 * variant generation existed.
 *
 * The frontend derives variant URLs by filename and requests them without
 * checking, so every original already on disk needs its full set or those
 * requests 404 and the image breaks.
 *
 * Usage:
 *   npx ts-node src/scripts/backfillVariants.ts [--dry] [--force] [dir]
 *
 *   --dry     report what would be written, write nothing
 *   --force   rewrite variants that already exist
 *   dir       limit to one folder under uploads/ (e.g. banners)
 */

import path from "path";
import { promises as fs } from "fs";
import sharp, { Sharp } from "sharp";
import {
  IMAGE_VARIANT_QUALITY,
  IMAGE_VARIANT_WIDTHS,
  PUBLIC_FOLDER_NAME,
} from "../constant";

const SKIPPED_EXTENSIONS = [".gif", ".svg", ".avif"];

// A variant is itself an image in the same folder; without this the script
// would generate variants of variants on every run.
const VARIANT_PATTERN = /-\d+w\.webp$/;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry");
const force = args.includes("--force");
const subDir = args.find((a) => !a.startsWith("--"));

const isCandidate = (fileName: string) => {
  const ext = path.extname(fileName).toLowerCase();
  if (!ext || SKIPPED_EXTENSIONS.includes(ext)) return false;
  if (VARIANT_PATTERN.test(fileName)) return false;
  return [".png", ".jpg", ".jpeg", ".webp", ".tiff", ".bmp"].includes(ext);
};

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

const exists = async (p: string) =>
  fs
    .access(p)
    .then(() => true)
    .catch(() => false);

async function main() {
  const root = path.resolve(
    __dirname,
    `../../${PUBLIC_FOLDER_NAME}`,
    subDir || ""
  );

  console.log(`Backfilling variants under ${root}`);
  if (dryRun) console.log("(dry run - nothing will be written)\n");

  let scanned = 0;
  let written = 0;
  let skipped = 0;
  let failed = 0;

  for await (const file of walk(root)) {
    const fileName = path.basename(file);
    if (!isCandidate(fileName)) continue;
    scanned++;

    const dir = path.dirname(file);
    const ext = path.extname(fileName);
    const base = path.basename(fileName, ext);

    let image: Sharp;
    try {
      image = sharp(file, { failOn: "none" });
      await image.metadata();
    } catch {
      failed++;
      console.warn(`  unreadable, skipped: ${path.relative(root, file)}`);
      continue;
    }

    for (const width of IMAGE_VARIANT_WIDTHS) {
      const outputPath = path.join(dir, `${base}-${width}w.webp`);

      if (!force && (await exists(outputPath))) {
        skipped++;
        continue;
      }
      if (dryRun) {
        written++;
        continue;
      }

      try {
        await image
          .clone()
          .rotate()
          .resize({ width })
          .webp({ quality: IMAGE_VARIANT_QUALITY })
          .toFile(outputPath);
        written++;
      } catch (error) {
        failed++;
        console.warn(`  failed ${path.relative(root, outputPath)}: ${error}`);
      }
    }

    if (scanned % 50 === 0) console.log(`  ...${scanned} originals scanned`);
  }

  console.log(
    `\nDone. originals=${scanned} variants ${
      dryRun ? "to write" : "written"
    }=${written} already-present=${skipped} failed=${failed}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
