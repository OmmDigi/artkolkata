const imageBaseUrl = process.env.NEXT_PUBLIC_UPLOAD_API_BASE_URL || ""

/**
 * The single place an upload path is turned into a URL. Call sites pass raw
 * API values, which are often missing or already absolute, so both are handled
 * here rather than at every <CustomImage>.
 */
export const processImageUrl = (url?: string | null) => {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("//")) return url;
  if (!imageBaseUrl) return url;

  const base = imageBaseUrl.replace(/\/+$/, "");
  const path = url.replace(/^\/+/, "");
  return `${base}/${path}`;
};
