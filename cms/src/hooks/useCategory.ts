import type { ICategory, IError, IResponse } from "@/types";
import { api } from "@/utils/api";
import { useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";

const getCategoryList = async (page: number, limit: number, search?: string) => {
  const urlSearchParams = new URLSearchParams();
  urlSearchParams.set("page", page.toString());
  urlSearchParams.set("limit", limit.toString());
  if (search) {
    urlSearchParams.set("search", search);
  }
  return (
    await api.get(`/api/v1/products/category?${urlSearchParams.toString()}`)
  ).data;
};

interface IProps {
  page?: number;
  limit?: number;
  search?: string;
}

export const useCategory = (props?: IProps) => {
  const { data, isFetching, error, refetch } = useQuery<
    IResponse<ICategory[]>,
    AxiosError<IError>
  >({
    queryKey: ["get-category-list", props?.page ?? 1, props?.search ?? ""],
    queryFn: () =>
      getCategoryList(props?.page ?? 1, props?.limit ?? 10, props?.search),
  });

  return {
    isCategoryFetching: isFetching,
    categoryError: error,
    categoryData: data?.data ?? [],
    refetchCategory: refetch,
  };
};
