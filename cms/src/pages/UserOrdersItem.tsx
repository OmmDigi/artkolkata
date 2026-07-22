import { Badge } from "@/components/ui/badge";
import LoadingHandler from "@/middleware/LoadingHandler";
import type { IError, IResponse, IUserOrders } from "@/types";
import { api } from "@/utils/api";
import { useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { Link } from "react-router-dom";

const getSingleUserOrderdItems = async (userid: string) => {
  return (await api.get(`/api/v1/users/orders?userid=${userid}`)).data;
};

export default function UserOrdersItem({ userid }: { userid: string }) {
  const { error, data, isFetching } = useQuery<
    IResponse<IUserOrders[]>,
    AxiosError<IError>
  >({
    queryKey: ["get-users-order", userid],
    queryFn: () => getSingleUserOrderdItems(userid),
  });

  return (
    <LoadingHandler loading = {isFetching} error={error} length={data?.data.length}>
      <ul className="space-y-6">
      {data?.data.map((order, index) => (
        <li key={order.order_id} className="space-y-6">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-xl flex-1">
              {index + 1}) {order.order_number}
            </h2>
            <Link to={`/orders/${order.order_id}`} className="underline">
              View Order
            </Link>
          </div>
          <ul className="space-y-6">
            {order.ordered_products.map((orderItem) => (
              <li
                key={orderItem.order_item_id}
                className="flex items-start gap-3.5"
              >
                <img
                  onClick={() => {
                    window.open(orderItem.images?.image);
                  }}
                  src={orderItem.images?.image}
                  alt=""
                  className="cursor-pointer aspect-square w-28 object-cover shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.1),0px_1px_0px_0px_rgba(25,28,33,0.02),0px_0px_0px_1px_rgba(25,28,33,0.08)] rounded-md"
                />

                <div className="space-y-1.5">
                  <h2>{orderItem.product_name}</h2>
                  <div className="flex items-center gap-2.5 flex-wrap mb-2.5">
                    {orderItem.sku ? (
                      <Badge>Variant: {orderItem.sku}</Badge>
                    ) : null}
                    {orderItem.price ? (
                      <Badge>₹{orderItem.price} Each</Badge>
                    ) : null}
                    {orderItem.quantity ? (
                      <Badge>Quantity: {orderItem.quantity}</Badge>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
    </LoadingHandler>
  );
}
