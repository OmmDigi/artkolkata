import { uploadFiles } from "@/utils/uploadFiles";
import { Plus, Trash } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { toast } from "react-toastify";
import type { IUploadedFile } from "@/types";

interface IProps {
  className?: string;
  fileLink?: string;
  label?: string;
  name: string;
  accept?: string;
  folder?: string;
  onUploaded?: (image: IUploadedFile | null) => void;
  onUploading?: (percent: number) => void;
  onUploadStart?: () => void;
  onRemoved?:() => void;
}

export default function FilePicker({
  className,
  fileLink,
  label,
  name,
  accept,
  folder,
  onUploaded,
  onUploading,
  onUploadStart,
  onRemoved
}: IProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [sourceLink, setSourceLink] = useState<string | undefined>(undefined);

  useEffect(() => {
    setSourceLink(fileLink);
  }, [fileLink]);

  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.currentTarget.files) {
      if (!confirm("Are you sure you want to upload ?")) return;
      const currentFile = e.currentTarget.files[0];
      setFile(file);
      const localUrl = URL.createObjectURL(currentFile);
      setSourceLink(localUrl);

      onUploadStart?.();

      uploadFiles({
        files: [currentFile],
        folder: folder ?? "/media-items",
        onError(error) {
          toast.error(error.message);
          onUploaded?.(null);
        },
        onUploading(percent) {
          setUploadProgress(percent);
          onUploading?.(percent);
        },
        onUploaded(result) {
          setSourceLink(result[0].downloadUrl);
          setUploadProgress(null);
          onUploaded?.(result[0]);
        },
      });
    }
  };

  return (
    <>
      <input
        onChange={handleInputChange}
        ref={inputRef}
        type="file"
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
              {label ?? "Pick Image"}
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
    </>
  );
}
