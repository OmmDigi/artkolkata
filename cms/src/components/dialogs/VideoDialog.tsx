import FilePicker from "@/components/FilePicker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { IResponse, IVideo, TVideoInput, TVideoSource } from "@/types";
import {
  checkVideoFile,
  createVideoThumbnail,
  extractYouTubeId,
  fetchYouTubeThumbnail,
  isAutoThumbnail,
  MAX_VIDEO_SIZE_MB,
  uploadVideoFile,
  VIDEO_ACCEPT,
  VIDEO_THUMBNAIL_FOLDER,
  youTubeEmbedUrl,
} from "@/utils/video";
import axios, { AxiosError } from "axios";
import { Link2, Loader2, RotateCcw, Upload, Video } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";

const TITLE_MAX = 150;
const DESCRIPTION_MAX = 500;

interface IFormState {
  title: string;
  description: string;
  source_type: TVideoSource;
  /** kept apart so switching source and back does not lose what was entered */
  uploadUrl: string;
  youtubeLink: string;
  thumbnail_url: string;
  /** picked by hand, so a new video or source never replaces it */
  thumbIsCustom: boolean;
  is_primary: boolean;
  is_active: boolean;
}

const EMPTY_FORM: IFormState = {
  title: "",
  description: "",
  source_type: "upload",
  uploadUrl: "",
  youtubeLink: "",
  thumbnail_url: "",
  thumbIsCustom: false,
  is_primary: false,
  is_active: true,
};

const toFormState = (video: IVideo): IFormState => ({
  title: video.title,
  description: video.description ?? "",
  source_type: video.source_type,
  uploadUrl: video.source_type === "upload" ? video.video_url : "",
  youtubeLink: video.source_type === "youtube" ? video.video_url : "",
  thumbnail_url: video.thumbnail_url ?? "",
  thumbIsCustom: !isAutoThumbnail(
    video.thumbnail_url,
    video.source_type,
    video.youtube_id,
  ),
  is_primary: video.is_primary,
  is_active: video.is_active,
});

interface IProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null adds a new video */
  video: IVideo | null;
  /** the video that is primary right now, to say what marking this one changes */
  currentPrimary: IVideo | null;
  isSaving: boolean;
  /** onSuccess closes the dialog, call it once the server has saved */
  onSave: (data: TVideoInput, onSuccess: () => void) => void;
}

