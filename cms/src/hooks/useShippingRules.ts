import type { IError, IResponse, IShippingRule } from "@/types";
import { api } from "@/utils/api";
import { useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { useCallback } from "react";
import { useDoMutation } from "./useDoMutation";

interface IRuleMutParams {
  type: "add" | "update" | "delete";
  id?: number;
  data?: Record<string, any>;
  onSuccess?: (data: IResponse<any>) => void;
}

export const useShippingRules = () => {
  const { data, isFetching, error, refetch } = useQuery<
    IResponse<IShippingRule[]>,
    AxiosError<IError>
  >({
    queryKey: ["shipping-rules"],
    queryFn: async () => (await api.get("/api/v1/settings/shipping-rules")).data,
  });

  const { isLoading, mutate } = useDoMutation(() => {
    refetch();
  });

  const mutateRule = useCallback(
    (params: IRuleMutParams) => {
      const onSuccess = (response: IResponse<any>) =>
        params.onSuccess?.(response);

      if (params.type === "delete") {
        mutate({
          apiPath: "/api/v1/settings/shipping-rules",
          method: "delete",
          id: params.id,
          onSuccess,
        });
        return;
      }

      if (params.type === "update") {
        mutate({
          apiPath: `/api/v1/settings/shipping-rules/${params.id}`,
          method: "put",
          formData: params.data,
          onSuccess,
        });
        return;
      }

      mutate({
        apiPath: "/api/v1/settings/shipping-rules",
        method: "post",
        formData: params.data,
        onSuccess,
      });
    },
    [mutate],
  );

  return {
    rules: data?.data ?? [],
    isRuleFetching: isFetching,
    ruleError: error,
    refetchRules: refetch,
    isMutatingRule: isLoading,
    mutateRule,
  };
};
