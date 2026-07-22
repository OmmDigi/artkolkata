import SubCategoryDialog from "@/components/dialogs/SubCategoryDialog";
import { PaginationComp } from "@/components/PaginationComp";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDoMutation } from "@/hooks/useDoMutation";
import { useSubCategory } from "@/hooks/useSubCategory";
import LoadingHandler from "@/middleware/LoadingHandler";
import { Loader, Pencil, Plus, Trash } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";

export default function SubCategoryPage() {
  const [open, setOpen] = useState(false);
  const [subCategoryId, setSubCategoryId] = useState(0);

  const [searchParams, setSearchParams] = useSearchParams();

  const currentPage = parseInt(searchParams.get("page") ?? "1");

  const { isLoading, mutate } = useDoMutation();

  const { subCategoryData, isSubCategoryFetching, subCategoryError, refetchSubCategory } =
    useSubCategory({ page: currentPage });

  return (
    <>
      <SubCategoryDialog
        key={`${subCategoryId}`}
        open={open}
        setOpen={setOpen}
        sub_category_id={subCategoryId}
      />
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-2xl">Sub Category</h2>
          <Button
            onClick={() => {
              setSubCategoryId(0);
              setOpen(true);
            }}
            variant="own"
            className="flex items-center gap-1.5"
          >
            <Plus />
            Add New Sub Category
          </Button>
        </div>
        <LoadingHandler
          loading={isSubCategoryFetching}
          error={subCategoryError}
          length={subCategoryData.length}
          noDataMsg="No sub-category found"
        >
          <Table>
            <TableHeader>
              <TableRow className="bg-green-600 hover:!bg-green-600">
                <TableHead className="w-[100px] text-white">
                  Sub Category Name
                </TableHead>
                <TableHead className="text-white text-center">Parant Category</TableHead>
                <TableHead className="text-white text-center">Position</TableHead>
                <TableHead className="text-right text-white">Action</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {subCategoryData.map((item) => (
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
                  <TableCell className="text-center">{item.category}</TableCell>
                  <TableCell className="text-center">{item.position ?? 0}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-5">
                      <Pencil
                        className="cursor-pointer"
                        onClick={() => {
                          setSubCategoryId(item.id);
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
                              apiPath: "/api/v1/products/sub-category",
                              method: "delete",
                              id: item.id,
                              onSuccess() {
                                refetchSubCategory();
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

          <PaginationComp
            totalPage={-1}
            page={currentPage}
            totalItems={subCategoryData.length}
            onPageChange={(page) => {
              setSearchParams((prev) => {
                prev.set("page", page.toString());
                return prev;
              });
            }}
          />
        </LoadingHandler>
      </div>
    </>
  );
}
