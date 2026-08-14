import type { ICategory, IError, IResponse } from "@/types";
import { api } from "@/utils/api";
import { useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";

const getCategoryList = async (page: number, limit : number) => {
  return (await api.get(`/api/v1/products/category?page=${page}&limit=${limit}`)).data;
};

interface IProps {
  page?: number;
  limit?:number;
}

export const useCategory = (props?: IProps) => {
  const { data, isFetching, error, refetch } = useQuery<
    IResponse<ICategory[]>,
    AxiosError<IError>
  >({
    queryKey: ["get-category-list", props?.page ?? 1],
    queryFn: () => getCategoryList(props?.page ?? 1, props?.limit ?? 10),
  });

  return {
    isCategoryFetching: isFetching,
    categoryError: error,
    categoryData: data?.data ?? [],
    refetchCategory: refetch,
  };
};
