import type { IBanner, IError, IResponse, ISiteInfo } from "@/types";
import { api } from "@/utils/api";
import { useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { useCallback } from "react";
import { useDoMutation } from "./useDoMutation";

export const SITE_INFO_DEFAULTS: ISiteInfo = {
  site_logo: "",
  site_logo_alt: "",
  contact_emails: [],
  contact_phones: [],
  site_addresses: [],
};

export const useSiteInfo = () => {
  const { data, isFetching, error, refetch } = useQuery<
    IResponse<ISiteInfo>,
    AxiosError<IError>
  >({
    queryKey: ["site-info"],
    queryFn: async () => (await api.get("/api/v1/settings/site-info")).data,
  });

  const { isLoading, mutate } = useDoMutation(() => {
    refetch();
  });

  const saveSiteInfo = useCallback(
    (siteInfo: ISiteInfo, onSuccess?: () => void) => {
      mutate({
        apiPath: "/api/v1/settings/site-info",
        method: "post",
        formData: siteInfo,
        onSuccess() {
          onSuccess?.();
        },
      });
    },
    [mutate],
  );

  return {
    siteInfo: data?.data ?? SITE_INFO_DEFAULTS,
    isSiteInfoFetching: isFetching,
    siteInfoError: error,
    refetchSiteInfo: refetch,
    isSavingSiteInfo: isLoading,
    saveSiteInfo,
  };
};

interface IBannerMutParams {
  type: "add" | "update" | "delete" | "reorder";
  id?: number;
  data?: any;
  onSuccess?: (data: IResponse<any>) => void;
}

export const useBanners = () => {
  const { data, isFetching, error, refetch } = useQuery<
    IResponse<IBanner[]>,
    AxiosError<IError>
  >({
    queryKey: ["site-banners"],
    queryFn: async () => (await api.get("/api/v1/settings/banners")).data,
  });

  const { isLoading, mutate } = useDoMutation(() => {
    refetch();
  });

  const mutateBanner = useCallback(
    (params: IBannerMutParams) => {
      const onSuccess = (response: IResponse<any>) =>
        params.onSuccess?.(response);

      if (params.type === "delete") {
        mutate({
          apiPath: "/api/v1/settings/banners",
          method: "delete",
          id: params.id,
          onSuccess,
        });
        return;
      }

      if (params.type === "update") {
        mutate({
          apiPath: `/api/v1/settings/banners/${params.id}`,
          method: "put",
          formData: params.data,
          onSuccess,
        });
        return;
      }

      if (params.type === "reorder") {
        mutate({
          apiPath: "/api/v1/settings/banners/reorder",
          method: "put",
          formData: params.data,
          onSuccess,
        });
        return;
      }

      mutate({
        apiPath: "/api/v1/settings/banners",
        method: "post",
        formData: params.data,
        onSuccess,
      });
    },
    [mutate],
  );

  return {
    banners: data?.data ?? [],
    isBannerFetching: isFetching,
    bannerError: error,
    refetchBanners: refetch,
    isMutatingBanner: isLoading,
    mutateBanner,
  };
};