export default function VideoDialog({
  open,
  onOpenChange,
  video,
  currentPrimary,
  isSaving,
  onSave,
}: IProps) {
  const [form, setForm] = useState<IFormState>(EMPTY_FORM);
  // async work (uploads, frame grabs) reads the latest form through this
  const formRef = useRef(form);
  formRef.current = form;

  const update = (patch: Partial<IFormState>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  const videoInputRef = useRef<HTMLInputElement>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  // the picked file, so a frame can be grabbed without downloading it again
  const localFileRef = useRef<File | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  const [isThumbBusy, setIsThumbBusy] = useState(false);
  // bumped whenever the thumbnail is set by hand, so a frame grab that
  // finishes afterwards knows it is stale and must not overwrite it
  const thumbJobRef = useRef(0);

  const isUploading = uploadProgress !== null;
  const youtubeId = extractYouTubeId(form.youtubeLink);

  // the object url is tracked in a ref too, so it can still be revoked on unmount
  const previewRef = useRef<string | null>(null);
  const setPreview = (url: string | null) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = url;
    setLocalPreview(url);
  };

  useEffect(() => {
    if (!open) return;
    setForm(video ? toFormState(video) : EMPTY_FORM);
    localFileRef.current = null;
    setPreview(null);
    setUploadProgress(null);
    setIsThumbBusy(false);
    thumbJobRef.current++;
  }, [open, video]);

  // drop the local preview when the dialog goes away for good
  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );

  // YouTube serves its own thumbnail, so it is fetched as soon as the link
  // is recognised. Nothing is uploaded, so running again is harmless.
  useEffect(() => {
    if (!open || form.source_type !== "youtube" || form.thumbIsCustom) return;
    if (!youtubeId) return;

    let cancelled = false;
    fetchYouTubeThumbnail(youtubeId).then((url) => {
      if (!cancelled && !formRef.current.thumbIsCustom) {
        update({ thumbnail_url: url });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, youtubeId, form.source_type, form.thumbIsCustom]);

  /** grabs a frame from an uploaded video and makes it the thumbnail */
  const generateFrameThumbnail = async (source: File | string, name?: string) => {
    const job = ++thumbJobRef.current;
    setIsThumbBusy(true);
    try {
      const url = await createVideoThumbnail(source, name);
      if (job !== thumbJobRef.current) return;
      update({ thumbnail_url: url, thumbIsCustom: false });
    } catch (err) {
      if (job !== thumbJobRef.current) return;
      toast.error(
        `${(err as Error).message}. Please upload a thumbnail image instead.`,
      );
    } finally {
      if (job === thumbJobRef.current) setIsThumbBusy(false);
    }
  };

  /** goes back to the automatic thumbnail for whichever source is selected */
  const resetToAutoThumbnail = (source_type = formRef.current.source_type) => {
    const current = formRef.current;
    const job = ++thumbJobRef.current;
    setIsThumbBusy(false);
    update({ thumbnail_url: "", thumbIsCustom: false });

    if (source_type === "youtube") {
      const id = extractYouTubeId(current.youtubeLink);
      if (!id) return;
      fetchYouTubeThumbnail(id).then((url) => {
        if (job === thumbJobRef.current) update({ thumbnail_url: url });
      });
      return;
    }

    const source = localFileRef.current ?? (current.uploadUrl || null);
    if (source) generateFrameThumbnail(source, localFileRef.current?.name);
  };

  const switchSource = (source_type: TVideoSource) => {
    if (source_type === form.source_type) return;
    update({ source_type });
    // an automatic thumbnail belongs to the old source, a custom one stays
    if (!form.thumbIsCustom) resetToAutoThumbnail(source_type);
  };

  const handleVideoPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    // the same file must stay pickable after a failed or cancelled upload
    e.currentTarget.value = "";
    if (!file) return;

    const problem = checkVideoFile(file);
    if (problem) {
      toast.error(problem);
      return;
    }

    const previousFile = localFileRef.current;
    localFileRef.current = file;
    setPreview(URL.createObjectURL(file));

    const controller = new AbortController();
    uploadAbortRef.current = controller;
    setUploadProgress(0);

    try {
      const uploaded = await uploadVideoFile({
        file,
        signal: controller.signal,
        onUploading: setUploadProgress,
      });
      update({ uploadUrl: uploaded.downloadUrl });

      if (!formRef.current.thumbIsCustom) generateFrameThumbnail(file, file.name);
    } catch (err) {
      localFileRef.current = previousFile;
      setPreview(null);

      if (axios.isCancel(err)) {
        toast.info("Video upload cancelled");
      } else {
        const error = err as AxiosError<IResponse>;
        toast.error(
          error.response?.data?.message ??
            (error.response?.status === 413
              ? `Video must be ${MAX_VIDEO_SIZE_MB} MB or smaller`
              : error.message),
        );
      }
    } finally {
      uploadAbortRef.current = null;
      setUploadProgress(null);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && isUploading) {
      if (!confirm("A video is still uploading. Close and cancel the upload?"))
        return;
      uploadAbortRef.current?.abort();
    }
    onOpenChange(next);
  };

  const handleSave = () => {
    const title = form.title.trim();
    if (title === "") {
      toast.error("Give the video a title");
      return;
    }

    const video_url =
      form.source_type === "upload" ? form.uploadUrl : form.youtubeLink.trim();

    if (form.source_type === "upload" && video_url === "") {
      toast.error("Upload a video file first");
      return;
    }
    if (form.source_type === "youtube" && !youtubeId) {
      toast.error("Paste a valid YouTube video link");
      return;
    }
    // YouTube always has one; for an upload it is the only picture the website gets
    if (form.source_type === "upload" && form.thumbnail_url.trim() === "") {
      toast.error("Add a thumbnail image for this video");
      return;
    }

    onSave(
      {
        title,
        description: form.description.trim() || null,
        source_type: form.source_type,
        video_url,
        thumbnail_url: form.thumbnail_url.trim() || null,
        is_primary: form.is_primary,
        // the primary video is always shown
        is_active: form.is_primary ? true : form.is_active,
      },
      () => onOpenChange(false),
    );
  };

  const uploadedSrc = localPreview ?? (form.uploadUrl || null);
  const primaryElsewhere =
    currentPrimary && currentPrimary.id !== video?.id ? currentPrimary : null;

  const sourceOptions = [
    { value: "upload", label: "Upload", icon: Upload },
    { value: "youtube", label: "YouTube", icon: Link2 },
  ] as const;

  const thumbStatus = isThumbBusy
    ? "Grabbing a frame…"
    : form.thumbnail_url === ""
      ? ""
      : form.thumbIsCustom
        ? "Custom"
        : "Automatic";

  const youtubeLinkInvalid = !youtubeId && form.youtubeLink.trim() !== "";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* the header and the buttons stay put and only the middle scrolls, so
          Save is on screen however short the window is */}
      <DialogContent className="sm:max-w-3xl max-h-[92vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3 border-b">
          <DialogTitle>{video ? "Edit video" : "Add video"}</DialogTitle>
          <DialogDescription className="sr-only">
            Upload a video from this device or paste a YouTube link, then add a
            title and a short description.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-5">
          <div className="grid md:grid-cols-2 gap-5">
            {/* video */}
            <div className="space-y-2 min-w-0">
              <div className="flex items-center justify-between gap-2 min-h-7">
                <Label className="font-semibold">Video</Label>
                <div className="inline-flex rounded-md border p-0.5 gap-0.5 bg-gray-50">
                  {sourceOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      disabled={isUploading}
                      onClick={() => switchSource(option.value)}
                      className={cn(
                        "flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50",
                        form.source_type === option.value
                          ? "bg-green-600 text-white"
                          : "text-gray-700 hover:bg-white",
                      )}
                    >
                      <option.icon size={14} />
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {form.source_type === "upload" ? (
                <>
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept={VIDEO_ACCEPT}
                    className="hidden"
                    onChange={handleVideoPicked}
                  />

                  {uploadedSrc ? (
                    <div className="relative">
                      <video
                        key={uploadedSrc}
                        src={uploadedSrc}
                        controls
                        preload="metadata"
                        className="w-full h-36 rounded-lg bg-black object-contain"
                      />
                      {isUploading ? (
                        <div className="absolute inset-0 rounded-lg bg-black/60 flex flex-col items-center justify-center gap-1.5 text-white">
                          <Progress value={uploadProgress} className="w-2/3" />
                          <span className="text-xs">
                            Uploading {uploadProgress}%
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-black"
                            onClick={() => uploadAbortRef.current?.abort()}
                          >
                            Cancel upload
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => videoInputRef.current?.click()}
                      className="w-full h-36 rounded-lg border border-dashed border-gray-700 bg-white flex flex-col items-center justify-center gap-1 text-gray-600 cursor-pointer hover:bg-gray-50"
                    >
                      <Video size={24} />
                      <span className="font-semibold text-sm">
                        Choose a video
                      </span>
                      <span className="text-xs text-gray-500">
                        MP4, WebM or MOV · up to {MAX_VIDEO_SIZE_MB} MB
                      </span>
                    </button>
                  )}

                  <div className="flex items-center justify-between gap-2 min-h-8">
                    <p className="text-xs text-gray-500">
                      MP4 (H.264) plays in every browser.
                    </p>
                    {uploadedSrc && !isUploading ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => videoInputRef.current?.click()}
                      >
                        <Upload />
                        Replace
                      </Button>
                    ) : null}
                  </div>
                </>
              ) : (
                <>
                  <Input
                    className="border border-green-600 h-8 text-sm"
                    placeholder="https://www.youtube.com/watch?v=…"
                    value={form.youtubeLink}
                    onChange={(e) => update({ youtubeLink: e.target.value })}
                  />
                  {youtubeId ? (
                    <iframe
                      src={youTubeEmbedUrl(youtubeId)}
                      title="YouTube preview"
                      className="w-full h-36 rounded-lg bg-black"
                      allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <div
                      className={cn(
                        "w-full h-36 rounded-lg border border-dashed flex items-center justify-center p-4 text-center text-xs",
                        youtubeLinkInvalid
                          ? "border-red-300 text-red-600"
                          : "border-gray-300 text-gray-500",
                      )}
                    >
                      {youtubeLinkInvalid
                        ? "Not a YouTube video link. Use a link like youtube.com/watch?v=… or youtu.be/…"
                        : "Paste a YouTube link above. Watch, youtu.be, Shorts and embed links all work."}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* thumbnail */}
            <div className="space-y-2 min-w-0">
              <div className="flex items-center justify-between gap-2 min-h-7">
                <Label className="font-semibold">Thumbnail</Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{thumbStatus}</span>
                  {form.thumbIsCustom ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => resetToAutoThumbnail()}
                    >
                      <RotateCcw />
                      Use automatic
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="relative">
                {/* 16:9 at the same height as the video box, so the
                    preview shows the image uncropped */}
                <FilePicker
                  name="video-thumbnail"
                  wrapperClassName="w-full"
                  className="h-36! w-64! max-w-full rounded-lg!"
                  label="Upload thumbnail"
                  accept="image/*"
                  folder={VIDEO_THUMBNAIL_FOLDER}
                  fileLink={form.thumbnail_url || undefined}
                  urlPlaceholder="Or paste an image url"
                  onUploadStart={() => {
                    thumbJobRef.current++;
                    setIsThumbBusy(false);
                  }}
                  onUploaded={(image) => {
                    if (image)
                      update({
                        thumbnail_url: image.downloadUrl,
                        thumbIsCustom: true,
                      });
                  }}
                  onRemoved={() => resetToAutoThumbnail()}
                />
                {isThumbBusy ? (
                  <div className="absolute left-0 top-0 h-36 w-64 max-w-full rounded-lg bg-white/70 flex items-center justify-center">
                    <Loader2 className="animate-spin" />
                  </div>
                ) : null}
              </div>

              <p className="text-xs text-gray-500">
                {form.thumbIsCustom
                  ? "Your own image. Click it to replace it."
                  : `${
                      form.source_type === "youtube"
                        ? "Taken from YouTube."
                        : "A frame from the video."
                    } Click the image to upload your own.`}
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {/* details */}
            <div className="space-y-3 min-w-0">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold" htmlFor="video-title">
                    Title
                  </Label>
                  <span className="text-xs text-gray-500">
                    {form.title.length}/{TITLE_MAX}
                  </span>
                </div>
                <Input
                  id="video-title"
                  className="border border-green-600"
                  maxLength={TITLE_MAX}
                  value={form.title}
                  onChange={(e) => update({ title: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold" htmlFor="video-description">
                    Short description
                  </Label>
                  <span className="text-xs text-gray-500">
                    {form.description.length}/{DESCRIPTION_MAX}
                  </span>
                </div>
                <Textarea
                  id="video-description"
                  className="border border-green-600 min-h-20 max-h-40"
                  maxLength={DESCRIPTION_MAX}
                  value={form.description}
                  onChange={(e) => update({ description: e.target.value })}
                />
              </div>
            </div>

            {/* flags */}
            <div className="space-y-3 min-w-0 md:pt-6">
              <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2">
                <div className="space-y-0.5">
                  <Label htmlFor="video-primary" className="font-semibold">
                    Primary video
                  </Label>
                  <p className="text-xs text-gray-500">
                    {form.is_primary && primaryElsewhere
                      ? `"${primaryElsewhere.title}" will no longer be primary.`
                      : "The featured video. Only one can be primary."}
                  </p>
                </div>
                <Switch
                  id="video-primary"
                  checked={form.is_primary}
                  onCheckedChange={(checked) =>
                    update({
                      is_primary: checked,
                      ...(checked ? { is_active: true } : {}),
                    })
                  }
                />
              </div>

              <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2">
                <div className="space-y-0.5">
                  <Label htmlFor="video-active" className="font-semibold">
                    Show on website
                  </Label>
                  <p className="text-xs text-gray-500">
                    {form.is_primary
                      ? "The primary video is always shown."
                      : "Turn off to hide it without deleting it."}
                  </p>
                </div>
                <Switch
                  id="video-active"
                  checked={form.is_primary || form.is_active}
                  disabled={form.is_primary}
                  onCheckedChange={(checked) => update({ is_active: checked })}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-3 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="own"
            disabled={isSaving || isUploading || isThumbBusy}
            onClick={handleSave}
          >
            {isSaving ? <Loader2 className="animate-spin" /> : null}
            {video ? "Save changes" : "Add video"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
