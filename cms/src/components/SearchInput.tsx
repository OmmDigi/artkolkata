import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";

interface IProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function SearchInput(props: IProps) {
  return (
    <div className={`relative ${props.className ?? "w-64"}`}>
      <Search
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500"
        size={16}
      />
      <Input
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder ?? "Search by name..."}
        className="border border-green-600 pl-8 pr-8"
      />
      {props.value ? (
        <X
          className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer text-gray-500"
          size={16}
          onClick={() => props.onChange("")}
        />
      ) : null}
    </div>
  );
}
