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
import type { IError, IResponse, ISubCategory } from "@/types";
import type { AxiosError } from "axios";
import FilePicker from "../FilePicker";
import LabelInput from "../LabelInput";
import SelectInput from "../SelectInput";
import { Label } from "../ui/label";
import { useCategory } from "@/hooks/useCategory";
interface IProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  sub_category_id: number;
}

const getSingleCategory = async (id: number) => {
  return (await api.get(`/api/v1/products/sub-category/${id}`)).data;
};

export default function SubCategoryDialog({
  open,
  setOpen,
  sub_category_id = 0,
}: IProps) {
  const { isLoading, mutate } = useDoMutation();
  const { isCategoryFetching, categoryData } = useCategory();

  const [formData, setFormData] = useState<{
    image: string;
    name: string;
    slug: string;
    alt_tag: string | null;
    category_id: number | null;
    position: number | "";
  }>({
    image: "",
    alt_tag: null,
    name: "",
    slug: "",
    category_id: null,
    position: 0,
  });

  const { data, error, isFetching } = useQuery<
    IResponse<ISubCategory>,
    AxiosError<IError>
  >({
    queryKey: ["get-single-category", sub_category_id],
    queryFn: () => getSingleCategory(sub_category_id),
    enabled: sub_category_id !== 0,
  });

  const resetForm = () => {
    setFormData({
      name: "",
      slug: "",
      image: "",
      alt_tag: null,
      category_id: 0,
      position: 0,
    });
  };

  useEffect(() => {
    if (data?.data) {
      setFormData({
        name: data.data.name ?? "",
        slug: data.data.slug ?? "",
        image: data.data.image,
        alt_tag: data.data.alt_tag,
        category_id: data.data?.category_id,
        position: data.data.position ?? 0,
      });
    }
    return () => {
      resetForm();
    };
  }, [sub_category_id, isFetching]);

  const onFormSubmit = (data: FormData) => {
    const payload: Record<string, string | number | null> = {
      name: formData.name,
      slug: formData.slug,
      image: data.get("image")?.toString() ?? "",
      category_id: formData.category_id,
      position: formData.position === "" ? 0 : formData.position,
    };

    const altTag = data.get("alt_tag")?.toString();
    if (altTag && altTag != "") {
      payload["alt_tag"] = altTag;
    }

    if (sub_category_id === 0) {
      mutate({
        apiPath: "/api/v1/products/sub-category",
        method: "post",
        formData: payload,
        onSuccess() {
          setOpen(false);
          resetForm();
          queryClient.invalidateQueries({
            queryKey: ["get-sub-category-list"],
          });
        },
      });
      return;
    }

    mutate({
      apiPath: "/api/v1/products/sub-category",
      method: "put",
      formData: {
        id: sub_category_id,
        ...payload,
      },
      onSuccess() {
        setOpen(false);
        resetForm();
        queryClient.invalidateQueries({ queryKey: ["get-sub-category-list"] });
      },
    });
  };

  // console.log(formData)

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
                  label="Sub Category Name *"
                  placeholder="New Sub Category"
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
                {isCategoryFetching ? (
                  <Label>Category Fetching..</Label>
                ) : (
                  <SelectInput
                    key={formData.category_id}
                    name="category_id"
                    label="Category *"
                    options={categoryData.map((category) => ({
                      text: category.name,
                      value: category.id.toString(),
                    }))}
                    defaultValue={formData.category_id?.toString()}
                    onValueChange={(value) => {
                      setFormData((prev) => ({
                        ...prev,
                        category_id: parseInt(value),
                      }));
                    }}
                  />
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap *:flex-1">
                <LabelInput
                  name="alt_tag"
                  label="Image Alt Tag"
                  placeholder="Image alt tag (optional)"
                  defaultValue={formData.alt_tag ?? undefined}
                  onChange={(e) => {
                    setFormData((prev) => ({
                      ...prev,
                      alt_tag: e.currentTarget?.value ?? "",
                    }));
                  }}
                />
                <LabelInput
                  name="slug"
                  label="Sub Category Slug *"
                  placeholder="new-sub-category"
                  value={formData.slug}
                  onChange={(event) => {
                    const inputValue = event.currentTarget.value ?? "";
                    setFormData((prev) => ({
                      ...prev,
                      slug: inputValue,
                    }));
                  }}
                />
              </div>
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
