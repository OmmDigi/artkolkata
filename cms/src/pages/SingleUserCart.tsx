import LoadingHandler from "@/middleware/LoadingHandler";
import type { IError, IResponse, IUserCart, IUserCartItem } from "@/types";
import { api } from "@/utils/api";
import { useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { Link } from "react-router-dom";

const getUserCart = async (userid: string) => {
  return (await api.get(`/api/v1/cart/user/${userid}`)).data;
};

// what the customer picked on the variant, "Color: Red, Size: M"
const variationLabel = (item: IUserCartItem) =>
  (item.variations ?? [])
    .map((variation) => `${variation.name}: ${variation.value}`)
    .join(", ");

export default function SingleUserCart({ userid }: { userid: string }) {
  const { error, data, isFetching } = useQuery<
    IResponse<IUserCart>,
    AxiosError<IError>
  >({
    queryKey: ["get-user-cart", userid],
    queryFn: () => getUserCart(userid),
  });

  const cart = data?.data;

  return (
    <LoadingHandler
      loading={isFetching}
      error={error}
      length={cart?.items.length}
      noDataMsg="Cart is empty"
    >
      {/* the abandoned-cart signal : how much is sitting there right now */}
      <div className="mb-4 flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm">
        <span>
          {cart?.total_quantity ?? 0} item
          {(cart?.total_quantity ?? 0) === 1 ? "" : "s"} in {cart?.total_items ?? 0}{" "}
          line{(cart?.total_items ?? 0) === 1 ? "" : "s"}
        </span>
        <span className="font-semibold">
          ₹{(cart?.cart_total ?? 0).toFixed(2)}
        </span>
      </div>

      <ul className="space-y-4">
        {cart?.items.map((item) => (
          <li key={item.cart_id} className="flex items-start gap-3">
            {item.image ? (
              <img
                onClick={() => {
                  window.open(item.image ?? "");
                }}
                src={item.image}
                alt=""
                className="cursor-pointer aspect-square w-16 object-cover shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.1),0px_1px_0px_0px_rgba(25,28,33,0.02),0px_0px_0px_1px_rgba(25,28,33,0.08)] rounded-md"
              />
            ) : (
              <div className="aspect-square w-16 rounded-md bg-gray-100" />
            )}

            <div className="flex-1 space-y-1">
              <Link
                to={`/products/${item.product_id}`}
                className="font-medium line-clamp-2 hover:underline"
              >
                {item.product_name}
              </Link>

              {variationLabel(item) ? (
                <p className="text-sm text-gray-600">{variationLabel(item)}</p>
              ) : null}

              <div className="text-sm text-gray-600 space-x-2">
                <span>
                  ₹{item.unit_price.toFixed(2)} × {item.quantity}
                </span>
                <span className="font-medium text-gray-900">
                  ₹{item.line_total.toFixed(2)}
                </span>
                {item.category_name ? <span>{item.category_name}</span> : null}
              </div>

              {item.product_status != 1 ? (
                <span className="inline-block px-2.5 py-0.5 text-xs rounded-full bg-red-700 text-white">
                  Private
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </LoadingHandler>
  );
}
