import { Label } from "./ui/label";

interface IProps {
  label?: string;
  textValue: string;
}

export default function LabelInfo(props: IProps) {
  return (
    <div className="grid gap-2 w-full">
      {props.label ? (
        <Label className="font-semibold">{props.label}</Label>
      ) : null}
      <Label className="text-gray-500">{props.textValue}</Label>
    </div>
  );
}
