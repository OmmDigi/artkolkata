import OrderFilters from "@/components/OrderFilters";
import { PaginationComp } from "@/components/PaginationComp";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ORDER_CANCELLED,
  ORDER_CONFIRMED,
  ORDER_DELIVERED,
  ORDER_PACKED,
  ORDER_PENDING,
  ORDER_RETURN_INITIATED,
  ORDER_RETURNED,
  ORDER_SHIPPED,
  PAYMENT_PAID,
  PAYMENT_PENDING,
  PAYMENT_REFUNDED,
} from "@/constant";
import LoadingHandler from "@/middleware/LoadingHandler";
import { type IResponse, type IOrderList, type IError } from "@/types";
import { api } from "@/utils/api";
import { useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { Download, ExternalLink } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

const getOrderList = async (page: number, filters: string) => {
  return (await api.get(`/api/v1/orders?page=${page}&${filters}`)).data;
};

export default function OrderListingPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const currentPage = parseInt(searchParams.get("page") ?? "1");

  const { isFetching, error, data } = useQuery<
    IResponse<IOrderList[]>,
    AxiosError<IError>
  >({
    queryKey: ["orders-list", currentPage, searchParams.toString()],
    queryFn: () => getOrderList(currentPage, searchParams.toString()),
  });

  return (
    <div className="space-y-2.5">
      <OrderFilters />
      <LoadingHandler
        error={error}
        loading={isFetching}
        length={data?.data.length}
      >
        <ScrollArea className="w-full whitespace-nowrap pb-3.5">
          <Table className="w-max">
            <TableHeader>
              <TableRow className="*:min-w-52 bg-green-600 hover:!bg-green-600 *:text-white">
                <TableHead className="sticky top-0 left-0 z-20">
                  ORDER NUMBER
                </TableHead>
                <TableHead>CUSTOMER NAME</TableHead>
                <TableHead>TOTAL AMOUNT</TableHead>
                <TableHead>PAYMENT STATUS</TableHead>
                <TableHead>ORDER STATUS</TableHead>
                <TableHead>ORDER DATE</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.data?.map((order) => (
                <TableRow key={order.order_id}>
                  <TableCell>
                    <span className="block">{order.order_number}</span>
                    <div className="flex items-center gap-3.5">
                      <Link
                        to={`/orders/${order.order_id}`}
                        className="underline text-green-600 cursor-pointer flex items-center gap-1"
                      >
                        Open
                        <ExternalLink size={12} />
                      </Link>
                      {order.invoice_avilable ? (
                        <Link
                          to={`${
                            import.meta.env.VITE_API_BASE_URL
                          }/api/v1/orders/invoice/${order.order_id}`}
                          target="__blank"
                          className="underline text-red-600 cursor-pointer flex items-center gap-1"
                        >
                          Invoice
                          <Download size={12} />
                        </Link>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>{order.user_name}</TableCell>
                  <TableCell>{order.total_amount}</TableCell>
                  <TableCell>
                    {order.payment_status == PAYMENT_PENDING ? (
                      <span className="inline-block px-3.5 py-1 rounded-full bg-yellow-600 text-white shadow-2xl">
                        Pending
                      </span>
                    ) : order.payment_status == PAYMENT_PAID ? (
                      <span className="inline-block px-3.5 py-1 rounded-full bg-green-700 text-white shadow-2xl">
                        Paid
                      </span>
                    ) : order.payment_status == PAYMENT_REFUNDED ? (
                      <span className="inline-block px-3.5 py-1 rounded-full bg-blue-600 text-white shadow-2xl">
                        Refunded
                      </span>
                    ) : (
                      <span className="inline-block px-3.5 py-1 rounded-full bg-red-700 text-white shadow-2xl">
                        Failed
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {order.order_status == ORDER_PENDING ? (
                      <span className="inline-block px-3.5 py-1 rounded-full bg-yellow-600 text-white shadow-2xl">
                        Pending
                      </span>
                    ) : order.order_status == ORDER_CONFIRMED ? (
                      <span className="inline-block px-3.5 py-1 rounded-full bg-green-700 text-white shadow-2xl">
                        Confirmed
                      </span>
                    ) : order.order_status == ORDER_PACKED ? (
                      <span className="inline-block px-3.5 py-1 rounded-full bg-blue-600 text-white shadow-2xl">
                        Packed
                      </span>
                    ) : order.order_status == ORDER_SHIPPED ? (
                      <span className="inline-block px-3.5 py-1 rounded-full bg-red-700 text-white shadow-2xl">
                        Shipped
                      </span>
                    ) : order.order_status == ORDER_CANCELLED ? (
                      <span className="inline-block px-3.5 py-1 rounded-full bg-red-700 text-white shadow-2xl">
                        Cancelled
                      </span>
                    ) : order.order_status == ORDER_DELIVERED ? (
                      <span className="inline-block px-3.5 py-1 rounded-full bg-cyan-700 text-white shadow-2xl">
                        Delivered
                      </span>
                    ) : order.order_status == ORDER_RETURNED ? (
                      <span className="inline-block px-3.5 py-1 rounded-full bg-red-700 text-white shadow-2xl">
                        Returned
                      </span>
                    ) : order.order_status == ORDER_RETURN_INITIATED ? (
                      <span className="inline-block px-3.5 py-1 rounded-full bg-red-300 text-white shadow-2xl">
                        Return Initiated
                      </span>
                    ) : (
                      <span className="inline-block px-3.5 py-1 rounded-full bg-red-700 text-white shadow-2xl">
                        {order.order_status}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{order.order_date}</TableCell>
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
    </div>
  );
}
