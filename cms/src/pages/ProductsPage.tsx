import { PaginationComp } from "@/components/PaginationComp";
import SelectInput from "@/components/SelectInput";
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
import { useProduct } from "@/hooks/useProduct";
import { queryClient } from "@/main";
import LoadingHandler from "@/middleware/LoadingHandler";
import { Copy, Loader, Pencil, Plus, Trash } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import SearchInput from "@/components/SearchInput";
import { useDebounce } from "@/hooks/useDebounce";

export default function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const clickedActionButton = useRef<number>(-1);

  const currentPage = parseInt(searchParams.get("page") ?? "1");
  const currentCategory = searchParams.get("category")?.toString();
  const currentStatus = searchParams.get("status")?.toString();
  const currentSearch = searchParams.get("search") ?? "";

  // the input stays instant, only the debounced value hits the api
  const [searchTerm, setSearchTerm] = useState(currentSearch);
  const debouncedSearch = useDebounce(searchTerm, 500);

  useEffect(() => {
    if (debouncedSearch === currentSearch) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (debouncedSearch) {
          next.set("search", debouncedSearch);
        } else {
          next.delete("search");
        }
        next.set("page", "1");
        return next;
      },
      { replace: true },
    );
  }, [debouncedSearch]);

  const {
    isProductFetching,
    productData,
    productError,
    isMuting,
    mutateProduct,
  } = useProduct({
    page: currentPage,
    filter: {
      categoryId: currentCategory,
      status: currentStatus ?? "1",
      limit : 20,
      search: currentSearch,
    },
    depandencyArray: [currentPage, currentCategory, currentStatus, currentSearch],
  });

  const { categoryData, isCategoryFetching } = useCategory({limit : -1});
  const { isLoading: isCoping, mutate: copyProduct } = useDoMutation();

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-2xl">Products</h2>
        <div className="flex items-center justify-center gap-3.5">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search product by name..."
          />
          <SelectInput
            name="status"
            options={[
              { text: "Public", value: "1" },
              { text: "Private", value: "2" },
            ]}
            onValueChange={(value) => {
              setSearchParams((prev) => ({ ...prev, status: value }));
            }}
            defaultValue={currentStatus ?? "1"}
          />
          {isCategoryFetching ? (
            <p>Fetching categories..</p>
          ) : (
            <span title="Filter by category">
              <SelectInput
                onValueChange={(value) => {
                  if (value != "All") {
                    setSearchParams((prev) => ({ ...prev, category: value }));
                  } else {
                    const newSearchParams = new URLSearchParams(searchParams);
                    newSearchParams.delete("category");
                    setSearchParams(newSearchParams);
                  }
                }}
                name="category"
                options={[
                  { text: "All", value: "All" },
                  ...categoryData.map((category) => ({
                    text: category.name,
                    value: category.id.toString(),
                  })),
                ]}
                defaultValue={currentCategory ?? "All"}
              />
            </span>
          )}

          <Link to="/products/new">
            <Button variant="own" className="flex items-center gap-1.5">
              <Plus />
              Add New Product
            </Button>
          </Link>
        </div>
      </div>

      <LoadingHandler
        error={productError}
        length={productData.length}
        loading={isProductFetching}
        noDataMsg="No product found"
      >
        <div className="space-y-5">
          <Table>
            <TableHeader>
              <TableRow className="bg-green-600 hover:!bg-green-600">
                <TableHead className="w-[100px] text-white">
                  Product Name
                </TableHead>
                <TableHead className="w-[100px] text-white">
                  Category
                </TableHead>
                <TableHead className="text-white text-center">
                  Updated Date
                </TableHead>
                <TableHead className="w-[100px] text-white">Status</TableHead>
                <TableHead className="text-right text-white">Action</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {productData.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium max-w-lg text-wrap line-clamp-2 w-lg">
                    {product.name}
                  </TableCell>
                  <TableCell className="text-center">
                    {product.category_name}
                  </TableCell>
                  <TableCell className="text-center">
                    {product.updated_at}
                  </TableCell>
                  <TableCell className="text-center">
                    {product.status == 1 ? (
                      <span className="inline-block px-3.5 py-1 rounded-full bg-green-700 text-white shadow-2xl">
                        Published
                      </span>
                    ) : (
                      <span className="inline-block px-3.5 py-1 rounded-full bg-red-700 text-white shadow-2xl">
                        Private
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right flex items-center justify-end gap-5">
                    {isCoping && clickedActionButton.current == product.id ? (
                      <Loader size={16} className="animate-spin" />
                    ) : (
                      <Copy
                        onClick={() => {
                          if (
                            !confirm(
                              "Are you sure you want to duplicate this product ?",
                            )
                          )
                            return;

                            clickedActionButton.current = product.id;

                          copyProduct({
                            apiPath: "/api/v1/products/copy",
                            method: "post",
                            formData: {
                              old_product_id: product.id,
                            },
                            onSuccess() {
                              queryClient.invalidateQueries({
                                queryKey: ["get-product-list"],
                              });
                              clickedActionButton.current = -1;
                            },
                          });
                        }}
                        className="cursor-pointer"
                        size={16}
                      />
                    )}

                    <Link to={`/products/${product.id}`}>
                      <Pencil className="cursor-pointer" size={16} />
                    </Link>
                    {isMuting && clickedActionButton.current == product.id ? (
                      <Loader size={16} className="animate-spin" />
                    ) : (
                      <Trash
                        className="cursor-pointer"
                        onClick={() => {
                          if (
                            !confirm(
                              "Are you sure you want to remove this product ?",
                            )
                          )
                            return;
                          mutateProduct({
                            type: "delete",
                            id: product.id,
                            onSuccess(){
                              clickedActionButton.current = -1;
                            }
                          });
                        }}
                        size={16}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <PaginationComp
            totalPage={-1}
            totalItems={productData.length}
            page={currentPage}
            onPageChange={(page) => {
              setSearchParams((prev) => {
                prev.set("page", page.toString());
                return prev;
              });
            }}
          />
        </div>
      </LoadingHandler>
    </section>
  );
}
