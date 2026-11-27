import type { IError, IResponse, IVideo, TVideoInput } from "@/types";
import { api } from "@/utils/api";
import { useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { useCallback, useMemo } from "react";
import { useDoMutation } from "./useDoMutation";

type TOnSuccess = (data: IResponse<unknown>) => void;

type TVideoMutParams =
  | { type: "add"; data: TVideoInput; onSuccess?: TOnSuccess }
  | { type: "update"; id: number; data: TVideoInput; onSuccess?: TOnSuccess }
  | { type: "delete"; id: number; onSuccess?: TOnSuccess }
  | {
      type: "reorder";
      data: { videos: { id: number; position: number }[] };
      onSuccess?: TOnSuccess;
    };

interface IProps {
  /** runs when any change is refused, e.g. to undo an order dragged locally */
  onMutationError?: () => void;
}

export const useVideos = (props?: IProps) => {
  const { data, isLoading, isFetching, error, refetch } = useQuery<
    IResponse<IVideo[]>,
    AxiosError<IError>
  >({
    queryKey: ["get-video-list"],
    queryFn: async () => (await api.get("/api/v1/videos")).data,
  });

  // the same array until the server sends a different list, so it is safe to
  // depend on in an effect
  const videos = useMemo(() => data?.data ?? [], [data]);

  const { isLoading: isMutating, mutate } = useDoMutation(
    () => {
      refetch();
    },
    () => {
      props?.onMutationError?.();
    },
  );

  // the row moving is the confirmation, a toast on every drag only piles up.
  // A refused order still shows its error.
  const { isLoading: isReordering, mutate: mutateQuietly } = useDoMutation(
    () => {
      refetch();
    },
    () => {
      props?.onMutationError?.();
    },
    false,
    true,
  );

  const mutateVideo = useCallback(
    (params: TVideoMutParams) => {
      const onSuccess: TOnSuccess = (response) => params.onSuccess?.(response);

      switch (params.type) {
        case "add":
          mutate({
            apiPath: "/api/v1/videos",
            method: "post",
            formData: params.data,
            onSuccess,
          });
          return;
        case "update":
          mutate({
            apiPath: `/api/v1/videos/${params.id}`,
            method: "put",
            formData: params.data,
            onSuccess,
          });
          return;
        case "delete":
          mutate({
            apiPath: "/api/v1/videos",
            method: "delete",
            id: params.id,
            onSuccess,
          });
          return;
        case "reorder":
          mutateQuietly({
            apiPath: "/api/v1/videos/reorder",
            method: "put",
            formData: params.data,
            onSuccess,
          });
          return;
      }
    },
    [mutate, mutateQuietly],
  );

  return {
    videos,
    isVideoLoading: isLoading,
    isVideoFetching: isFetching,
    videoError: error,
    refetchVideos: refetch,
    isMutatingVideo: isMutating || isReordering,
    mutateVideo,
  };
};
