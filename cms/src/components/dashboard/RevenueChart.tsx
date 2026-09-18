import { cn } from "@/lib/utils";
import type { IAnalyticsTimeseries } from "@/types";
import {
  formatBucketLong,
  formatBucketShort,
  formatCount,
  formatMoney,
  formatMoneyAxis,
} from "@/utils/formatAnalytics";
import { useId, useMemo, useState } from "react";
import { useElementWidth } from "./useElementWidth";

/**
 * Revenue / orders / units over the selected window.
 *
 * One metric is plotted at a time, chosen by the toggle above the plot. That is
 * not a limitation being worked around — rupees and order counts live on scales
 * two or three orders of magnitude apart, and putting them on two y-axes in one
 * frame invents a correlation that is not in the data. One axis, one meaning.
 * The tooltip still reports all three at the hovered bucket, so switching
 * metrics is never needed just to read a number.
 */

type TMetric = "revenue" | "orders" | "units";

const METRICS: { value: TMetric; label: string }[] = [
  { value: "revenue", label: "Revenue" },
  { value: "orders", label: "Orders" },
  { value: "units", label: "Units" },
];

const HEIGHT = 260;
const PADDING = { top: 16, right: 20, bottom: 28, left: 56 };

/**
 * Axis ticks land on 1/2/5 × a power of ten, so they read as round numbers
 * instead of whatever the data maximum happened to be divided by four.
 */
const niceCeiling = (value: number) => {
  if (value <= 0) return 1;

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalised = value / magnitude;

  const step = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;
  return step * magnitude;
};

interface IProps {
  data: IAnalyticsTimeseries;
  isStale?: boolean;
}

