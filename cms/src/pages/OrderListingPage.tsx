import BulkInvoiceBar from "@/components/BulkInvoiceBar";
import OrderDocumentActions from "@/components/OrderDocumentActions";
import { Checkbox } from "@/components/ui/checkbox";
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
  PAYMENT_METHOD_COD,
  PAYMENT_METHOD_ONLINE,
  PAYMENT_PAID,
  PAYMENT_PENDING,
  PAYMENT_REFUNDED,
} from "@/constant";
import LoadingHandler from "@/middleware/LoadingHandler";
import { type IResponse, type IOrderList, type IError } from "@/types";
import { api } from "@/utils/api";
import { usePageSize } from "@/hooks/usePageSize";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { AxiosError } from "axios";
import { Calendar, Download, ExternalLink, Hash, Mail, User } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

const getOrderList = async (page: number, limit: number, filters: string) => {
  return (
    await api.get(`/api/v1/orders?page=${page}&limit=${limit}&${filters}`)
  ).data;
};

export default function OrderListingPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const currentPage = parseInt(searchParams.get("page") ?? "1");
  const pageSize = usePageSize();

  const { isFetching, error, data, refetch } = useQuery<
    IResponse<IOrderList[]>,
    AxiosError<IError>
  >({
    queryKey: ["orders-list", currentPage, pageSize, searchParams.toString()],
    queryFn: () =>
      getOrderList(currentPage, pageSize, searchParams.toString()),
  });

  // Ticked orders for the bulk invoice download: order_id → order_number, in
  // the order they were ticked. Kept across pages, so a day's orders can be
  // gathered from several pages into one pdf.
  const [selected, setSelected] = useState<Map<number, string>>(new Map());

  const toggleOrder = (order: IOrderList, checked: boolean) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (checked) next.set(order.order_id, order.order_number);
      else next.delete(order.order_id);
      return next;
    });
  };

  const pageOrders = data?.data ?? [];
  const allOnPageSelected =
    pageOrders.length > 0 &&
    pageOrders.every((order) => selected.has(order.order_id));

  const togglePage = (checked: boolean) => {
    setSelected((prev) => {
      const next = new Map(prev);
      pageOrders.forEach((order) => {
        if (checked) next.set(order.order_id, order.order_number);
        else next.delete(order.order_id);
      });
      return next;
    });
  };

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <OrderFilters />
      </div>
      <BulkInvoiceBar
        selected={selected}
        onClear={() => setSelected(new Map())}
        onDone={() => refetch()}
      />
      <LoadingHandler
        error={error}
        loading={isFetching}
        length={data?.data.length}
      >
        <ScrollArea className="w-full whitespace-nowrap pb-3.5">
          <Table className="w-max">
            <TableHeader>
              <TableRow className="*:min-w-52 bg-green-600 hover:!bg-green-600 *:text-white">
                <TableHead className="sticky top-0 left-0 z-20 min-w-64">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      className="border-white"
                      title="Select every order on this page"
                      checked={allOnPageSelected}
                      onCheckedChange={(checked) => togglePage(checked === true)}
                    />
                    ORDER DETAILS
                  </div>
                </TableHead>
                <TableHead>TOTAL AMOUNT</TableHead>
                <TableHead>PAYMENT MODE</TableHead>
                <TableHead>PAYMENT STATUS</TableHead>
                <TableHead>ORDER STATUS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.data?.map((order) => (
                <TableRow key={order.order_id}>
                  <TableCell>
                    <div className="flex items-center gap-1.5 font-medium">
                      <Checkbox
                        title="Select for bulk invoice download"
                        checked={selected.has(order.order_id)}
                        onCheckedChange={(checked) =>
                          toggleOrder(order, checked === true)
                        }
                      />
                      <Hash size={13} className="text-gray-500" />
                      {order.order_number}
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <User size={13} className="text-gray-500" />
                      {order.user_name}
                      {/* There is no account behind a guest order, so the only
                          way to reach this customer is the address on it. */}
                      {order.is_guest_order ? (
                        <span
                          title="Placed without an account"
                          className="rounded bg-amber-100 text-amber-700 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5"
                        >
                          Guest
                        </span>
                      ) : null}
                      {/* Only ever seen in the Drafts view, where it is the
                          reminder that none of these rows count anywhere. */}
                      {order.is_draft ? (
                        <span
                          title="Parked by staff: hidden from the customer and left out of the dashboard"
                          className="rounded bg-gray-200 text-gray-700 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5"
                        >
                          Draft
                        </span>
                      ) : null}
                    </div>
                    {order.is_guest_order && order.user_email ? (
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Mail size={13} className="text-gray-500" />
                        {order.user_email}
                      </div>
                    ) : null}
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <Calendar size={13} className="text-gray-500" />
                      {order.order_date}
                      {order.order_time ? (
                        <span className="text-gray-500">
                          at {order.order_time}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-3.5 pt-1">
                      <Link
                        to={`/orders/${order.order_id}`}
                        className="underline text-green-600 cursor-pointer flex items-center gap-1"
                      >
                        Open
                        <ExternalLink size={12} />
                      </Link>
                      {order.invoice_avilable && order.invoice_url ? (
                        <Link
                          to={order.invoice_url}
                          target="__blank"
                          className="underline text-red-600 cursor-pointer flex items-center gap-1"
                        >
                          Invoice
                          <Download size={12} />
                        </Link>
                      ) : null}
                      <Link
                        to={order.payment_slip_url}
                        target="__blank"
                        className="underline text-blue-600 cursor-pointer flex items-center gap-1"
                      >
                        Payment slip
                        <Download size={12} />
                      </Link>
                    </div>

                    <OrderDocumentActions
                      order={order}
                      onGenerated={() => refetch()}
                    />
                  </TableCell>
                  <TableCell>{order.total_amount}</TableCell>
                  <TableCell>
                    {order.payment_method == PAYMENT_METHOD_COD ? (
                      <span className="inline-block px-3.5 py-1 rounded-full bg-orange-600 text-white shadow-2xl">
                        COD
                      </span>
                    ) : order.payment_method == PAYMENT_METHOD_ONLINE ? (
                      <span className="inline-block px-3.5 py-1 rounded-full bg-indigo-600 text-white shadow-2xl">
                        Online
                      </span>
                    ) : (
                      <span className="inline-block px-3.5 py-1 rounded-full bg-gray-500 text-white shadow-2xl">
                        {order.payment_method ?? "Unknown"}
                      </span>
                    )}
                  </TableCell>
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
