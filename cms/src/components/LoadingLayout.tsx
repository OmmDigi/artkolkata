import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import React from "react";
import { Label } from "./ui/label";

interface IProps extends React.ComponentProps<"div"> {
  loadingTxt?: string;
}

export default function LoadingLayout({
  loadingTxt,
  className,
  ...props
}: IProps) {
  return (
    <div
      {...props}
      className={cn("w-full flex items-center gap-3 justify-center", className)}
    >
      <Loader2 className="animate-spin" size={18} />
      <Label>{loadingTxt ?? "Loading..."}</Label>
    </div>
  );
}
