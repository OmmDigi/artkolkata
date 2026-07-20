import type { IResponse, IUploadedFile } from "@/types";
import { AxiosError } from "axios";
import imageCompression from "browser-image-compression";
import uploadApi from "./upload-api";

interface IProps<E = AxiosError<IResponse>> {
  files: File[];
  folder: string;

  onUploading?: (percent: number) => void;
  onUploaded?: (result: IUploadedFile[]) => void;
  onError?: (error: E) => void;
  onUploadStart?: () => void;

  convartToWebp?: boolean;
}

export const uploadFiles = async ({
  files,
  folder,
  onUploadStart,
  onUploaded,
  onUploading,
  // convartToWebp = false,
  onError,
}: IProps) => {
  let data: IUploadedFile[] = [];
  let error: AxiosError<IResponse> | null = null;

  const fileArray = Array.from(files);

  const formData = new FormData();

  formData.set("folder", folder);

  try {
    // compress the image if it's an image file
    for (const file of fileArray) {
      onUploadStart?.();

      if (!file.type.startsWith("image/")) {
        console.warn(`Skipping non-image file: ${file.name}`);
        formData.append("files", file);
        continue;
      }

      // Compress and convert to WebP
      const compressedFile = await imageCompression(file, {
        maxSizeMB: 0.7,
        maxWidthOrHeight: 1280,
        useWebWorker: true,
        fileType: "image/webp" as const,
      });

      // Ensure it's WebP format
      const webpFile = new File(
        [compressedFile],
        file.name.replace(/\.[^/.]+$/, ".webp"),
        { type: "image/webp" }
      );

      formData.append("files", webpFile);
    }
    const response = await uploadApi.post<IResponse<IUploadedFile[]>>(
      "/api/v1/upload/multiple",
      formData,
      {
        onUploadProgress(progressEvent) {
          const { loaded, total } = progressEvent;
          const percentCompleted = Math.round((loaded * 100) / (total || 0));
          onUploading?.(percentCompleted);
        },
      }
    );

    if (onUploaded) {
      onUploaded(response.data.data);
    }

    data = response.data.data;
  } catch (error) {
    error = error as AxiosError<IResponse>;
    onError?.(error as AxiosError<IResponse>);
  } finally {
    return { data, error };
  }
};
