import LoadingHandler from "@/middleware/LoadingHandler";
import type { IError, IResponse, IUserWishlistItem } from "@/types";
import { api } from "@/utils/api";
import { useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { Link } from "react-router-dom";

const getUserWishlist = async (userid: string) => {
  return (await api.get(`/api/v1/wishlist/user/${userid}`)).data;
};

// a product with a single price shows one figure, a variant product shows the range
const priceLabel = (item: IUserWishlistItem) => {
  const min = item.min_price ? Number(item.min_price) : null;
  const max = item.max_price ? Number(item.max_price) : null;

  if (min == null) return null;
  if (max == null || min === max) return `₹${min}`;
  return `₹${min} - ₹${max}`;
};

export default function SingleUserWishlist({ userid }: { userid: string }) {
  const { error, data, isFetching } = useQuery<
    IResponse<IUserWishlistItem[]>,
    AxiosError<IError>
  >({
    queryKey: ["get-user-wishlist", userid],
    queryFn: () => getUserWishlist(userid),
  });

  return (
    <LoadingHandler
      loading={isFetching}
      error={error}
      length={data?.data.length}
      noDataMsg="No wishlist item"
    >
      <ul className="space-y-4">
        {data?.data.map((item) => (
          <li key={item.wishlist_id} className="flex items-start gap-3">
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

              <div className="text-sm text-gray-600 space-x-2">
                {priceLabel(item) ? <span>{priceLabel(item)}</span> : null}
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
