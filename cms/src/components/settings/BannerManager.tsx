import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { useBanners } from "@/hooks/useSiteSettings";
import type { IBanner } from "@/types";
import { uploadFiles } from "@/utils/uploadFiles";
import {
  ArrowDown,
  ArrowUp,
  ImagePlus,
  Loader2,
  Monitor,
  Smartphone,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";

const BANNER_FOLDER = "/banners";

// the two artwork slots of one banner row. desktop is mandatory, mobile falls back to it
type BannerSlotKey = "image_url" | "mobile_image_url";

const BANNER_SLOTS: {
  key: BannerSlotKey;
  label: string;
  hint: string;
  icon: typeof Monitor;
  aspect: string;
}[] = [
  {
    key: "image_url",
    label: "Desktop",
    hint: "Wide 16:9 artwork · shown from 768px and up",
    icon: Monitor,
    aspect: "aspect-video",
  },
  {
    key: "mobile_image_url",
    label: "Mobile",
    hint: "3:4 portrait artwork · shown below 768px",
    icon: Smartphone,
    aspect: "aspect-[3/4]",
  },
];

export default function BannerManager() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // which banner row + slot the hidden single-file input is currently filling
  const slotInputRef = useRef<HTMLInputElement>(null);
  const slotTargetRef = useRef<{ id: number; key: BannerSlotKey } | null>(null);
  const [slotUploading, setSlotUploading] = useState<string | null>(null);

  const {
    banners,
    isBannerFetching,
    isMutatingBanner,
    mutateBanner,
    refetchBanners,
  } = useBanners();

  // local copy so the per-banner fields stay editable without a round trip each keystroke
  const [drafts, setDrafts] = useState<IBanner[]>([]);
  useEffect(() => setDrafts(banners), [banners]);

  const updateDraft = (id: number, patch: Partial<IBanner>) => {
    setDrafts((prev) =>
      prev.map((banner) =>
        banner.id === id ? { ...banner, ...patch } : banner,
      ),
    );
  };

  const handleFilesPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files || files.length === 0) return;

    setUploadProgress(0);
    // uploadFiles reports failures through onError, its returned error is always null
    let uploadError: string | null = null;
    const { data } = await uploadFiles({
      files: Array.from(files),
      folder: BANNER_FOLDER,
      onUploading: (percent) => setUploadProgress(percent),
      onError: (err) => {
        uploadError = err.response?.data?.message ?? err.message;
      },
    });
    setUploadProgress(null);
    // let the same files be picked again after a failed attempt
    e.target.value = "";

    if (uploadError || data.length === 0) {
      toast.error(uploadError ?? "Unable to upload the banner images");
      return;
    }

    // one row per uploaded image, appended at the end of the existing order
    const startPosition =
      drafts.reduce((max, banner) => Math.max(max, banner.position), 0) + 1;

    for (let i = 0; i < data.length; i++) {
      mutateBanner({
        type: "add",
        data: {
          image_url: data[i].downloadUrl,
          position: startPosition + i,
          is_active: true,
        },
      });
    }
  };

  // opens the hidden input for one slot of one banner row
  const pickSlotFile = (id: number, key: BannerSlotKey) => {
    slotTargetRef.current = { id, key };
    slotInputRef.current?.click();
  };

  const handleSlotFilePicked = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.currentTarget.files?.[0];
    const target = slotTargetRef.current;
    e.target.value = "";
    if (!file || !target) return;

    const banner = drafts.find((draft) => draft.id === target.id);
    if (!banner) return;

    setSlotUploading(`${target.id}-${target.key}`);
    let uploadError: string | null = null;
    const { data } = await uploadFiles({
      files: [file],
      folder: BANNER_FOLDER,
      onError: (err) => {
        uploadError = err.response?.data?.message ?? err.message;
      },
    });
    setSlotUploading(null);

    if (uploadError || data.length === 0) {
      toast.error(uploadError ?? "Unable to upload the banner image");
      return;
    }

    // persist right away so the replaced file gets cleaned up on the upload server
    const updated = { ...banner, [target.key]: data[0].downloadUrl };
    updateDraft(target.id, { [target.key]: data[0].downloadUrl });
    saveBanner(updated);
  };

  const clearSlot = (banner: IBanner, key: BannerSlotKey) => {
    if (key === "image_url") return; // desktop artwork is mandatory
    if (!confirm("Remove this device image? The file will be deleted too."))
      return;

    updateDraft(banner.id, { [key]: "" });
    saveBanner({ ...banner, [key]: "" });
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= drafts.length) return;

    const reordered = [...drafts];
    [reordered[index], reordered[target]] = [
      reordered[target],
      reordered[index],
    ];

    setDrafts(reordered);
    mutateBanner({
      type: "reorder",
      data: {
        banners: reordered.map((banner, i) => ({
          id: banner.id,
          position: i + 1,
        })),
      },
    });
  };

  const saveBanner = (banner: IBanner) => {
    mutateBanner({
      type: "update",
      id: banner.id,
      data: {
        image_url: banner.image_url,
        mobile_image_url: banner.mobile_image_url ?? "",
        alt_text: banner.alt_text ?? "",
        link_url: banner.link_url ?? "",
        position: banner.position,
        is_active: banner.is_active,
      },
    });
  };

  const removeBanner = (banner: IBanner) => {
    if (!confirm("Delete this banner? The image will be removed too.")) return;
    mutateBanner({ type: "delete", id: banner.id });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-medium text-sm text-gray-500 uppercase tracking-wide">
            Website Banners
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            Pick several desktop images at once, then add the mobile artwork on
            each banner. Slots left empty fall back to the desktop image. Only active banners are served to the website.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="own"
            onClick={() => inputRef.current?.click()}
            disabled={uploadProgress !== null}
            className="flex items-center gap-1.5"
          >
            <ImagePlus size={14} /> Upload Banners
          </Button>
          <Button type="button" variant="outline" onClick={() => refetchBanners()}>
            Refresh
          </Button>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={handleFilesPicked}
      />

      {/* single file picker reused by every per-device slot */}
      <input
        ref={slotInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleSlotFilePicked}
      />

      {uploadProgress !== null ? (
        <div className="space-y-1">
          <Progress value={uploadProgress} />
          <span className="text-xs text-gray-500">
            Uploading… {uploadProgress}%
          </span>
        </div>
      ) : null}

      {isBannerFetching && drafts.length === 0 ? (
        <span className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 size={16} className="animate-spin" /> Loading banners…
        </span>
      ) : null}

      {!isBannerFetching && drafts.length === 0 ? (
        <p className="text-sm text-gray-400 border border-dashed rounded-lg p-8 text-center">
          No banner uploaded yet.
        </p>
      ) : null}

      <div className="space-y-4">
        {drafts.map((banner, index) => (
          <div
            key={banner.id}
            className="border rounded-lg p-4 flex gap-4 flex-col md:flex-row bg-white"
          >
            <div className="w-full md:w-72 shrink-0 grid grid-cols-2 gap-2">
              {BANNER_SLOTS.map((slot) => {
                const url = banner[slot.key] ?? "";
                const busy = slotUploading === `${banner.id}-${slot.key}`;
                const SlotIcon = slot.icon;

                return (
                  <div key={slot.key} className="space-y-1">
                    <span
                      className="flex items-center gap-1 text-[11px] text-gray-500"
                      title={slot.hint}
                    >
                      <SlotIcon size={12} /> {slot.label}
                    </span>

                    <div
                      className={`relative ${slot.aspect} rounded-lg border overflow-hidden bg-gray-50`}
                    >
                      {url ? (
                        <img
                          src={url}
                          alt={`${slot.label} banner`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => pickSlotFile(banner.id, slot.key)}
                          disabled={busy || isMutatingBanner}
                          className="w-full h-full flex flex-col items-center justify-center gap-1 text-[10px] text-gray-400 border-dashed"
                        >
                          <Upload size={14} />
                          Upload
                        </button>
                      )}

                      {busy ? (
                        <span className="absolute inset-0 flex items-center justify-center bg-white/70">
                          <Loader2 size={16} className="animate-spin" />
                        </span>
                      ) : null}

                      {url ? (
                        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/50 px-1 py-0.5">
                          <button
                            type="button"
                            onClick={() => pickSlotFile(banner.id, slot.key)}
                            disabled={busy || isMutatingBanner}
                            className="text-[10px] text-white hover:underline"
                          >
                            Replace
                          </button>
                          {slot.key === "image_url" ? null : (
                            <button
                              type="button"
                              aria-label={`Remove ${slot.label} banner`}
                              onClick={() => clearSlot(banner, slot.key)}
                              disabled={busy || isMutatingBanner}
                              className="text-white"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      ) : null}
                    </div>

                    {url || slot.key === "image_url" ? null : (
                      <span className="text-[10px] text-gray-400 leading-tight block">
                        Falls back to desktop
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex-1 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Alt Text</Label>
                  <Input
                    value={banner.alt_text ?? ""}
                    onChange={(e) =>
                      updateDraft(banner.id, { alt_text: e.target.value })
                    }
                    placeholder="Describes the image for SEO"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Link URL</Label>
                  <Input
                    value={banner.link_url ?? ""}
                    onChange={(e) =>
                      updateDraft(banner.id, { link_url: e.target.value })
                    }
                    placeholder="/products/some-slug"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm select-none">
                    <Switch
                      checked={banner.is_active}
                      onCheckedChange={(checked) =>
                        updateDraft(banner.id, { is_active: checked })
                      }
                    />
                    {banner.is_active ? "Active" : "Hidden"}
                  </label>

                  <span className="text-xs text-gray-400">
                    Position {index + 1}
                  </span>

                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      disabled={index === 0 || isMutatingBanner}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp size={14} />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      disabled={index === drafts.length - 1 || isMutatingBanner}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown size={14} />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="own"
                    size="sm"
                    disabled={isMutatingBanner}
                    onClick={() => saveBanner(banner)}
                  >
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={isMutatingBanner}
                    onClick={() => removeBanner(banner)}
                    className="flex items-center gap-1.5"
                  >
                    <Trash2 size={14} /> Delete
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
