import { cn } from "@/lib/utils";
import type { IAnalyticsBreakdownRow, IAnalyticsOrderStatus } from "@/types";
import { formatCount, formatMoney, formatPercent } from "@/utils/formatAnalytics";
import { useState } from "react";
import HorizontalBars, { type IBarDatum } from "./HorizontalBars";

/**
 * Where the window's orders currently sit.
 *
 * Unlike every other panel this one counts cancelled and returned orders —
 * that is the whole point of a pipeline view, and it is why the totals here
 * will not match the Orders KPI card above. The caption says so, because two
 * order counts on one screen that differ without explanation is the fastest
 * way to lose a reader's trust in all of them.
 */

const TABS = [
  { value: "order_status", label: "Order status" },
  { value: "payment_status", label: "Payment" },
  { value: "payment_method", label: "Method" },
] as const;

type TTab = (typeof TABS)[number]["value"];

/** statuses that mean the sale came undone — state, so they wear the danger token */
const NEGATIVE_STATUSES = new Set([
  "CANCELLED",
  "RETURNED",
  "FAILED",
  "REFUNDED",
  "RETURN INITIATED",
]);

interface IProps {
  data: IAnalyticsOrderStatus;
}

const toBars = (rows: IAnalyticsBreakdownRow[]): IBarDatum[] =>
  rows.map((row) => ({
    key: row.value,
    label: row.value,
    value: row.count,
    valueLabel: `${formatCount(row.count)} · ${formatPercent(row.percentage)}`,
    sublabel: formatMoney(row.amount),
    tone: NEGATIVE_STATUSES.has(row.value) ? "danger" : "default",
  }));

export default function OrderBreakdownPanel({ data }: IProps) {
  const [tab, setTab] = useState<TTab>("order_status");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-900">Order breakdown</h3>
          <p className="text-xs text-gray-500">
            All {formatCount(data.total_orders)} orders placed in this period,
            cancelled and returned included — so this total is higher than the
            Orders card above.
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
          {TABS.map((entry) => (
            <button
              key={entry.value}
              type="button"
              aria-pressed={tab === entry.value}
              onClick={() => setTab(entry.value)}
              className={cn(
                "cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-colors",
                tab === entry.value
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-900",
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      <HorizontalBars
        data={toBars(data[tab])}
        emptyMessage="No orders in this period"
      />
    </div>
  );
}
