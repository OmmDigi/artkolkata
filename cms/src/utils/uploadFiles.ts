import type { IResponse, IUploadedFile } from "@/types";
import axios, { AxiosError } from "axios";
import uploadApi from "./upload-api";

export type TUploadService = "serverbyt" | "custom" | "imagekit";

const SERVERBYT_UPLOAD_URL = import.meta.env.VITE_SERVERBYT_UPLOAD_URL;

// The php endpoint answers with paths relative to its own host, so they are
// resolved against the endpoint origin before being handed back.
const toAbsoluteUrl = (url: string) => {
  try {
    return new URL(url, SERVERBYT_UPLOAD_URL).toString();
  } catch {
    return url;
  }
};

interface IProps<E = AxiosError<IResponse>> {
  files: File[];
  folder: string;
  uploadService?: TUploadService;

  onUploading?: (percent: number) => void;
  onUploaded?: (result: IUploadedFile[]) => void;
  onError?: (error: E) => void;
  onUploadStart?: () => void;
}

export const uploadFiles = async ({
  files,
  folder,
  uploadService = "custom",
  onUploadStart,
  onUploaded,
  onUploading,
  onError,
}: IProps) => {
  let data: IUploadedFile[] = [];
  let error: AxiosError<IResponse> | null = null;

  const fileArray = Array.from(files);

  const formData = new FormData();

  formData.set("folder", folder);

  try {
    if (uploadService === "imagekit") {
      throw new AxiosError(
        "ImageKit upload service is not available yet",
        "ERR_UPLOAD_SERVICE_UNAVAILABLE"
      );
    }

    const isServerByt = uploadService === "serverbyt";

    for (const file of fileArray) {
      onUploadStart?.();
      formData.append(isServerByt ? "files[]" : "files", file);
    }

    const onUploadProgress = (progressEvent: {
      loaded: number;
      total?: number;
    }) => {
      const { loaded, total } = progressEvent;
      const percentCompleted = Math.round((loaded * 100) / (total || 0));
      onUploading?.(percentCompleted);
    };

    if (isServerByt) {
      // The php endpoint returns the uploaded files as a bare array.
      const response = await axios.post<IUploadedFile[]>(
        SERVERBYT_UPLOAD_URL,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress,
        }
      );

      data = (response.data ?? []).map((file) => ({
        ...file,
        url: toAbsoluteUrl(file.url),
        downloadUrl: toAbsoluteUrl(file.downloadUrl),
      }));
    } else {
      const response = await uploadApi.post<IResponse<IUploadedFile[]>>(
        "/api/v1/upload/multiple",
        formData,
        {
          onUploadProgress,
        }
      );

      data = response.data.data;
    }

    if (onUploaded) {
      onUploaded(data);
    }
  } catch (err) {
    error = err as AxiosError<IResponse>;
    onError?.(error);
  } finally {
    return { data, error };
  }
};
