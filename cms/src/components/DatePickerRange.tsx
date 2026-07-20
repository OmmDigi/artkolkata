"use client";

import { useEffect, useState } from "react";

import { ChevronDownIcon } from "lucide-react";
import { type DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface IProps {
  defaultValue?: DateRange;
  onSelect?: (range?: DateRange) => void;
  text?: string;
}

const DatePickerRange = ({ defaultValue, onSelect, text }: IProps) => {
  const [range, setRange] = useState<DateRange | undefined>(undefined);

  useEffect(() => {
    if (defaultValue) {
      setRange(defaultValue);
    }
  }, [defaultValue]);

  return (
    <div className="w-full max-w-xs">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            id="dates"
            className="w-full justify-between font-normal"
          >
            {range?.from && range?.to
              ? `${range.from.toLocaleDateString()} - ${range.to.toLocaleDateString()}`
              : text ?? "Pick date range"}
            <ChevronDownIcon />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
          <Calendar
            mode="range"
            selected={range}
            onSelect={(value) => {
              setRange(value);
              onSelect?.(value);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default DatePickerRange;
