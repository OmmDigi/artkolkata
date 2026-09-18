export const PUBLIC_FOLDER_NAME = "uploads";
export const PRIVATE_FOLDER_NAME = "private";

/**
 * Breakpoints the responsive variants are generated for.
 *
 * EVERY width is always written, upscaling the source when it is smaller than
 * the target. That wastes some bytes on small uploads, but it is what lets the
 * frontend derive variant URLs by filename and request them without first
 * checking whether they exist - a srcset candidate that 404s breaks the image,
 * because the browser does not fall back to another candidate.
 */
export const IMAGE_VARIANT_WIDTHS = [320, 640, 1024, 1920];

/** Quality passed to sharp when re-encoding a variant to webp. */
export const IMAGE_VARIANT_QUALITY = 78;

/**
 * Default `sizes` attribute shipped with every srcset so the browser can pick a
 * candidate before layout. Consumers are free to override it.
 */
export const IMAGE_VARIANT_SIZES =
  "(max-width: 320px) 320px, (max-width: 640px) 640px, (max-width: 1024px) 1024px, 1920px";
