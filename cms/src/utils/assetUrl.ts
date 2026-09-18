import type { IUploadedFile } from "@/types";

/**
 * assets can also come from an outside source, the CMS only needs a usable link.
 * absolute http(s) links and site relative paths are both accepted.
 */
export const isAssetUrl = (value: string) => {
  const link = value.trim();
  return /^https?:\/\/\S+$/i.test(link) || /^\/\S+$/.test(link);
};

/** shapes a pasted link like an upload result so the existing handlers keep working */
export const asUploadedFile = (value: string): IUploadedFile => {
  const link = value.trim();
  return {
    url: link,
    downloadUrl: link,
    pathname: link,
    contentDisposition: "",
  };
};
