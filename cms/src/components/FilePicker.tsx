import { uploadFiles } from "@/utils/uploadFiles";
import { asUploadedFile, isAssetUrl } from "@/utils/assetUrl";
import { cn } from "@/lib/utils";
import { Plus, Trash } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { toast } from "react-toastify";
import type { IUploadedFile } from "@/types";

interface IProps {
  className?: string;
  /** wraps the picker button and the url box, use it to size the whole block */
  wrapperClassName?: string;
  fileLink?: string;
  label?: string;
  name: string;
  accept?: string;
  folder?: string;
  /** set false to hide the "paste an asset url" box */
  allowUrl?: boolean;
  urlPlaceholder?: string;
  /** let the file dialog take more than one file, the extras go to onUploadedMany */
  multiple?: boolean;
  onUploaded?: (image: IUploadedFile | null) => void;
  /** every file uploaded after the first one, only fires when multiple is on */
  onUploadedMany?: (images: IUploadedFile[]) => void;
  onUploading?: (percent: number) => void;
  onUploadStart?: () => void;
  onRemoved?: () => void;
}

export default function FilePicker({
  className,
  wrapperClassName,
  fileLink,
  label,
  name,
  accept,
  folder,
  allowUrl = true,
  urlPlaceholder = "Or paste an asset url",
  multiple = false,
  onUploaded,
  onUploadedMany,
  onUploading,
  onUploadStart,
  onRemoved,
}: IProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [sourceLink, setSourceLink] = useState<string | undefined>(undefined);
  // kept apart from sourceLink so a half typed link never becomes the preview
  const [urlDraft, setUrlDraft] = useState(fileLink ?? "");

  useEffect(() => {
    setSourceLink(fileLink);
    setUrlDraft(fileLink ?? "");
  }, [fileLink]);

  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const picked = Array.from(input.files ?? []);
    if (picked.length === 0) return;

    const selectedFiles = multiple ? picked : picked.slice(0, 1);

    if (
      !confirm(
        selectedFiles.length > 1
          ? `Are you sure you want to upload ${selectedFiles.length} files ?`
          : "Are you sure you want to upload ?",
      )
    ) {
      // the same file must stay pickable after a cancel
      input.value = "";
      return;
    }

    const localUrl = URL.createObjectURL(selectedFiles[0]);
    setSourceLink(localUrl);

    onUploadStart?.();

    // all of them go up in one /upload/multiple call and come back as a list
    uploadFiles({
      files: selectedFiles,
      folder: folder ?? "/media-items",
      onError(error) {
        toast.error(error.message);
        setSourceLink(fileLink);
        setUploadProgress(null);
        onUploaded?.(null);
      },
      onUploading(percent) {
        setUploadProgress(percent);
        onUploading?.(percent);
      },
      onUploaded(result) {
        setUploadProgress(null);
        if (result.length === 0) {
          setSourceLink(fileLink);
          onUploaded?.(null);
          return;
        }

        setSourceLink(result[0].downloadUrl);
        setUrlDraft(result[0].downloadUrl);
        onUploaded?.(result[0]);

        // this picker holds one slot, the rest are handed to the parent
        if (result.length > 1) onUploadedMany?.(result.slice(1));
      },
    });

    input.value = "";
  };

  // a pasted link needs no upload, it only reports itself like a finished upload
  const handleUrlChange = (value: string) => {
    setUrlDraft(value);

    if (value.trim() === "") {
      setSourceLink(undefined);
      onRemoved?.();
      return;
    }

    if (!isAssetUrl(value)) return;

    const uploaded = asUploadedFile(value);
    setSourceLink(uploaded.downloadUrl);
    onUploaded?.(uploaded);
  };

  return (
    <div className={cn("w-fit space-y-1.5", wrapperClassName)}>
      <input
        onChange={handleInputChange}
        ref={inputRef}
        type="file"
        multiple={multiple}
        className="hidden"
        accept={accept ?? "*/*"}
      />
      <input name={name} className="hidden" value={sourceLink} />
      <button
        onClick={() => {
          if (inputRef.current) {
            inputRef.current.click();
          }
        }}
        type="button"
        className={`bg-white relative active:scale-95 transition-all duration-300 border-1 border-gray-700 border-dotted aspect-video h-44 flex items-center gap-y-3.5 cursor-pointer justify-center flex-col rounded-2xl overflow-hidden ${className}`}
      >
        {!sourceLink ? (
          <>
            <Plus />
            <p className="font-semibold text-sm text-gray-500">
              {label ?? (multiple ? "Pick Images" : "Pick Image")}
            </p>
          </>
        ) : (
          <div className="relative size-full">
            {uploadProgress ? (
              <div className="size-full bg-[#0000009c] absolute inset-0 flex items-center flex-col justify-center gap-1 pt-1">
                <Progress value={uploadProgress} className="w-[60%]" />
                <span className="text-white">{uploadProgress}%</span>
              </div>
            ) : null}

            <Trash
              onClick={(e) => {
                e.stopPropagation();
                onRemoved?.();
                setSourceLink(undefined);
                setUrlDraft("");
              }}
              size={20}
              className="absolute top-5 right-5 bg-red-500 text-white rounded-2xl p-1 z-10"
            />

            <img
              src={sourceLink}
              alt="Product main image"
              className="size-full z-0 object-cover"
            />
          </div>
        )}
      </button>

      {allowUrl ? (
        <Input
          value={urlDraft}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder={urlPlaceholder}
          className="w-full h-8 text-xs border-1 border-green-600"
        />
      ) : null}
    </div>
  );
}