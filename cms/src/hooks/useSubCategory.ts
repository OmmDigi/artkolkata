import type { IError, IResponse, ISubCategory } from "@/types";
import { api } from "@/utils/api";
import { useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";

const getSubCategoryList = async (page: number, search?: string, limit?: number) => {
  const urlSearchParams = new URLSearchParams();
  urlSearchParams.set("page", page.toString());
  if (limit) {
    urlSearchParams.set("limit", limit.toString());
  }
  if (search) {
    urlSearchParams.set("search", search);
  }
  return (
    await api.get(`/api/v1/products/sub-category?${urlSearchParams.toString()}`)
  ).data;
};

interface IProps {
  page?: number;
  search?: string;
  limit?: number;
}

export const useSubCategory = (props?: IProps) => {
  const { data, isFetching, error, refetch } = useQuery<
    IResponse<ISubCategory[]>,
    AxiosError<IError>
  >({
    queryKey: ["get-sub-category-list", props?.page ?? 1, props?.search ?? "", props?.limit],
    queryFn: () => getSubCategoryList(props?.page ?? 1, props?.search, props?.limit),
  });

  return {
    isSubCategoryFetching: isFetching,
    subCategoryError: error,
    subCategoryData: data?.data ?? [],
    refetchSubCategory: refetch,
  };
};
