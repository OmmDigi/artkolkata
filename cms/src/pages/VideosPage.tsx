import VideoDialog from "@/components/dialogs/VideoDialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useVideos } from "@/hooks/useVideos";
import { cn } from "@/lib/utils";
import LoadingHandler from "@/middleware/LoadingHandler";
import type { IVideo, TVideoInput } from "@/types";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  ImageOff,
  Pencil,
  Play,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const toInput = (video: IVideo): TVideoInput => ({
  title: video.title,
  description: video.description,
  source_type: video.source_type,
  video_url: video.video_url,
  thumbnail_url: video.thumbnail_url,
  is_primary: video.is_primary,
  is_active: video.is_active,
});

export default function VideosPage() {
  // an order dragged here but not yet confirmed by the server. null means
  // "show the server's order", and any refused change snaps back to it
  const [localOrder, setLocalOrder] = useState<IVideo[] | null>(null);

  const {
    videos,
    isVideoLoading,
    videoError,
    isMutatingVideo,
    mutateVideo,
    refetchVideos,
  } = useVideos({ onMutationError: () => setLocalOrder(null) });

  // a fresh list from the server replaces the local order, which by then it matches
  useEffect(() => setLocalOrder(null), [videos]);

  const list = localOrder ?? videos;
  const currentPrimary = videos.find((video) => video.is_primary) ?? null;

  const [dialog, setDialog] = useState<{ open: boolean; video: IVideo | null }>(
    { open: false, video: null },
  );

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const orderBeforeDrag = useRef<string>("");

  const orderKey = (items: IVideo[]) => items.map((video) => video.id).join(",");

  const saveOrder = (next: IVideo[]) => {
    setLocalOrder(next);
    mutateVideo({
      type: "reorder",
      data: {
        videos: next.map((video, index) => ({
          id: video.id,
          position: index + 1,
        })),
      },
    });
  };

  const handleDragOver = (e: React.DragEvent, hoverIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === hoverIndex) return;

    const next = [...list];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(hoverIndex, 0, moved);
    setLocalOrder(next);
    setDragIndex(hoverIndex);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    // dropping a row back where it started is not a change worth a request
    if (orderKey(list) === orderBeforeDrag.current) {
      setLocalOrder(null);
      return;
    }
    saveOrder(list);
  };

  // the arrows do what a drag does, for touch screens and keyboards
  const moveBy = (index: number, step: -1 | 1) => {
    const target = index + step;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    saveOrder(next);
  };

  const togglePrimary = (video: IVideo) => {
    if (video.is_primary) {
      if (!confirm(`Remove "${video.title}" as the primary video?`)) return;
      mutateVideo({
        type: "update",
        id: video.id,
        data: { ...toInput(video), is_primary: false },
      });
      return;
    }

    if (
      !video.is_active &&
      !confirm(
        `"${video.title}" is hidden. Show it on the website and make it the primary video?`,
      )
    )
      return;

    mutateVideo({
      type: "update",
      id: video.id,
      data: { ...toInput(video), is_primary: true, is_active: true },
    });
  };

  const toggleActive = (video: IVideo, is_active: boolean) => {
    mutateVideo({
      type: "update",
      id: video.id,
      data: { ...toInput(video), is_active },
    });
  };

  const deleteVideo = (video: IVideo) => {
    const note =
      video.source_type === "upload"
        ? " The uploaded video file and its thumbnail are deleted too."
        : "";
    if (!confirm(`Delete "${video.title}"?${note}`)) return;
    mutateVideo({ type: "delete", id: video.id });
  };

  const handleSave = (
    data: TVideoInput,
    onSuccess: () => void,
  ) => {
    if (dialog.video) {
      mutateVideo({ type: "update", id: dialog.video.id, data, onSuccess });
    } else {
      mutateVideo({ type: "add", data, onSuccess });
    }
  };

  return (
    <main className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-2xl">Videos</h2>
          <p className="text-sm text-gray-500">
            Drag a video by its handle to change the order it appears in on the
            website. Only one video can be primary.
          </p>
        </div>
        <Button
          variant="own"
          className="flex items-center gap-1.5"
          onClick={() => setDialog({ open: true, video: null })}
        >
          <Plus />
          Add Video
        </Button>
      </div>

      <LoadingHandler
        loading={isVideoLoading}
        error={videoError}
        length={list.length}
        noDataMsg="No videos yet. Add one to get started."
        onReloadClick={() => refetchVideos()}
      >
        <ul className="space-y-2">
          {list.map((video, index) => (
            <li
              key={video.id}
              draggable
              onDragStart={(e) => {
                // firefox will not start a drag without some data on it
                e.dataTransfer.setData("text/plain", String(video.id));
                e.dataTransfer.effectAllowed = "move";
                orderBeforeDrag.current = orderKey(list);
                setDragIndex(index);
              }}
              onDragOver={(e) => handleDragOver(e, index)}
              // without this firefox treats the dropped id as a link to open
              onDrop={(e) => e.preventDefault()}
              onDragEnd={handleDragEnd}
              className={cn(
                "flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border bg-white p-3 transition-opacity",
                index === dragIndex ? "opacity-30" : "",
                !video.is_active ? "bg-gray-50" : "",
              )}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <GripVertical
                  className="shrink-0 cursor-grab text-gray-400 active:cursor-grabbing"
                  size={20}
                  aria-label="Drag to reorder"
                />

                <button
                  type="button"
                  onClick={() => setDialog({ open: true, video })}
                  className="relative shrink-0 w-40 aspect-video rounded-md overflow-hidden bg-gray-100 cursor-pointer"
                  title="Edit video"
                >
                  {video.thumbnail_url ? (
                    <img
                      src={video.thumbnail_url}
                      alt={video.title}
                      className={cn(
                        "size-full object-cover",
                        !video.is_active ? "opacity-50" : "",
                      )}
                      draggable={false}
                    />
                  ) : (
                    <div className="size-full flex items-center justify-center text-gray-400">
                      <ImageOff size={20} />
                    </div>
                  )}
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="rounded-full bg-black/60 p-1.5 text-white">
                      <Play size={14} className="fill-white" />
                    </span>
                  </span>
                </button>

                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="font-medium truncate">{video.title}</p>
                    {video.is_primary ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-medium">
                        <Star size={12} className="fill-amber-500 text-amber-500" />
                        Primary
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        video.source_type === "youtube"
                          ? "bg-red-50 text-red-700"
                          : "bg-gray-100 text-gray-700",
                      )}
                    >
                      {video.source_type === "youtube" ? "YouTube" : "Uploaded"}
                    </span>
                    {!video.is_active ? (
                      <span className="rounded-full bg-gray-200 text-gray-600 px-2 py-0.5 text-xs font-medium">
                        Hidden
                      </span>
                    ) : null}
                  </div>
                  {video.description ? (
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {video.description}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center justify-end gap-1 sm:gap-2 shrink-0">
                <label
                  className="flex items-center gap-2 text-xs text-gray-600 mr-2"
                  title={
                    video.is_primary
                      ? "The primary video is always shown. Mark another video as primary to hide this one."
                      : "Show on website"
                  }
                >
                  <Switch
                    checked={video.is_active}
                    disabled={video.is_primary || isMutatingVideo}
                    onCheckedChange={(checked) => toggleActive(video, checked)}
                  />
                  Visible
                </label>

                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={index === 0 || isMutatingVideo}
                  onClick={() => moveBy(index, -1)}
                  title="Move up"
                >
                  <ArrowUp />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={index === list.length - 1 || isMutatingVideo}
                  onClick={() => moveBy(index, 1)}
                  title="Move down"
                >
                  <ArrowDown />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={isMutatingVideo}
                  onClick={() => togglePrimary(video)}
                  title={
                    video.is_primary ? "Remove as primary" : "Make primary video"
                  }
                >
                  <Star
                    className={
                      video.is_primary ? "fill-amber-500 text-amber-500" : ""
                    }
                  />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => setDialog({ open: true, video })}
                  title="Edit"
                >
                  <Pencil />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={isMutatingVideo}
                  onClick={() => deleteVideo(video)}
                  title="Delete"
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </LoadingHandler>

      <VideoDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((prev) => ({ ...prev, open }))}
        video={dialog.video}
        currentPrimary={currentPrimary}
        isSaving={isMutatingVideo}
        onSave={handleSave}
      />
    </main>
  );
}
