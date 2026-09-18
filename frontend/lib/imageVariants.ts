/**
 * Derives the responsive variant URLs the upload server writes next to every
 * original: `/uploads/banners/x-1787.png` -> `/uploads/banners/x-1787-320w.webp`.
 *
 * Nothing is probed before use, so the upload server must write EVERY width for
 * every image (it upscales small sources to guarantee that, and
 * `npm run backfill:variants` covers images uploaded before that rule existed).
 * A srcset candidate that 404s breaks the image outright - the browser does not
 * fall back to another candidate - so the checks below are deliberately strict:
 * anything we are not certain about gets no srcset and simply loads the
 * original, exactly as before.
 */

const UPLOAD_BASE = process.env.NEXT_PUBLIC_UPLOAD_API_BASE_URL || "";

/** Must stay in sync with IMAGE_VARIANT_WIDTHS in the upload server. */
export const VARIANT_WIDTHS = [320, 640, 1024, 1920];

// Formats the upload server re-encodes. gif/svg/avif are passed through
// untouched there, so they have no variants to point at.
const DERIVABLE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".tiff", ".bmp"];

// Guards against deriving a variant of a variant (`x-320w-320w.webp`).
const ALREADY_A_VARIANT = /-\d+w\.webp$/i;

const uploadOrigin = (() => {
  try {
    return UPLOAD_BASE ? new URL(UPLOAD_BASE).origin : "";
  } catch {
    return "";
  }
})();

/**
 * Returns a srcset string, or null when this URL is not one we can derive from:
 * an external host (YouTube and Pinterest video thumbnails), a private file, a
 * format with no variants, or an already-derived variant URL.
 */
export function buildVariantSrcSet(
  src: string,
  /** Appended to every candidate so a retry is a genuinely new request. */
  retryKey?: string,
): string | null {
  if (!src || !uploadOrigin) return null;

  let url: URL;
  try {
    url = new URL(src, uploadOrigin);
  } catch {
    return null;
  }

  // Only images this upload server serves; never an external host.
  if (url.origin !== uploadOrigin) return null;

  // Public uploads only - `/private/...` is access-checked and has no variants.
  if (!url.pathname.startsWith("/uploads/")) return null;

  const slash = url.pathname.lastIndexOf("/");
  const fileName = url.pathname.slice(slash + 1);
  const dir = url.pathname.slice(0, slash);

  if (ALREADY_A_VARIANT.test(fileName)) return null;

  const dot = fileName.lastIndexOf(".");
  if (dot <= 0) return null;
  if (!DERIVABLE_EXTENSIONS.includes(fileName.slice(dot).toLowerCase())) {
    return null;
  }

  const base = fileName.slice(0, dot);
  // Relative in, relative out: keeps whatever origin the caller resolved.
  const prefix = src.startsWith("http") || src.startsWith("//")
    ? `${url.origin}${dir}`
    : dir;

  return VARIANT_WIDTHS.map(
    (width) =>
      `${prefix}/${base}-${width}w.webp${retryKey ? `?${retryKey}` : ""} ${width}w`,
  ).join(", ");
}
