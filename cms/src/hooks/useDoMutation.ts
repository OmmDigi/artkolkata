import { AxiosError } from "axios";
import { toast } from "react-toastify";
import { useMutation } from "@tanstack/react-query";
import type { IResponse } from "@/types";
import { api } from "@/utils/api";

type ParamsType = {
  apiPath: string;
  method: "post" | "put" | "delete" | "patch";
  id?: number;
  formData?: FormData | Record<string, any>;
  headers?: Record<string, string>;
  onSuccess?: (data: IResponse<any>) => void;
  onError?: () => void;
};

async function submitInformationToServer<T>(params: ParamsType) {
  const response = await api.request({
    url: `${params.apiPath}${params.id ? `/${params.id}` : ""}`,
    method: params.method,
    headers: {
      "Content-Type" : "application/json",
      ...params.headers,
    },
    data: params.formData,
  });

  return {
    onSuccess: params.onSuccess,
    response: response.data as IResponse<T>,
  };
}

export const useDoMutation = <T = any>(
  onGSuccess?: (data: IResponse<T>) => void,
  onGError?: (error: AxiosError<IResponse>) => void,
  hideToastError?: boolean,
  hideToastSuccess?: boolean
) => {
  const { mutate, isPending } = useMutation<
    { onSuccess?: (data: IResponse<T>) => void; response: IResponse<T> }, // TData
    AxiosError<IResponse>, // TError
    ParamsType // TVariables
  >({
    mutationFn: submitInformationToServer<T>,
    onSuccess: (data) => {
      onGSuccess?.(data.response);
      data.onSuccess?.(data.response);
      if (!hideToastSuccess) toast.success(data.response.message);
    },
    onError: (error) => {
      onGError?.(error);
      if (!hideToastError)
        toast.error(error.response?.data?.message || "Something went wrong");
    },
  });

  return { mutate, isLoading: isPending };
};
