import type { IBlog, IError, IResponse } from "@/types";
import { api } from "@/utils/api";
import { useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { useCallback } from "react";
import { useDoMutation } from "./useDoMutation";

const getBlogList = async (page: number, status?: string) => {
  const params = new URLSearchParams();
  params.set("page", page.toString());
  if (status) params.set("status", status);
  return (await api.get(`/api/v1/blogs?${params.toString()}`)).data;
};

interface IProps {
  page?: number;
  status?: string;
  enabledFetching?: boolean;
  depandencyArray?: any[];
}

interface IBlogMutParams {
  type: "add" | "update" | "delete";
  id?: number;
  data?: any;
  onSuccess?: (data: IResponse<any>) => void;
  onError?: () => void;
}

export const useBlog = (props?: IProps) => {
  const { data, isFetching, error, refetch } = useQuery<
    IResponse<IBlog[]>,
    AxiosError<IError>
  >({
    queryKey: ["get-blog-list", props?.depandencyArray ?? []],
    queryFn: () => getBlogList(props?.page ?? 1, props?.status),
    enabled: props?.enabledFetching ?? true,
  });

  const { isLoading, mutate } = useDoMutation(() => {
    refetch();
  });

  const mutateBlog = useCallback((params?: IBlogMutParams) => {
    if (params?.type === "delete") {
      mutate({
        apiPath: "/api/v1/blogs",
        method: "delete",
        id: params.id,
        onSuccess(data) { params?.onSuccess?.(data); },
        onError() { params?.onError?.(); },
      });
      return;
    }

    if (params?.type === "update") {
      mutate({
        apiPath: `/api/v1/blogs/${params.id}`,
        method: "put",
        formData: params.data,
        onSuccess(data) { params?.onSuccess?.(data); },
        onError() { params?.onError?.(); },
      });
      return;
    }

    if (params?.type === "add") {
      mutate({
        apiPath: "/api/v1/blogs",
        method: "post",
        formData: params.data,
        onSuccess(data) { params?.onSuccess?.(data); },
        onError() { params?.onError?.(); },
      });
      return;
    }
  }, []);

  return {
    isBlogFetching: isFetching,
    blogError: error,
    blogData: data?.data ?? [],
    totalPage: data?.totalPage ?? 0,
    refetchBlog: refetch,
    isMutating: isLoading,
    mutateBlog,
  };
};
