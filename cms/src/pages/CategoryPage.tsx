import CategoryDialog from "@/components/dialogs/CategoryDialog";
// import { PaginationComp } from "@/components/PaginationComp";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCategory } from "@/hooks/useCategory";
import { useDoMutation } from "@/hooks/useDoMutation";
import LoadingHandler from "@/middleware/LoadingHandler";
import { Loader, Pencil, Plus, Trash } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import type { ICategory } from "@/types";

export default function CategoryPage() {
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState(0);

  const [searchParams, _] = useSearchParams();

  const currentPage = parseInt(searchParams.get("page") ?? "1");

  const { isLoading, mutate } = useDoMutation();

  // separate mutation instance so the visibility toggle does not block the delete button
  const [togglingId, setTogglingId] = useState(0);
  const { isLoading: isVisibilityUpdating, mutate: mutateVisibility } =
    useDoMutation();

  const { categoryData, isCategoryFetching, categoryError, refetchCategory } =
    useCategory({ page: currentPage, limit : -1 });

  const onVisibilityChange = (item: ICategory, isVisible: boolean) => {
    const payload: Record<string, string | number | boolean | null> = {
      id: item.id,
      name: item.name,
      slug: item.slug,
      image: item.image,
      position: item.position ?? 0,
      is_visible: isVisible,
    };

    if (item.alt_tag && item.alt_tag !== "") {
      payload["alt_tag"] = item.alt_tag;
    }

    setTogglingId(item.id);
    mutateVisibility({
      apiPath: "/api/v1/products/category",
      method: "put",
      formData: payload,
      onSuccess() {
        refetchCategory();
      },
    });
  };

  return (
    <>
      <CategoryDialog
        key={`${categoryId}`}
        open={open}
        setOpen={setOpen}
        category_id={categoryId}
      />
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-2xl">Product Category</h2>
          <Button
            onClick={() => {
              setCategoryId(0);
              setOpen(true);
            }}
            variant="own"
            className="flex items-center gap-1.5"
          >
            <Plus />
            Add New Category
          </Button>
        </div>
        <LoadingHandler
          loading={isCategoryFetching}
          error={categoryError}
          length={categoryData.length}
          noDataMsg="No category found"
        >
          <Table>
            <TableHeader>
              <TableRow className="bg-green-600 hover:!bg-green-600">
                <TableHead className="w-[100px] text-white">
                  Category Name
                </TableHead>
                <TableHead className="text-white text-center">Slug</TableHead>
                <TableHead className="text-white text-center">Position</TableHead>
                <TableHead className="text-white text-center">
                  Visibility
                </TableHead>
                <TableHead className="text-right text-white">Action</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {categoryData.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {/* <div className="flex items-center gap-2">
                      <div className="h-20 aspect-square overflow-hidden rounded-xl bg-gray-300">
                        <img
                          className="size-full object-cover"
                          alt={item.alt_tag ?? undefined}
                          title={item.alt_tag ?? undefined}
                          src={item.image}
                        />
                      </div>
                      {item.name}
                    </div> */}
                    {item.name}
                  </TableCell>
                  <TableCell className="text-center">{item.slug}</TableCell>
                  <TableCell className="text-center">{item.position ?? 0}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-2">
                      <Switch
                        checked={item.is_visible}
                        disabled={
                          isVisibilityUpdating && togglingId === item.id
                        }
                        onCheckedChange={(checked) =>
                          onVisibilityChange(item, checked)
                        }
                      />
                      <Badge variant={item.is_visible ? "default" : "secondary"}>
                        {item.is_visible ? "Public" : "Private"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-5">
                      <Pencil
                        className="cursor-pointer"
                        onClick={() => {
                          setCategoryId(item.id);
                          setOpen(true);
                        }}
                        size={16}
                      />
                      {isLoading ? (
                        <Loader size={16} className="animate-spin" />
                      ) : (
                        <Trash
                          className="cursor-pointer"
                          onClick={() => {
                            if (
                              !confirm(
                                "Are you sure you want to remove this category ?"
                              )
                            )
                              return;
                            mutate({
                              apiPath: "/api/v1/products/category",
                              method: "delete",
                              id: item.id,
                              onSuccess() {
                                refetchCategory();
                              },
                            });
                          }}
                          size={16}
                        />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* <PaginationComp
            totalPage={-1}
            page={currentPage}
            totalItems={categoryData.length}
            onPageChange={(page) => {
              setSearchParams((prev) => {
                prev.set("page", page.toString());
                return prev;
              });
            }}
          /> */}
        </LoadingHandler>
      </div>
    </>
  );
}
