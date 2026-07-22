import { Label } from "./ui/label";
import { MultiSelect } from "./ui/multi-select";

interface IProps  {
  label?: string;
  options: { label: string; value: string }[];
  onValueChange?: (value: string[]) => void;
  defaultValues?: string[];
  placeholder?:string;
}

export default function LabelMultiSelect(props: IProps) {
  return (
    <div className="grid gap-3">
      {props.label ? (
        <Label className="font-semibold">{props.label}</Label>
      ) : null}
      <MultiSelect
        options={props.options}
        defaultValue={props?.defaultValues ?? []}
        onValueChange={props.onValueChange ? props.onValueChange : () => {}}
        placeholder={props.placeholder ?? "Choose"}
        className="border-1 border-green-600"
      />
    </div>
  );
}
