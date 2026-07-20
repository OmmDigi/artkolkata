import type { ICategory, IError, IResponse } from "@/types";
import { api } from "@/utils/api";
import { useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";

const getCategoryList = async (page: number) => {
  return (await api.get(`/api/v1/products/category?page=${page}`)).data;
};

interface IProps {
  page?: number;
}

export const useCategory = (props?: IProps) => {
  const { data, isFetching, error, refetch } = useQuery<
    IResponse<ICategory[]>,
    AxiosError<IError>
  >({
    queryKey: ["get-category-list", props?.page ?? 1],
    queryFn: () => getCategoryList(props?.page ?? 1),
  });

  return {
    isCategoryFetching: isFetching,
    categoryError: error,
    categoryData: data?.data ?? [],
    refetchCategory: refetch,
  };
};
