import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Eye, EyeClosed } from "lucide-react";
import { useState } from "react";

interface IProps extends React.ComponentProps<"input"> {
  label?: string;
  passwordInput?: boolean;
}

export default function LabelInput(props: IProps) {
  const [passwordType, setPasswordType] = useState("password");
  return (
    <div className="grid gap-3 w-full">
      {props.label ? (
        <Label className="font-semibold">{props.label}</Label>
      ) : null}
      <div className="flex items-center gap-5">
        <Input
          className="border-1 border-green-600 disabled:opacity-100"
          {...props}
          type={props.passwordInput ? passwordType : props.type}
        />

        {props.passwordInput == true ? (
          passwordType == "password" ? (
            <Eye
              onClick={() => setPasswordType("text")}
              className="cursor-pointer"
              strokeWidth={0.75}
            />
          ) : (
            <EyeClosed
              onClick={() => setPasswordType("password")}
              className="cursor-pointer"
              strokeWidth={0.75}
            />
          )
        ) : null}
      </div>
    </div>
  );
}
