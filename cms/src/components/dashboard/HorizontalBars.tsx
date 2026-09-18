import { cn } from "@/lib/utils";
import { useState } from "react";

/**
 * A ranked list of magnitudes: product names, order statuses, payment methods.
 *
 * Horizontal rather than vertical because the categories have long names, and a
 * column chart would either clip them or turn them sideways.
 *
 * One hue for every bar. Darkening the bigger bars would double-encode length
 * as colour — it would spend the only free channel restating what the bar
 * already says, and these categories have no natural order anyway. The
 * exception is a bar whose category *means* something bad (cancelled,
 * returned): that is state, not identity, and it gets the danger token.
 */

export interface IBarDatum {
  key: string;
  label: string;
  /** what the bar length encodes */
  value: number;
  /** printed at the tip; defaults to the value */
  valueLabel?: string;
  /** the quiet second line under the label */
  sublabel?: string;
  tone?: "default" | "danger";
}

interface IProps {
  data: IBarDatum[];
  emptyMessage?: string;
}

export default function HorizontalBars({ data, emptyMessage }: IProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null);

  if (data.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-gray-500">
        {emptyMessage ?? "Nothing in this period"}
      </p>
    );
  }

  const max = Math.max(...data.map((datum) => datum.value), 0) || 1;

  return (
    <ul className="viz-root space-y-3">
      {data.map((datum) => {
        const color =
          datum.tone === "danger" ? "var(--series-danger)" : "var(--series-1)";
        const isActive = activeKey === datum.key;

        return (
          <li
            key={datum.key}
            // The whole row is the hit target, not the painted bar — a short
            // bar is a few pixels wide and nobody lands on it.
            tabIndex={0}
            onPointerEnter={() => setActiveKey(datum.key)}
            onPointerLeave={() => setActiveKey(null)}
            onFocus={() => setActiveKey(datum.key)}
            onBlur={() => setActiveKey(null)}
            className={cn(
              "-mx-2 rounded-lg px-2 py-1 outline-none transition-colors",
              isActive && "bg-gray-50",
            )}
          >
            <div className="flex items-baseline justify-between gap-4">
              <p className="truncate text-sm text-gray-700" title={datum.label}>
                {datum.label}
              </p>
              {/* The value rides the row rather than the bar tip: a bar near
                  zero has no room at its tip, and a label that does not fit is
                  worse than one placed consistently. */}
              <p className="shrink-0 text-sm font-semibold tabular-nums text-gray-900">
                {datum.valueLabel ?? datum.value.toLocaleString("en-IN")}
              </p>
            </div>

            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{
                  width: `${Math.max((datum.value / max) * 100, datum.value > 0 ? 2 : 0)}%`,
                  backgroundColor: color,
                  opacity: isActive ? 1 : 0.9,
                }}
              />
            </div>

            {datum.sublabel ? (
              <p className="mt-1 text-xs text-gray-500">{datum.sublabel}</p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
