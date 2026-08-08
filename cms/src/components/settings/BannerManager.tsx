import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { useBanners } from "@/hooks/useSiteSettings";
import type { IBanner } from "@/types";
import { uploadFiles } from "@/utils/uploadFiles";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";

const BANNER_FOLDER = "/banners";

export default function BannerManager() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

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
            Pick several images at once. Only active banners are served to the
            website.
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
            <img
              src={banner.image_url}
              alt={banner.alt_text ?? "Banner"}
              className="w-full md:w-56 aspect-video object-cover rounded-lg border shrink-0"
            />

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
