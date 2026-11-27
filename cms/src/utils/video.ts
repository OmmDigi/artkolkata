import type { IResponse, IUploadedFile, TVideoSource } from "@/types";
import uploadApi from "./upload-api";
import { uploadFiles } from "./uploadFiles";

/**
 * Keep in step with MAX_VIDEO_SIZE_MB in upload/src/middleware/upload.ts and
 * the /api/v1/upload/video body limit in nginx. Checking here as well means a
 * file that is too big is refused before any of it is sent.
 */
export const MAX_VIDEO_SIZE_MB = 100;

export const VIDEO_ACCEPT = "video/mp4,video/webm,video/quicktime";
const VIDEO_MIME_TYPES = VIDEO_ACCEPT.split(",");

// both under uploads/videos/, the only folder the api deletes video files from
export const VIDEO_FOLDER = "/videos";
export const VIDEO_THUMBNAIL_FOLDER = "/videos/thumbnails";

const YOUTUBE_ID =
  /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([\w-]{11})(?![\w-])/i;

/** the 11 character id from a watch, youtu.be, shorts, live or embed link */
export const extractYouTubeId = (url: string): string | null =>
  url.match(YOUTUBE_ID)?.[1] ?? null;

export const youTubeEmbedUrl = (id: string) =>
  `https://www.youtube-nocookie.com/embed/${id}`;

/**
 * maxresdefault is the sharpest thumbnail, but only HD uploads have one. For
 * the rest YouTube answers with a 120x90 grey placeholder, so anything that
 * small means "not there" and hqdefault, which every video has, is used.
 */
export const fetchYouTubeThumbnail = (id: string): Promise<string> => {
  const maxres = `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
  const fallback = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image.naturalWidth > 120 ? maxres : fallback);
    image.onerror = () => resolve(fallback);
    image.src = maxres;
  });
};

// frames grabbed by captureVideoFrame are uploaded under this name, which is
// how a saved thumbnail is later told apart from one the admin picked
const AUTO_THUMBNAIL_SUFFIX = "-auto-thumbnail";

/**
 * Whether a saved thumbnail is the automatic one, so replacing the video
 * should also replace it. Anything else was chosen by hand and is kept.
 */
export const isAutoThumbnail = (
  url: string | null | undefined,
  source: TVideoSource,
  youtubeId: string | null,
) => {
  if (!url) return true;
  if (source === "youtube") {
    return youtubeId !== null && /(?:img\.youtube\.com|i\.ytimg\.com)\/vi\//.test(url) && url.includes(`/vi/${youtubeId}/`);
  }
  // the upload server appends "-<timestamp>-<random>" to the file name
  return url.includes(`${AUTO_THUMBNAIL_SUFFIX}-`);
};

/** checks a picked file before any of it is sent, returns the problem or null */
export const checkVideoFile = (file: File): string | null => {
  if (!VIDEO_MIME_TYPES.includes(file.type)) {
    return "Pick an MP4, WebM or MOV video file";
  }
  if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
    const sizeMb = (file.size / 1024 / 1024).toFixed(1);
    return `This video is ${sizeMb} MB, the limit is ${MAX_VIDEO_SIZE_MB} MB. Compress it and try again.`;
  }
  return null;
};

export const uploadVideoFile = async ({
  file,
  signal,
  onUploading,
}: {
  file: File;
  signal?: AbortSignal;
  onUploading?: (percent: number) => void;
}) => {
  const formData = new FormData();
  // the folder has to come before the file: multer reads it to pick where
  // the file is written, and fields are read in the order they were added
  formData.set("folder", VIDEO_FOLDER);
  formData.append("file", file);

  const response = await uploadApi.post<IResponse<IUploadedFile>>(
    "/api/v1/upload/video",
    formData,
    {
      signal,
      onUploadProgress: ({ loaded, total }) =>
        onUploading?.(Math.round((loaded * 100) / (total || file.size))),
    },
  );

  return response.data.data;
};

// wide enough for any storefront poster, small enough to stay under the image upload limit
const MAX_THUMBNAIL_WIDTH = 1280;

const safeBaseName = (name: string) =>
  name
    .replace(/\.[^.]+$/, "")
    .replace(/[^\w-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "video";

/**
 * Grabs one frame from a video as a JPEG, entirely in the browser. The source
 * is the picked File (no download needed) or a stored video's path.
 */
export const captureVideoFrame = (source: File | string, name = "video") =>
  new Promise<File>((resolve, reject) => {
    const objectUrl =
      typeof source === "string" ? null : URL.createObjectURL(source);
    const video = document.createElement("video");
    let settled = false;

    const finish = (result: File | Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      video.removeAttribute("src");
      video.load();
      if (result instanceof Error) reject(result);
      else resolve(result);
    };

    const timer = window.setTimeout(
      () => finish(new Error("Reading the video took too long")),
      20000,
    );

    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    // a stored video is read back over http, and without this a video from
    // another origin taints the canvas so the frame can't be exported
    if (typeof source === "string") video.crossOrigin = "anonymous";

    video.onerror = () =>
      finish(new Error("This browser can't play this video to grab a frame"));

    video.onloadedmetadata = () => {
      const { duration } = video;
      // a moment in, the very first frame is often a black fade in
      video.currentTime =
        Number.isFinite(duration) && duration > 0
          ? Math.min(1, duration / 4)
          : 0.1;
    };

    video.onseeked = () => {
      const scale = Math.min(1, MAX_THUMBNAIL_WIDTH / (video.videoWidth || 1));
      const width = Math.round(video.videoWidth * scale);
      const height = Math.round(video.videoHeight * scale);
      if (!width || !height) {
        finish(new Error("This video has no picture to grab a frame from"));
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        finish(new Error("This browser can't draw the video frame"));
        return;
      }

      try {
        context.drawImage(video, 0, 0, width, height);
        canvas.toBlob(
          (blob) =>
            finish(
              blob
                ? new File(
                    [blob],
                    `${safeBaseName(name)}${AUTO_THUMBNAIL_SUFFIX}.jpg`,
                    { type: "image/jpeg" },
                  )
                : new Error("Could not create the thumbnail image"),
            ),
          "image/jpeg",
          0.85,
        );
      } catch {
        finish(new Error("The video's server doesn't allow grabbing a frame"));
      }
    };

    video.src = objectUrl ?? (source as string);
  });

/** grabs a frame and uploads it, resolving to the thumbnail's url */
export const createVideoThumbnail = async (
  source: File | string,
  name?: string,
) => {
  const frame = await captureVideoFrame(source, name);

  let uploadError: string | null = null;
  const { data } = await uploadFiles({
    files: [frame],
    folder: VIDEO_THUMBNAIL_FOLDER,
    onError: (err) => {
      uploadError = err.response?.data?.message ?? err.message;
    },
  });

  if (uploadError || data.length === 0) {
    throw new Error(uploadError ?? "Could not upload the thumbnail");
  }

  return data[0].downloadUrl;
};
