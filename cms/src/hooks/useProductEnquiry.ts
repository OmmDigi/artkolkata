import type {
  ICategory,
  IError,
  IProductEnquiry,
  IResponse,
  TProductEnquiryStatus,
  TProductEnquiryType,
} from "@/types";
import { api } from "@/utils/api";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { useCallback } from "react";
import { useDoMutation } from "./useDoMutation";

export const PRODUCT_ENQUIRY_STATUSES: {
  value: TProductEnquiryStatus;
  text: string;
}[] = [
  { value: "new", text: "New" },
  { value: "contacted", text: "Contacted" },
  { value: "closed", text: "Closed" },
];

export const PRODUCT_ENQUIRY_TYPES: {
  value: TProductEnquiryType;
  text: string;
}[] = [
  { value: "bulk_order", text: "Bulk Order" },
  { value: "custom_frp_mould", text: "Custom FRP Mould" },
];

interface IFilters {
  page: number;
  limit: number;
  status?: TProductEnquiryStatus;
  type?: TProductEnquiryType;
  categoryId?: number;
  search?: string;
}

const getProductEnquiries = async (filters: IFilters) => {
  const params = new URLSearchParams();
  params.set("page", filters.page.toString());
  params.set("limit", filters.limit.toString());
  if (filters.status) params.set("status", filters.status);
  if (filters.type) params.set("enquiry_type", filters.type);
  if (filters.categoryId) params.set("category_id", filters.categoryId.toString());
  if (filters.search) params.set("search", filters.search);
  return (await api.get(`/api/v1/website/product-enquiry?${params.toString()}`))
    .data;
};

export const useProductEnquiries = (filters: IFilters) => {
  const { data, isLoading, isFetching, error, refetch } = useQuery<
    IResponse<IProductEnquiry[]>,
    AxiosError<IError>
  >({
    queryKey: [
      "get-product-enquiries",
      filters.page,
      filters.limit,
      filters.status ?? "",
      filters.type ?? "",
      filters.categoryId ?? 0,
      filters.search ?? "",
    ],
    queryFn: () => getProductEnquiries(filters),
    // the table keeps showing the last page while a filter or page change loads
    placeholderData: keepPreviousData,
  });

  const { isLoading: isMutating, mutate } = useDoMutation(() => {
    refetch();
  });

  const updateStatus = useCallback(
    (id: number, status: TProductEnquiryStatus) =>
      mutate({
        apiPath: `/api/v1/website/product-enquiry/${id}/status`,
        method: "patch",
        formData: { status },
      }),
    [mutate],
  );

  const deleteEnquiry = useCallback(
    (id: number) =>
      mutate({
        apiPath: "/api/v1/website/product-enquiry",
        method: "delete",
        id,
      }),
    [mutate],
  );

  return {
    enquiries: data?.data ?? [],
    totalPage: data?.totalPage ?? 0,
    isEnquiryLoading: isLoading,
    isEnquiryFetching: isFetching,
    enquiryError: error,
    isMutating,
    updateStatus,
    deleteEnquiry,
  };
};

/**
 * Every category for the filter: hidden ones too for staff who can also manage
 * categories, the shop's visible ones for everyone else. Its own query key so
 * it never shares a cache entry with the paged Categories page.
 */
export const useEnquiryCategories = () => {
  const { data } = useQuery<IResponse<ICategory[]>, AxiosError<IError>>({
    queryKey: ["product-enquiry-categories"],
    queryFn: async () =>
      (await api.get("/api/v1/products/category?page=1&limit=-1")).data,
    staleTime: 5 * 60 * 1000,
  });

  return data?.data ?? [];
};
