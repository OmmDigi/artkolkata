import type { IError, IProducts, IResponse } from "@/types";
import { api } from "@/utils/api";
import { useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { useDoMutation } from "./useDoMutation";
import { useCallback } from "react";

const getProductList = async (
  page: number,
  productId?: number,
  categoryId?: string,
  status?: string
) => {
  const urlSearchParams = new URLSearchParams();
  urlSearchParams.set("page", page.toString());
  if (productId) {
    urlSearchParams.set("product_id", productId.toString());
  }
  if (categoryId) {
    urlSearchParams.set("category", categoryId.toString());
  }
  if (status) {
    urlSearchParams.set("status", status);
  }
  return (await api.get(`/api/v1/products?${urlSearchParams.toString()}`)).data;
};

interface IProps {
  page?: number;
  filter?: {
    productId?: number;
    categoryId?: string;
    status?: string;
  };
  enabledFetching?: boolean;
  depandencyArray?: any[];
}

interface IPropsProductMutParams {
  type: "delete" | "add" | "update";
  id?: number;
  data?: any;
  onSuccess?: (data: IResponse<any>) => void;
  onError?: () => void;
}

export const useProduct = (props?: IProps) => {
  const { data, isFetching, error, refetch, dataUpdatedAt } = useQuery<
    IResponse<IProducts[]>,
    AxiosError<IError>
  >({
    queryKey: ["get-product-list", ...props?.depandencyArray ?? ""],
    queryFn: () =>
      getProductList(
        props?.page ?? 1,
        props?.filter?.productId,
        props?.filter?.categoryId,
        props?.filter?.status
      ),
    enabled: props?.enabledFetching ?? true,
  });

  const { isLoading, mutate } = useDoMutation(() => {
    refetch();
  });

  const mutateProduct = useCallback((props?: IPropsProductMutParams) => {
    if (props?.type === "delete") {
      mutate({
        apiPath: "/api/v1/products",
        method: "delete",
        id: props.id,
        onSuccess(data) {
          props?.onSuccess?.(data);
        },
        onError() {
          props?.onError?.();
        },
      });
      return;
    }

    if (props?.type === "update") {
      console.log(props.type);
      mutate({
        apiPath: "/api/v1/products",
        method: "put",
        formData: props.data,
        onSuccess(data) {
          props?.onSuccess?.(data);
        },
        onError() {
          props?.onError?.();
        },
      });
      return;
    }

    if (props?.type === "add") {
      mutate({
        apiPath: "/api/v1/products",
        method: "post",
        formData: props.data,
        onSuccess(data) {
          props?.onSuccess?.(data);
        },
        onError() {
          props?.onError?.();
        },
      });
      return;
    }
  }, []);

  return {
    isProductFetching: isFetching,
    productError: error,
    productData: data?.data ?? [],
    refetchProduct: refetch,
    isMuting: isLoading,
    mutateProduct,
    dataUpdatedAt
  };
};
