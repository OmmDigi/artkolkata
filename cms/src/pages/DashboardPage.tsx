import DashboardFilters from "@/components/dashboard/DashboardFilters";
import KpiCard from "@/components/dashboard/KpiCard";
import OrderBreakdownPanel from "@/components/dashboard/OrderBreakdownPanel";
import RevenueChart from "@/components/dashboard/RevenueChart";
import TopProductsPanel from "@/components/dashboard/TopProductsPanel";
import Section from "@/components/Section";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  isFilterReady,
  useDashboardKpi,
  useOrderStatusBreakdown,
  useSalesTimeseries,
  useTopProducts,
  type IAnalyticsFilter,
} from "@/hooks/useAnalytics";
import type { IError } from "@/types";
import {
  formatCount,
  formatMoney,
  formatMoneyCompact,
  formatPercent,
} from "@/utils/formatAnalytics";
import type { AxiosError } from "axios";
import {
  IndianRupee,
  PackageCheck,
  RotateCcw,
  ShoppingCart,
  Users,
} from "lucide-react";
import { useState } from "react";

/**
 * The admin dashboard.
 *
 * Every panel is scoped by the one filter row at the top, and all four queries
 * carry the same window in their key — so the cards, the chart and the tables
 * are always describing the same slice of time. There is no per-panel range.
 */

const firstError = (
  ...errors: (AxiosError<IError> | null | undefined)[]
): AxiosError<IError> | null => errors.find(Boolean) ?? null;

export default function DashboardPage() {
  const [filter, setFilter] = useState<IAnalyticsFilter>({ preset: "30d" });

  const { kpiData, isKpiFetching, isKpiPending, kpiError, refetchKpi } =
    useDashboardKpi(filter);
  const {
    timeseriesData,
    isTimeseriesFetching,
    isTimeseriesPending,
    timeseriesError,
    refetchTimeseries,
  } = useSalesTimeseries(filter);
  const {
    topProducts,
    isTopProductsFetching,
    isTopProductsPending,
    topProductsError,
    refetchTopProducts,
  } = useTopProducts(filter);
  const {
    breakdownData,
    isBreakdownFetching,
    isBreakdownPending,
    breakdownError,
    refetchBreakdown,
  } = useOrderStatusBreakdown(filter);

  const isFetching =
    isKpiFetching || isTimeseriesFetching || isTopProductsFetching || isBreakdownFetching;

  const error = firstError(kpiError, timeseriesError, topProductsError, breakdownError);

  const refetchAll = () => {
    refetchKpi();
    refetchTimeseries();
    refetchTopProducts();
    refetchBreakdown();
  };

  /**
   * The sparkline under each card reuses the chart's own buckets, so the shape
   * on the tile and the shape in the plot can never disagree.
   */
  const trend = (key: "revenue" | "orders" | "units") =>
    timeseriesData?.points.map((point) => point[key]) ?? [];

  const cards = kpiData
    ? [
        {
          label: "Total sales",
          value: formatMoneyCompact(kpiData.total_sales.gross),
          hint: `${formatMoney(kpiData.total_sales.net)} net of refunds · ${formatMoney(
            kpiData.total_sales.average_order_value,
          )} average order`,
          icon: IndianRupee,
          trend: trend("revenue"),
        },
        {
          label: "Orders",
          value: formatCount(kpiData.orders.total),
          hint: "Cancelled and returned orders excluded",
          icon: ShoppingCart,
          trend: trend("orders"),
        },
        {
          label: "Products sold",
          value: formatCount(kpiData.products_sold.total),
          hint: "Units, not order lines",
          icon: PackageCheck,
          trend: trend("units"),
        },
        {
          label: "Customers",
          value: formatCount(kpiData.customers.new),
          hint: `New signups · ${formatCount(kpiData.customers.buying)} placed an order`,
          icon: Users,
        },
        {
          label: "Refunds",
          value: formatMoneyCompact(kpiData.refunds.amount),
          hint: `${formatCount(kpiData.refunds.count)} refunded · ${formatPercent(
            kpiData.refunds.rate,
          )} of sales`,
          icon: RotateCcw,
          tone: "danger" as const,
        },
      ]
    : [];

  // Only the very first load gets skeletons. Every later one keeps the previous
  // render and dims it, so changing the range never collapses the page.
  const isFirstLoad =
    isKpiPending || isTimeseriesPending || isTopProductsPending || isBreakdownPending;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Dashboard</h2>
          {kpiData ? (
            <p className="text-sm text-gray-500">
              {kpiData.range.label} · {kpiData.range.start_at.slice(0, 10)} to{" "}
              {kpiData.range.end_at.slice(0, 10)} ({kpiData.range.timezone})
            </p>
          ) : null}
        </div>
      </div>

      <Section className="!p-5">
        <DashboardFilters
          filter={filter}
          onChange={setFilter}
          onRefresh={refetchAll}
          isFetching={isFetching}
        />
      </Section>

      {!isFilterReady(filter) ? (
        <p className="py-10 text-center text-sm text-gray-500">
          Pick an end date to load the custom range.
        </p>
      ) : error ? (
        <div className="space-y-3 py-10 text-center">
          <h3 className="font-semibold">Could not load the dashboard</h3>
          <p className="text-sm text-red-500">
            {error.isAxiosError ? error.response?.data.message : error.message}
          </p>
          <Button className="cursor-pointer" onClick={refetchAll}>
            Try again
          </Button>
        </div>
      ) : isFirstLoad ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-36 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-3xl" />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {cards.map((card) => (
              <KpiCard key={card.label} {...card} isStale={isFetching} />
            ))}
          </div>

          {timeseriesData ? (
            <Section className="!p-6">
              <RevenueChart data={timeseriesData} isStale={isFetching} />
            </Section>
          ) : null}

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <Section className="!p-6">
              <TopProductsPanel products={topProducts} />
            </Section>

            {breakdownData ? (
              <Section className="!p-6">
                <OrderBreakdownPanel data={breakdownData} />
              </Section>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
