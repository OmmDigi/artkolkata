import ViewDescriptionDialog from "@/components/dialogs/ViewDescriptionDialog";
import { PaginationComp } from "@/components/PaginationComp";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { REVIEW_STATUS_APPROVED, REVIEW_STATUS_NOT_APPROVED } from "@/constant";
import { useDoMutation } from "@/hooks/useDoMutation";
import { cn } from "@/lib/utils";
import LoadingHandler from "@/middleware/LoadingHandler";
import type { IError, IResponse, IReviews } from "@/types";
import { api } from "@/utils/api";
import { useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { Calendar, CircleCheck, CircleX, Eye, Loader } from "lucide-react";
import { useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

export const getReviewList = async (searchParams: URLSearchParams) => {
  if (!searchParams.has("page")) {
    searchParams.set("page", "1");
  }
  return (await api.get(`/api/v1/products/reviews?${searchParams.toString()}`))
    .data;
};

export default function ReviewsList() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [isOpen, setOpen] = useState(false);
  const [currentClickIndex, setCurrentClickIndex] = useState(-1);

  const currentPage = parseInt(searchParams.get("page") ?? "1");

  const whichReviewStatusUpdating = useRef(-1);

  const { data, error, isFetching, refetch } = useQuery<
    IResponse<IReviews[]>,
    AxiosError<IError>
  >({
    queryKey: ["review-list", searchParams.toString()],
    queryFn: () => getReviewList(searchParams),
  });

  //   const { isProductFetching, } = useProduct()

  const { isLoading, mutate } = useDoMutation();
  const changeReviewStatus = (status: number, reviewid: number) => {
    if (
      !confirm(
        `Are you sure you want to ${
          status === REVIEW_STATUS_APPROVED ? "Approve" : "Unlist"
        } this review`
      )
    )
      return;

    mutate({
      apiPath: "/api/v1/products/reviews",
      method: "patch",
      formData: {
        status,
      },
      id: reviewid,
      onSuccess() {
        refetch();
      },
    });
  };

  return (
    <>
      {isOpen ? (
        <ViewDescriptionDialog
          isOpen={isOpen}
          setOpen={setOpen}
          message={data?.data[currentClickIndex]?.message}
        />
      ) : null}
      <LoadingHandler
        loading={isFetching}
        error={error}
        length={data?.data.length}
      >
        <ScrollArea className="w-full whitespace-nowrap pb-3.5">
          <Table className="w-full">
            <TableHeader>
              <TableRow className="*:min-w-52 bg-green-600 hover:!bg-green-600 *:text-white">
                <TableHead className="sticky top-0 left-0 z-20">
                  PRODUCT NAME
                </TableHead>
                <TableHead>CUSTOMER NAME</TableHead>
                <TableHead>RATING</TableHead>
                <TableHead>MESSAGE</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {data?.data.map((review, index) => (
                <TableRow key={review.id}>
                  <TableCell className="space-y-1">
                    <span className="block">{review.product_name}</span>
                    <span className="flex items-center gap-1 text-gray-600">
                      <Calendar size={12} />
                      {review.created_at}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Badge
                        className={cn(
                          review.status === REVIEW_STATUS_APPROVED
                            ? "bg-green-700"
                            : "bg-yellow-600 animate-pulse",
                          "text-white  rounded-sm"
                        )}
                      >
                        {review.status === REVIEW_STATUS_APPROVED
                          ? "Approved"
                          : "Waiting List"}
                      </Badge>

                      {isLoading &&
                      whichReviewStatusUpdating.current == review.id ? (
                        <Loader
                          strokeWidth={1.75}
                          size={15}
                          className="animate-spin"
                        />
                      ) : (
                        <button
                          onClick={() => {
                            whichReviewStatusUpdating.current = review.id;
                            changeReviewStatus(
                              review.status === REVIEW_STATUS_APPROVED
                                ? REVIEW_STATUS_NOT_APPROVED
                                : REVIEW_STATUS_APPROVED,
                              review.id
                            );
                          }}
                          className="cursor-pointer"
                        >
                          {review.status === REVIEW_STATUS_APPROVED ? (
                            <CircleX
                              fill="#d08700"
                              strokeWidth={1.75}
                              stroke="#ffffff"
                            />
                          ) : (
                            <CircleCheck fill="#008236" stroke="#ffffff" />
                          )}
                        </button>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>{review.user_name}</TableCell>
                  <TableCell>{review.stars}</TableCell>
                  <TableCell className="flex items-center gap-1.5">
                    <p className="text-wrap max-w-md line-clamp-2">
                      {review.message}
                    </p>
                    {/* <Button variant="outline"><Eye /></Button> */}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      onClick={() => {
                        setOpen(true);
                        setCurrentClickIndex(index);
                      }}
                    >
                      <Eye size={18} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <ScrollBar className="z-30" orientation="horizontal" />
        </ScrollArea>

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
    </>
  );
}
