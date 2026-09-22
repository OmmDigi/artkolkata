import type { ImageTypes, IUploadedFile } from "@/types";
import { cn } from "@/lib/utils";
import { ClipboardPaste, Copy, Film, ImagePlus, Plus } from "lucide-react";
import { useRef, useState, useSyncExternalStore } from "react";
import { toast } from "react-toastify";
import FilePicker from "./FilePicker";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

const YOUTUBE_ID = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/;

/**
 * Media copied from one manager, shared by every MediaManager on the page so a
 * variant media block can be pasted into another variant without re uploading.
 */
let mediaClipboard: ImageTypes[] = [];
const clipboardListeners = new Set<() => void>();

const subscribeToClipboard = (listener: () => void) => {
  clipboardListeners.add(listener);
  return () => {
    clipboardListeners.delete(listener);
  };
};

const setMediaClipboard = (items: ImageTypes[]) => {
  mediaClipboard = items;
  clipboardListeners.forEach((listener) => listener());
};

export function useMediaClipboard() {
  return useSyncExternalStore(subscribeToClipboard, () => mediaClipboard);
}

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
  /** upload destination passed to the file picker, e.g. "/blog-assets" */
  folder?: string;
  /** show a per image alt text box, needed where the alt tag is SEO copy */
  showAltText?: boolean;
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
  folder,
  showAltText = false,
  onUploadStart,
  onUploaded,
}: IProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const clipboard = useMediaClipboard();

  // a multi file upload reports the first file and the rest one after another,
  // so every change is built on this ref instead of the prop of that render
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const commit = (next: ImageTypes[]) => {
    itemsRef.current = next;
    onChange(next);
  };

  /** media worth copying, an empty slot the user never filled is skipped */
  const filledItems = items.filter((item) => item.image.trim() !== "");

  const copyItems = () => {
    setMediaClipboard(filledItems.map((item) => ({ ...item })));
    toast.success(
      `Copied ${filledItems.length} media item${filledItems.length > 1 ? "s" : ""}`,
    );
  };

  const pasteItems = () => {
    const existing = new Set(filledItems.map((item) => item.image));
    const pasted = clipboard
      .filter((item) => existing.has(item.image) === false)
      .map((item) => ({ ...item }));

    if (pasted.length === 0) {
      toast.info("This media is already added here");
      return;
    }

    commit([...filledItems, ...pasted]);
    toast.success(
      `Pasted ${pasted.length} media item${pasted.length > 1 ? "s" : ""}`,
    );
  };

  const updateItem = (index: number, patch: Partial<ImageTypes>) => {
    commit(
      itemsRef.current.map((item, cIndex) =>
        cIndex === index ? { ...item, ...patch } : item,
      ),
    );
  };

  const removeItem = (index: number) => {
    commit(itemsRef.current.filter((_, cIndex) => cIndex !== index));
  };

  /** extra files picked in one go, they land right after the slot used to pick them */
  const insertUploadedAfter = (index: number, uploaded: IUploadedFile[]) => {
    if (uploaded.length === 0) return;

    const next = [...itemsRef.current];
    next.splice(
      index + 1,
      0,
      ...uploaded.map((file) => ({
        image: file.downloadUrl,
        alt_tag: null,
        type: "image" as const,
      })),
    );

    commit(next);
    toast.success(`Uploaded ${uploaded.length + 1} images`);
  };

  const handleDragOver = (
    e: React.DragEvent<HTMLDivElement>,
    hoverIndex: number,
  ) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === hoverIndex) return;

    const updated = [...itemsRef.current];
    const [moved] = updated.splice(dragIndex, 1);
    updated.splice(hoverIndex, 0, moved);
    setDragIndex(hoverIndex);
    commit(updated);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-xl">{title}</h2>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={() =>
              commit([...items, { image: "", alt_tag: null, type: "image" }])
            }
          >
            <ImagePlus />
            Add Image
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              commit([...items, { image: "", alt_tag: null, type: "video" }])
            }
          >
            <Film />
            Add Video Link
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={filledItems.length === 0}
          onClick={copyItems}
          title="Copy this media so it can be pasted into another variant"
        >
          <Copy />
          Copy Media
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={clipboard.length === 0}
          onClick={pasteItems}
          title="Paste the copied media here"
        >
          <ClipboardPaste />
          Paste Media
          {clipboard.length > 0 ? ` (${clipboard.length})` : ""}
        </Button>
      </div>

      <p className="text-xs text-gray-500">
        {/* Drag any item to change its position, images and videos are shown in
        this same order on the website. One image slot can take several files
        at once, they are uploaded together and added here. Use Copy Media,
        then Paste Media on another variant to reuse the same images without
        uploading them again. */ }
        Drag any item to change its position, images and videos are shown in this same order on the website. One image slot can take several files
        at onc (Max 5)
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
                  folder={folder}
                  multiple
                  onUploadStart={onUploadStart}
                  onUploaded={(image) => {
                    updateItem(index, { image: image?.downloadUrl ?? "" });
                    onUploaded?.();
                  }}
                  onUploadedMany={(images) =>
                    insertUploadedAfter(index, images)
                  }
                  onRemoved={() => updateItem(index, { image: "" })}
                />
              )}

              {showAltText ? (
                <Input
                  className="w-36 border-1 border-green-600 text-xs h-8"
                  placeholder={item.type === "video" ? "Video title" : "Alt text"}
                  value={item.alt_tag ?? ""}
                  onChange={(e) =>
                    updateItem(index, { alt_tag: e.target.value })
                  }
                />
              ) : null}

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