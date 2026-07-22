import type { IError, IInquiry, IResponse } from "@/types";
import { api } from "@/utils/api";
import { useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";

interface IProps {
  page?: number;
  enabledFetching?: boolean;
  depandencyArray?: any[];
}

const getInquiryList = async (page: number, inquirieId?: number) => {
  const urlSearchParams = new URLSearchParams();
  urlSearchParams.set("page", page.toString());
  if (inquirieId) {
    urlSearchParams.set("inquiry_id", inquirieId.toString());
  }
  return (await api.get(`/api/v1/website/enquiry?${urlSearchParams.toString()}`)).data;
};

export const useInquiry = (props?: IProps) => {
  const { data, isFetching, error, refetch } = useQuery<
    IResponse<IInquiry[]>,
    AxiosError<IError>
  >({
    queryKey: ["get-inquiry-list", props?.depandencyArray ?? []],
    queryFn: () => getInquiryList(props?.page ?? 1),
    enabled: props?.enabledFetching ?? true,
  });

  return {
    isInquiryFetching: isFetching,
    inquiryError: error,
    inquiryData: data?.data ?? [],
    refetchInquiry: refetch,
  };
};
