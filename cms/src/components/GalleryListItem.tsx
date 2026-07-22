import { Button } from "./ui/button";
import { Eye, Pencil, Plus, Trash, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { IGalleryItem } from "@/types";
import { Link } from "react-router-dom";
import { extractYouTubeThumbnail } from "@/utils/extractYouTubeThumbnail";
import { ButtonLoading } from "./ui/button-loading";

interface IProps {
  asChooser: boolean;
  onChooseMediaItem?: () => void;
  onRemoveItemSelection?: () => void;
  isSelected?: boolean;
  galleryItem: IGalleryItem;
  onEditBtnClick?: () => void;
  onDeleteBtnClick?: () => void;
  isDeleting?: boolean;
  editBtnVisible?: boolean;
  chooseOnly?: number;
}

export default function GalleryListItem({
  asChooser,
  onChooseMediaItem,
  onRemoveItemSelection,
  isSelected,
  galleryItem,
  onEditBtnClick,
  onDeleteBtnClick,
  isDeleting = false,
  editBtnVisible = true,
}: IProps) {
  return (
    <li
      className={cn(
        "overflow-hidden rounded-lg group/gallery",
        isSelected ? "opacity-55" : ""
      )}
    >
      <div className="w-full h-fit relative">
        <img
          className="w-full aspect-video object-cover"
          src={
            galleryItem.media_type === "image"
              ? galleryItem.item_link
              : extractYouTubeThumbnail(galleryItem.item_link)
          }
          alt=""
          height={1200}
          width={1200}
        />
        <div className="absolute inset-0 bg-[#00000052] opacity-0 group-hover/gallery:opacity-100 transition-all duration-300 flex items-center justify-center gap-3">
          {asChooser && !isSelected ? (
            <Button onClick={onChooseMediaItem}>
              <Plus size={12} />
            </Button>
          ) : null}
          {asChooser && isSelected ? (
            <Button
              className="p-3"
              variant="outline"
              onClick={onRemoveItemSelection}
            >
              <X size={8} />
            </Button>
          ) : null}
          <Link to={galleryItem.item_link} target="__blank">
            <Button className="p-3">
              <Eye size={8} />
            </Button>
          </Link>
          {editBtnVisible ? (
            <Button onClick={onEditBtnClick} className="p-3">
              <Pencil size={8} />
            </Button>
          ) : null}

          <ButtonLoading
            loading={isDeleting}
            onClick={onDeleteBtnClick}
            className="p-3"
            variant="destructive"
          >
            <Trash size={8} />
          </ButtonLoading>
        </div>
      </div>

      <h2 className="font-semibold text-sm p-1 line-clamp-2">
        Alt : {galleryItem.alt_tag}
      </h2>
      <h3 className="text-sm px-1">
        Type : {galleryItem.media_type === "image" ? "Image" : "YouTube Link"}
      </h3>
    </li>
  );
}
