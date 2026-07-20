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
import LoadingHandler from "@/middleware/LoadingHandler";
import type { IError, IResponse } from "@/types";
import { api } from "@/utils/api";
import { useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { Loader, Pencil, Plus, Trash } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

const getDiscountList = async (page: number) => {
  return (await api.get(`/api/v1/discount?page=${page}`)).data;
};

export default function DiscountPage() {
  const { isLoading, mutate } = useDoMutation();

  const [searchParams, setSearchParams] = useSearchParams();

  const currentPage = parseInt(searchParams.get("page") ?? "1");

  const { data, isFetching, error, refetch } = useQuery<
    IResponse<any[]>,
    AxiosError<IError>
  >({
    queryKey: ["get-discount-list", currentPage],
    queryFn: () => getDiscountList(currentPage),
  });

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-2xl">Coupons</h2>
        <Link to="/discount/new">
          <Button variant="own" className="flex items-center gap-1.5">
            <Plus />
            Create New Coupon
          </Button>
        </Link>
      </div>

      <LoadingHandler
        loading={isFetching}
        error={error}
        length={data?.data.length}
        noDataMsg="No category found"
      >
        <Table>
          <TableHeader>
            <TableRow className="bg-green-600 hover:!bg-green-600">
              <TableHead className="w-[100px] text-white">
                Coupon Code
              </TableHead>
              <TableHead className="text-white text-center">Status</TableHead>
              <TableHead className="text-right text-white">Action</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {data?.data.map((item) => (
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
                  {item.code}
                  <span className="block">
                    Expire at:{" "}
                    <span className="font-normal">{item.expire_at}</span>
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  {item.status == "active" ? (
                    <span className="inline-block px-3.5 py-1 rounded-full bg-green-700 text-white shadow-2xl">
                      Active
                    </span>
                  ) : (
                    <span className="inline-block px-3.5 py-1 rounded-full bg-red-700 text-white shadow-2xl">
                      In Active
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-5">
                    <Link to={`/discount/${item.id}`}>
                      <Pencil className="cursor-pointer" size={16} />
                    </Link>
                    {isLoading ? (
                      <Loader size={16} className="animate-spin" />
                    ) : (
                      <Trash
                        className="cursor-pointer"
                        onClick={() => {
                          if (
                            !confirm(
                              "Are you sure you want to remove this coupon ?"
                            )
                          )
                            return;
                          mutate({
                            apiPath: "/api/v1/discount",
                            method: "delete",
                            id: item.id,
                            onSuccess() {
                              refetch();
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
          totalItems={data?.data.length}
          onPageChange={(page) => {
            setSearchParams((prev) => {
              prev.set("page", page.toString());
              return prev;
            });
          }}
        />
      </LoadingHandler>
    </main>
  );
}