export default function RevenueChart({ data, isStale }: IProps) {
  const [metric, setMetric] = useState<TMetric>("revenue");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const gradientId = useId();
  const { ref, width } = useElementWidth<HTMLDivElement>();

  const { points, bucket } = data;

  const plotWidth = Math.max(width - PADDING.left - PADDING.right, 10);
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

  const geometry = useMemo(() => {
    const values = points.map((point) => point[metric]);
    const ceiling = niceCeiling(Math.max(...values, 0));

    const xAt = (index: number) =>
      PADDING.left +
      (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);

    const yAt = (value: number) =>
      PADDING.top + plotHeight - (value / ceiling) * plotHeight;

    const coords = values.map((value, index) => [xAt(index), yAt(value)] as const);

    const line = coords
      .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
      .join(" ");

    const baseline = PADDING.top + plotHeight;
    const area = coords.length
      ? `${line} L${coords[coords.length - 1][0].toFixed(2)},${baseline} L${coords[0][0].toFixed(2)},${baseline} Z`
      : "";

    return { values, ceiling, coords, line, area, baseline, xAt };
  }, [points, metric, plotWidth, plotHeight]);

  const formatTick = (value: number) =>
    metric === "revenue"
      ? formatMoneyAxis(value, geometry.ceiling)
      : formatCount(value);

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => geometry.ceiling * fraction);

  /**
   * Labelling every bucket is unreadable at 30 days and impossible at 365, so
   * only every nth is drawn — enough to keep roughly one label per 70px.
   */
  const labelStride = Math.max(1, Math.ceil(points.length / Math.max(plotWidth / 70, 1)));

  /**
   * The crosshair snaps to the nearest bucket, so the reader aims at a date
   * rather than at a 2px line. The whole plot is one hit area.
   */
  const handlePointer = (event: React.PointerEvent<SVGSVGElement>) => {
    if (points.length === 0) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const offsetX = event.clientX - bounds.left - PADDING.left;
    const ratio = plotWidth === 0 ? 0 : offsetX / plotWidth;

    const index = Math.round(ratio * Math.max(points.length - 1, 0));
    setActiveIndex(Math.min(Math.max(index, 0), points.length - 1));
  };

  const activePoint = activeIndex === null ? null : points[activeIndex];
  const activeCoord = activeIndex === null ? null : geometry.coords[activeIndex];

  return (
    <div className="viz-root space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-900">
            {METRICS.find((entry) => entry.value === metric)?.label} over time
          </h3>
          <p className="text-xs text-gray-500">
            {data.range.label} · one point per {bucket} · {data.range.timezone}
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
          {METRICS.map((entry) => (
            <button
              key={entry.value}
              type="button"
              aria-pressed={metric === entry.value}
              onClick={() => setMetric(entry.value)}
              className={cn(
                "cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-colors",
                metric === entry.value
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-900",
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={ref} className={cn("relative transition-opacity", isStale && "opacity-60")}>
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`${metric} per ${bucket} for ${data.range.label}`}
          onPointerMove={handlePointer}
          onPointerLeave={() => setActiveIndex(null)}
          className="touch-none"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--series-1)" stopOpacity="0.14" />
              <stop offset="100%" stopColor="var(--series-1)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* hairline grid, solid and recessive — never dashed */}
          {ticks.map((tick) => {
            const y = PADDING.top + plotHeight - (tick / geometry.ceiling) * plotHeight;

            return (
              <g key={tick}>
                <line
                  x1={PADDING.left}
                  x2={PADDING.left + plotWidth}
                  y1={y}
                  y2={y}
                  stroke="var(--viz-grid)"
                  strokeWidth={1}
                />
                <text
                  x={PADDING.left - 8}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-gray-500 text-[10px] tabular-nums"
                >
                  {formatTick(tick)}
                </text>
              </g>
            );
          })}

          {points.map((point, index) =>
            index % labelStride === 0 ? (
              <text
                key={point.bucket}
                x={geometry.xAt(index)}
                y={HEIGHT - 8}
                textAnchor="middle"
                className="fill-gray-500 text-[10px]"
              >
                {formatBucketShort(point.bucket, bucket)}
              </text>
            ) : null,
          )}

          <path d={geometry.area} fill={`url(#${gradientId})`} />
          <path
            d={geometry.line}
            fill="none"
            stroke="var(--series-1)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {activeCoord ? (
            <g>
              <line
                x1={activeCoord[0]}
                x2={activeCoord[0]}
                y1={PADDING.top}
                y2={geometry.baseline}
                stroke="var(--viz-muted)"
                strokeWidth={1}
              />
              <circle
                cx={activeCoord[0]}
                cy={activeCoord[1]}
                r={4}
                fill="var(--series-1)"
                stroke="var(--surface-1)"
                strokeWidth={2}
              />
            </g>
          ) : null}
        </svg>

        {activePoint && activeCoord ? (
          <div
            className="pointer-events-none absolute z-10 min-w-44 -translate-x-1/2 rounded-lg border border-gray-200 bg-white p-2.5 text-xs shadow-lg"
            style={{
              left: Math.min(Math.max(activeCoord[0], 90), Math.max(width - 90, 90)),
              top: 8,
            }}
          >
            <p className="mb-1.5 font-medium text-gray-500">
              {formatBucketLong(activePoint.bucket, bucket)}
            </p>

            {/* Every metric at this bucket, so the pointer never has to hunt.
                Value leads, label follows — the reader already has the series. */}
            <dl className="space-y-1">
              {[
                { label: "Revenue", value: formatMoney(activePoint.revenue) },
                { label: "Orders", value: formatCount(activePoint.orders) },
                { label: "Units", value: formatCount(activePoint.units) },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-4">
                  <dt className="text-gray-500">{row.label}</dt>
                  <dd className="font-semibold tabular-nums text-gray-900">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </div>

      {/* The table view: every plotted value reachable without a pointer. */}
      <details className="text-sm">
        <summary className="cursor-pointer text-gray-500 hover:text-gray-900">
          View as table
        </summary>
        <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-gray-100">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-gray-50 text-gray-500">
              <tr>
                <th className="px-3 py-2 font-medium">Period</th>
                <th className="px-3 py-2 text-right font-medium">Revenue</th>
                <th className="px-3 py-2 text-right font-medium">Orders</th>
                <th className="px-3 py-2 text-right font-medium">Units</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.bucket} className="border-t border-gray-100">
                  <td className="px-3 py-1.5 text-gray-700">
                    {formatBucketLong(point.bucket, bucket)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {formatMoney(point.revenue)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {formatCount(point.orders)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {formatCount(point.units)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
