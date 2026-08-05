import type { ImageTypes } from "@/types";
import { cn } from "@/lib/utils";
import { Film, ImagePlus, Plus } from "lucide-react";
import { useState } from "react";
import FilePicker from "./FilePicker";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

const YOUTUBE_ID = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/;

export function getVideoPreview(url: string) {
  const youtubeId = url.match(YOUTUBE_ID)?.[1];
  if (youtubeId) {
    return {
      kind: "thumbnail" as const,
      src: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
    };
  }
  if (/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url)) {
    return { kind: "video" as const, src: url };
  }
  return null;
}

interface IProps {
  title: string;
  items: ImageTypes[];
  onChange: (items: ImageTypes[]) => void;
  /** name given to the hidden file inputs, keep "image" in it so the product form skips them */
  namePrefix?: string;
  gridClassName?: string;
  /** first item can not be removed (main product media) */
  lockFirstItem?: boolean;
  onUploadStart?: () => void;
  onUploaded?: () => void;
}

export default function MediaManager({
  title,
  items,
  onChange,
  namePrefix = "image",
  gridClassName = "grid grid-cols-1 md:grid-cols-4 gap-2.5",
  lockFirstItem = false,
  onUploadStart,
  onUploaded,
}: IProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const updateItem = (index: number, patch: Partial<ImageTypes>) => {
    onChange(
      items.map((item, cIndex) =>
        cIndex === index ? { ...item, ...patch } : item,
      ),
    );
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, cIndex) => cIndex !== index));
  };

  const handleDragOver = (
    e: React.DragEvent<HTMLDivElement>,
    hoverIndex: number,
  ) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === hoverIndex) return;

    const updated = [...items];
    const [moved] = updated.splice(dragIndex, 1);
    updated.splice(hoverIndex, 0, moved);
    setDragIndex(hoverIndex);
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-xl">{title}</h2>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={() =>
              onChange([...items, { image: "", alt_tag: null, type: "image" }])
            }
          >
            <ImagePlus />
            Add Image
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              onChange([...items, { image: "", alt_tag: null, type: "video" }])
            }
          >
            <Film />
            Add Video Link
          </Button>
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Drag any item to change its position, images and videos are shown in
        this same order on the website.
      </p>

      <div className={gridClassName}>
        {items.map((item, index) => {
          const preview =
            item.type === "video" && item.image !== ""
              ? getVideoPreview(item.image)
              : null;

          return (
            <div
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={() => setDragIndex(null)}
              key={index}
              className={cn(
                "flex items-center justify-center flex-col gap-1",
                index === dragIndex ? "opacity-5" : "",
              )}
            >
              {item.type === "video" ? (
                <div className="w-36 space-y-1">
                  <div className="w-36 h-24 bg-white border-1 border-dotted border-gray-700 rounded-2xl overflow-hidden flex items-center justify-center cursor-grab">
                    {preview?.kind === "thumbnail" ? (
                      <img
                        src={preview.src}
                        alt="Video preview"
                        className="size-full object-cover"
                      />
                    ) : preview?.kind === "video" ? (
                      <video
                        src={preview.src}
                        className="size-full object-cover"
                        muted
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-gray-500">
                        <Plus size={16} />
                        <span className="text-xs font-semibold">
                          Video Link
                        </span>
                      </div>
                    )}
                  </div>
                  <Input
                    className="border-1 border-green-600 text-xs h-8"
                    placeholder="Paste video link"
                    value={item.image}
                    onChange={(e) => updateItem(index, { image: e.target.value })}
                  />
                </div>
              ) : (
                <FilePicker
                  name={`${namePrefix}-${index + 1}`}
                  className="w-36 h-24! aspect-auto text-xs cursor-grab!"
                  fileLink={item.image === "" ? undefined : item.image}
                  accept="image/*"
                  onUploadStart={onUploadStart}
                  onUploaded={(image) => {
                    updateItem(index, { image: image?.downloadUrl ?? "" });
                    onUploaded?.();
                  }}
                  onRemoved={() => updateItem(index, { image: "" })}
                />
              )}

              <button
                disabled={lockFirstItem && index === 0}
                onClick={() => removeItem(index)}
                type="button"
                className={cn(
                  lockFirstItem && index === 0
                    ? "opacity-30"
                    : "opacity-100 cursor-pointer",
                  "text-red-500 underline text-sm",
                )}
              >
                Remove
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
