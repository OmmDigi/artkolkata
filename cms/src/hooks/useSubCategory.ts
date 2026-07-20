import type { ICategory, IError, IResponse } from "@/types";
import { api } from "@/utils/api";
import { useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";

const getCategoryList = async (page: number) => {
  return (await api.get(`/api/v1/products/sub-category?page=${page}`)).data;
};

interface IProps {
  page?: number;
}

export const useSubCategory = (props?: IProps) => {
  const { data, isFetching, error, refetch } = useQuery<
    IResponse<ICategory[]>,
    AxiosError<IError>
  >({
    queryKey: ["get-sub-category-list", props?.page ?? 1],
    queryFn: () => getCategoryList(props?.page ?? 1),
  });

  return {
    isSubCategoryFetching: isFetching,
    subCategoryError: error,
    subCategoryData: data?.data ?? [],
    refetchSubCategory: refetch,
  };
};
