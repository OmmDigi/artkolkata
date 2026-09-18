import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "./ui/label";
import type { InputOptions } from "@/types";
import { cn } from "@/lib/utils";


interface IProps {
  label?: string;
  className?: string;
  options: InputOptions[];
  name?: string;
  placeholder?: string;
  defaultValue?: string;
  value?:string;
  required?: boolean;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  disabledValues?: string[];
}

export default function SelectInput(props: IProps) {
  return (
    <div className={cn("grid gap-3", props.className)}>
      {props.label ? (
        <Label className="font-semibold whitespace-nowrap">{props.label}</Label>
      ) : null}

      <Select
        disabled={props.disabled}
        onValueChange={props.onValueChange}
        name={props.name}
        required={props.required}
        defaultValue={props.defaultValue}
        value={props.value}
      >
        <SelectTrigger className="border border-green-600 w-full cursor-pointer">
          <SelectValue placeholder={props.placeholder} />
        </SelectTrigger>
        <SelectContent>
          {props.options.map((option, index) => (
            <SelectItem
              className="cursor-pointer"
              disabled={props.disabledValues?.includes(option.value)}
              key={index}
              value={option.value}
            >
              {option.text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
