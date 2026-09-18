import type { IError, IProductTag, IResponse } from "@/types";
import { api } from "@/utils/api";
import { useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";

const getProductTagList = async () =>
  (await api.get("/api/v1/products/tags")).data;

export const useProductTags = () => {
  const { data, isFetching, error, refetch } = useQuery<
    IResponse<IProductTag[]>,
    AxiosError<IError>
  >({
    queryKey: ["get-product-tag-list"],
    queryFn: getProductTagList,
  });

  return {
    isProductTagFetching: isFetching,
    productTagError: error,
    productTagData: data?.data ?? [],
    refetchProductTags: refetch,
  };
};
