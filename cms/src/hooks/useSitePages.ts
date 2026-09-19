import type { IError, IResponse, ISitePage } from "@/types";
import type { OutputData } from "@editorjs/editorjs";
import { api } from "@/utils/api";
import { useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { useCallback } from "react";
import { useDoMutation } from "./useDoMutation";

export interface ISitePagePayload {
  content_json: OutputData;
  meta_title: string;
  meta_description: string;
  status: "draft" | "published";
}

/**
 * The legal pages (terms, privacy, returns and refunds). The list comes back
 * in one call — the api has no create or delete, so this hook only reads the
 * fixed set and saves one page at a time by its slug.
 */
export const useSitePages = () => {
  const { data, isFetching, error, refetch } = useQuery<
    IResponse<ISitePage[]>,
    AxiosError<IError>
  >({
    queryKey: ["site-pages"],
    queryFn: async () => (await api.get("/api/v1/pages")).data,
  });

  const { isLoading, mutate } = useDoMutation(() => {
    refetch();
  });

  const saveSitePage = useCallback(
    (slug: string, payload: ISitePagePayload, onSuccess?: () => void) => {
      mutate({
        apiPath: `/api/v1/pages/${slug}`,
        method: "put",
        formData: payload,
        onSuccess() {
          onSuccess?.();
        },
      });
    },
    [mutate],
  );

  return {
    sitePages: data?.data ?? [],
    isSitePagesFetching: isFetching,
    sitePagesError: error,
    refetchSitePages: refetch,
    isSavingSitePage: isLoading,
    saveSitePage,
  };
};
