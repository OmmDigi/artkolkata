import type {
  IAnalyticsOrderStatus,
  IAnalyticsTimeseries,
  IAnalyticsTopProducts,
  IDashboardKpi,
  IError,
  IResponse,
  TAnalyticsPreset,
} from "@/types";
import { api } from "@/utils/api";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";

/**
 * The four dashboard endpoints, all scoped by the same window.
 *
 * Every hook here takes the identical IAnalyticsFilter and puts it in its query
 * key, so changing the range refetches all four together and the cards, the
 * chart and the tables can never end up describing different slices of time.
 */

export interface IAnalyticsFilter {
  preset: TAnalyticsPreset;
  /** YYYY-MM-DD, only read when preset is "custom" */
  startDate?: string;
  endDate?: string;
}

/**
 * A custom range is only a valid request once BOTH dates are picked — the user
 * is mid-selection until then, and firing a request at "custom" with no dates
 * would just paint a 400 over the numbers they are still looking at.
 */
export const isFilterReady = (filter: IAnalyticsFilter) =>
  filter.preset !== "custom" || Boolean(filter.startDate && filter.endDate);

const buildQuery = (filter: IAnalyticsFilter, extra?: Record<string, string>) => {
  const params = new URLSearchParams();
  params.set("range", filter.preset);

  if (filter.preset === "custom" && filter.startDate && filter.endDate) {
    params.set("start_date", filter.startDate);
    params.set("end_date", filter.endDate);
  }

  Object.entries(extra ?? {}).forEach(([key, value]) => params.set(key, value));

  return params.toString();
};

/** what the query key has to contain for two filters to count as the same window */
const filterKey = (filter: IAnalyticsFilter) => [
  filter.preset,
  filter.startDate ?? null,
  filter.endDate ?? null,
];

const fetchAnalytics = async <T>(path: string, query: string): Promise<IResponse<T>> =>
  (await api.get(`/api/v1/analytics/${path}?${query}`)).data;

/**
 * keepPreviousData rather than a spinner: switching from 30 days to 7 holds the
 * last render while the new one loads, so the page keeps its shape and nothing
 * jumps. The caller dims it instead — see DashboardPage.
 */
const analyticsQueryOptions = (filter: IAnalyticsFilter) => ({
  enabled: isFilterReady(filter),
  placeholderData: keepPreviousData,
});

export const useDashboardKpi = (filter: IAnalyticsFilter) => {
  const { data, isFetching, isPending, error, refetch } = useQuery<
    IResponse<IDashboardKpi>,
    AxiosError<IError>
  >({
    queryKey: ["analytics-kpi", ...filterKey(filter)],
    queryFn: () => fetchAnalytics<IDashboardKpi>("kpi", buildQuery(filter)),
    ...analyticsQueryOptions(filter),
  });

  return {
    kpiData: data?.data,
    isKpiFetching: isFetching,
    isKpiPending: isPending,
    kpiError: error,
    refetchKpi: refetch,
  };
};

export const useSalesTimeseries = (filter: IAnalyticsFilter) => {
  const { data, isFetching, isPending, error, refetch } = useQuery<
    IResponse<IAnalyticsTimeseries>,
    AxiosError<IError>
  >({
    queryKey: ["analytics-timeseries", ...filterKey(filter)],
    queryFn: () =>
      fetchAnalytics<IAnalyticsTimeseries>("timeseries", buildQuery(filter)),
    ...analyticsQueryOptions(filter),
  });

  return {
    timeseriesData: data?.data,
    isTimeseriesFetching: isFetching,
    isTimeseriesPending: isPending,
    timeseriesError: error,
    refetchTimeseries: refetch,
  };
};

export const useTopProducts = (filter: IAnalyticsFilter, limit = 8) => {
  const { data, isFetching, isPending, error, refetch } = useQuery<
    IResponse<IAnalyticsTopProducts>,
    AxiosError<IError>
  >({
    queryKey: ["analytics-top-products", ...filterKey(filter), limit],
    queryFn: () =>
      fetchAnalytics<IAnalyticsTopProducts>(
        "top-products",
        buildQuery(filter, { limit: limit.toString() }),
      ),
    ...analyticsQueryOptions(filter),
  });

  return {
    topProducts: data?.data?.products ?? [],
    isTopProductsFetching: isFetching,
    isTopProductsPending: isPending,
    topProductsError: error,
    refetchTopProducts: refetch,
  };
};

export const useOrderStatusBreakdown = (filter: IAnalyticsFilter) => {
  const { data, isFetching, isPending, error, refetch } = useQuery<
    IResponse<IAnalyticsOrderStatus>,
    AxiosError<IError>
  >({
    queryKey: ["analytics-order-status", ...filterKey(filter)],
    queryFn: () =>
      fetchAnalytics<IAnalyticsOrderStatus>("order-status", buildQuery(filter)),
    ...analyticsQueryOptions(filter),
  });

  return {
    breakdownData: data?.data,
    isBreakdownFetching: isFetching,
    isBreakdownPending: isPending,
    breakdownError: error,
    refetchBreakdown: refetch,
  };
};
