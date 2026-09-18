import { cn } from "@/lib/utils";
import Sparkline from "./Sparkline";
import type { LucideIcon } from "lucide-react";

/**
 * One stat tile: label, value, a line of context, and an optional sparkline.
 *
 * There is no delta-vs-previous-period here on purpose — the api does not
 * compute one, and inventing a comparison in the client would be a number
 * nobody could reconcile against the rest of the dashboard.
 */

interface IProps {
  label: string;
  value: string;
  /** the quiet second line: what the value excludes, or its companion figure */
  hint?: string;
  icon: LucideIcon;
  trend?: number[];
  /** "danger" tints the icon and sparkline — reserved for refunds */
  tone?: "default" | "danger";
  isStale?: boolean;
}

export default function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  trend,
  tone = "default",
  isStale,
}: IProps) {
  const color = tone === "danger" ? "var(--series-danger)" : "var(--series-1)";

  return (
    <div
      className={cn(
        "viz-root flex flex-col justify-between gap-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-opacity",
        isStale && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm text-gray-500">{label}</p>
          {/* Proportional figures, not tabular: this is a large standalone
              number, and tabular widths make it look loose at this size. */}
          <p className="truncate text-2xl font-semibold text-gray-900" title={value}>
            {value}
          </p>
        </div>

        <span
          className="grid size-9 shrink-0 place-items-center rounded-full"
          style={{ backgroundColor: `color-mix(in oklab, ${color} 12%, white)` }}
        >
          <Icon className="size-4" style={{ color }} aria-hidden="true" />
        </span>
      </div>

      {trend && trend.length > 1 ? <Sparkline values={trend} color={color} /> : null}

      {hint ? <p className="text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}
