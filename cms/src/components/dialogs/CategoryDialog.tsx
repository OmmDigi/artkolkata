import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "../ui/button";
import { useEffect, useState } from "react";
import { createSlug } from "@/utils/createSlug";
import { LoaderCircle } from "lucide-react";
import { useDoMutation } from "@/hooks/useDoMutation";
import { queryClient } from "@/main";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/utils/api";
import LoadingHandler from "@/middleware/LoadingHandler";
import type { ICategory, IError, IResponse } from "@/types";
import type { AxiosError } from "axios";
import FilePicker from "../FilePicker";
import LabelInput from "../LabelInput";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";
interface IProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  category_id: number;
}

const getSingleCategory = async (id: number) => {
  return (await api.get(`/api/v1/products/category/${id}`)).data;
};

export default function CategoryDialog({
  open,
  setOpen,
  category_id = 0,
}: IProps) {
  const { isLoading, mutate } = useDoMutation();

  const [formData, setFormData] = useState<{
    image: string;
    name: string;
    slug: string;
    alt_tag: string | null;
    position: number | "";
    is_visible: boolean;
  }>({
    image: "",
    alt_tag: null,
    name: "",
    slug: "",
    position: 0,
    is_visible: true,
  });

  const { data, error, isFetching } = useQuery<
    IResponse<ICategory>,
    AxiosError<IError>
  >({
    queryKey: ["get-single-category", category_id],
    queryFn: () => getSingleCategory(category_id),
    enabled: category_id !== 0,
  });

  const resetForm = () => {
    setFormData({
      name: "",
      slug: "",
      image: "",
      alt_tag: null,
      position: 0,
      is_visible: true,
    });
  };

  useEffect(() => {
    if (data?.data) {
      setFormData({
        name: data.data.name ?? "",
        slug: data.data.slug ?? "",
        image: data.data.image,
        alt_tag: data.data.alt_tag,
        position: data.data.position ?? 0,
        is_visible: data.data.is_visible ?? true,
      });
    }
    return () => {
      resetForm();
    };
  }, [category_id, isFetching]);

  const onFormSubmit = (data: FormData) => {
    const payload: Record<string, string | number | boolean | null> = {
      name: formData.name,
      slug: formData.slug,
      image: data.get("image")?.toString() ?? "",
      position: formData.position === "" ? 0 : formData.position,
      is_visible: formData.is_visible,
    };

    const altTag = data.get("alt_tag")?.toString();
    if (altTag && altTag != "") {
      payload["alt_tag"] = altTag;
    }

    if (category_id === 0) {
      mutate({
        apiPath: "/api/v1/products/category",
        method: "post",
        formData: payload,
        onSuccess() {
          setOpen(false);
          resetForm();
          queryClient.invalidateQueries({ queryKey: ["get-category-list"] });
        },
      });
      return;
    }

    mutate({
      apiPath: "/api/v1/products/category",
      method: "put",
      formData: {
        id: category_id,
        ...payload,
      },
      onSuccess() {
        setOpen(false);
        resetForm();
        queryClient.invalidateQueries({ queryKey: ["get-category-list"] });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <LoadingHandler loading={isFetching} length={1} error={error as any}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onFormSubmit(new FormData(e.currentTarget));
            }}
            className="space-y-5"
          >
            <div className="space-y-5">
              <div className="flex items-center justify-center">
                <FilePicker
                  name="image"
                  className="aspect-square size-48"
                  accept="image/*"
                  fileLink={formData.image === "" ? undefined : formData.image}
                />
              </div>
              <div className="flex items-center gap-1.5 flex-wrap *:flex-1">
                <LabelInput
                  name="name"
                  label="Category Name *"
                  placeholder="New Category"
                  value={formData.name}
                  onChange={(event) => {
                    const inputValue = event.currentTarget.value ?? "";
                    setFormData((prev) => ({
                      ...prev,
                      name: inputValue,
                      slug: createSlug(inputValue),
                    }));
                  }}
                />
                <LabelInput
                  name="alt_tag"
                  label="Image Alt Tag"
                  placeholder="Image alt tag (optional)"
                  value={formData.alt_tag ?? ""}
                  onChange={(event) => {
                    const inputValue = event.currentTarget.value ?? "";
                    setFormData((prev) => ({
                      ...prev,
                      alt_tag: inputValue,
                    }));
                  }}
                />
              </div>
              <LabelInput
                name="slug"
                label="Category Slug *"
                placeholder="new-category"
                value={formData.slug}
                onChange={(event) => {
                  const inputValue = event.currentTarget.value ?? "";
                  setFormData((prev) => ({
                    ...prev,
                    slug: inputValue,
                  }));
                }}
              />
              <LabelInput
                name="position"
                label="Position"
                placeholder="0"
                type="number"
                value={formData.position === "" ? "" : formData.position.toString()}
                onChange={(event) => {
                  const inputValue = event.currentTarget.value;
                  const parsed = parseInt(inputValue);
                  setFormData((prev) => ({
                    ...prev,
                    position: inputValue === "" || isNaN(parsed) ? "" : parsed,
                  }));
                }}
              />

              <div className="flex items-center justify-between rounded-md border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="is_visible">Category Visibility</Label>
                  <p className="text-xs text-muted-foreground">
                    {formData.is_visible
                      ? "Public - visible to everyone on the website"
                      : "Private - only admins can see this category"}
                  </p>
                </div>
                <Switch
                  id="is_visible"
                  checked={formData.is_visible}
                  onCheckedChange={(checked) => {
                    setFormData((prev) => ({ ...prev, is_visible: checked }));
                  }}
                />
              </div>
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" variant={"own"}>
                {isLoading ? <LoaderCircle className="animate-spin" /> : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </LoadingHandler>
      </DialogContent>
    </Dialog>
  );
}
