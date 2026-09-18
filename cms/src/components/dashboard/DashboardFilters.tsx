import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import type { IAnalyticsFilter } from "@/hooks/useAnalytics";
import type { TAnalyticsPreset } from "@/types";
import { toApiDate } from "@/utils/formatAnalytics";
import { CalendarDays, RefreshCw } from "lucide-react";
import { useState } from "react";
import type { DateRange } from "react-day-picker";

/**
 * One row, above everything it scopes. Presets first, because "last 30 days" is
 * what almost everyone wants and nobody should have to fight a calendar grid
 * for it; the custom range sits at the end of the same row for the case the
 * presets do not cover.
 */

const PRESETS: { value: Exclude<TAnalyticsPreset, "custom">; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "3m", label: "3 Months" },
  { value: "1y", label: "1 Year" },
];

interface IProps {
  filter: IAnalyticsFilter;
  onChange: (filter: IAnalyticsFilter) => void;
  onRefresh: () => void;
  isFetching: boolean;
}

export default function DashboardFilters({
  filter,
  onChange,
  onRefresh,
  isFetching,
}: IProps) {
  const [isCalendarOpen, setCalendarOpen] = useState(false);

  const [draftRange, setDraftRange] = useState<DateRange | undefined>(
    filter.startDate && filter.endDate
      ? {
          from: new Date(`${filter.startDate}T00:00:00`),
          to: new Date(`${filter.endDate}T00:00:00`),
        }
      : undefined,
  );

  const customLabel =
    filter.preset === "custom" && filter.startDate && filter.endDate
      ? `${filter.startDate} → ${filter.endDate}`
      : "Custom Range";

  /**
   * Only commit once both ends exist. react-day-picker reports the range after
   * the first click with `to` undefined, and committing that would fire a
   * request for a window the user has not finished describing.
   */
  const handleRangeSelect = (range?: DateRange) => {
    setDraftRange(range);

    if (range?.from && range?.to) {
      onChange({
        preset: "custom",
        startDate: toApiDate(range.from),
        endDate: toApiDate(range.to),
      });
      setCalendarOpen(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((preset) => {
          const isActive = filter.preset === preset.value;

          return (
            <Button
              key={preset.value}
              size="sm"
              variant={isActive ? "default" : "outline"}
              aria-pressed={isActive}
              className="cursor-pointer"
              onClick={() => onChange({ preset: preset.value })}
            >
              {preset.label}
            </Button>
          );
        })}
      </div>

      <Popover open={isCalendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant={filter.preset === "custom" ? "default" : "outline"}
            aria-pressed={filter.preset === "custom"}
            className="cursor-pointer"
          >
            <CalendarDays className="size-4" />
            {customLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
          <Calendar
            mode="range"
            selected={draftRange}
            defaultMonth={draftRange?.from}
            // A range that has not happened yet is always empty, so the future
            // is simply not offerable.
            disabled={{ after: new Date() }}
            onSelect={handleRangeSelect}
          />
          <p className="border-t px-3 py-2 text-xs text-gray-500">
            Pick a start and an end date. Both days are included.
          </p>
        </PopoverContent>
      </Popover>

      <Button
        size="sm"
        variant="ghost"
        onClick={onRefresh}
        disabled={isFetching}
        className="ml-auto cursor-pointer"
        aria-label="Refresh dashboard"
      >
        <RefreshCw className={cn("size-4", isFetching && "animate-spin")} />
        Refresh
      </Button>
    </div>
  );
}
