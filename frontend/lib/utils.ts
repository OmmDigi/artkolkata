const imageBaseUrl = process.env.NEXT_PUBLIC_UPLOAD_API_BASE_URL || "";
export const processImageUrl = (url: string) => {
  if (url.startsWith("https") || url.startsWith("http")) return url;
  return `${imageBaseUrl}${url}`;
};
