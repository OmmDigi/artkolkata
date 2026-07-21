import type { IError, IResponse, ISubCategory } from "@/types";
import { api } from "@/utils/api";
import { useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";

const getSubCategoryList = async (page: number) => {
  return (await api.get(`/api/v1/products/sub-category?page=${page}`)).data;
};

interface IProps {
  page?: number;
}

export const useSubCategory = (props?: IProps) => {
  const { data, isFetching, error, refetch } = useQuery<
    IResponse<ISubCategory[]>,
    AxiosError<IError>
  >({
    queryKey: ["get-sub-category-list", props?.page ?? 1],
    queryFn: () => getSubCategoryList(props?.page ?? 1),
  });

  return {
    isSubCategoryFetching: isFetching,
    subCategoryError: error,
    subCategoryData: data?.data ?? [],
    refetchSubCategory: refetch,
  };
};
