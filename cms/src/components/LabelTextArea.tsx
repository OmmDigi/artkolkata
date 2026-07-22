import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

interface IProps extends React.ComponentProps<"textarea"> {
  label?: string;
}

export default function LabelTextArea(props: IProps) {
  return (
    <div className="grid gap-3">
      {props.label ? (
        <Label className="font-semibold">{props.label}</Label>
      ) : null}
      <Textarea className="border-1 border-green-600 disabled:opacity-100" {...props} />
    </div>
  );
}
