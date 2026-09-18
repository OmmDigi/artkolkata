export interface IError extends Error {
  code?: number;
  message: string;
  statusCode: number;
  isOperational: boolean;
  key?: string;
}

export interface IImageVariant {
  url: string;
  pathname: string;
  width: number;
  height: number;
  size: number;
  contentType: string;
}

export interface IImageVariantResult {
  variants: IImageVariant[];
  /** Ready to drop into an <img srcset> / <source srcset> attribute. */
  srcset: string;
  sizes?: string;
  /** Intrinsic dimensions of the original, useful to reserve layout space. */
  width?: number;
  height?: number;
}

export interface IBlob {
  url: string;
  downloadUrl: string;
  pathname: string;
  contentType?: string;
  contentDisposition: string;
  srcset?: string;
  sizes?: string;
  width?: number;
  height?: number;
  variants?: IImageVariant[];
}
