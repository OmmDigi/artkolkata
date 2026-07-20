import { useSearchParams } from "react-router-dom";
import LabelInput from "./LabelInput";
import { Button } from "./ui/button";
import { Search } from "lucide-react";
import SelectInput from "./SelectInput";
import type { InputOptions } from "@/types";

interface IProps {
  options: InputOptions[];
}

export default function SearchBar({ options }: IProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedOption = searchParams.get("search_by") ?? options[0].value;

  return (
    <form
      key={searchParams.get("orderid")}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);

        const newSearchParams = new URLSearchParams();
        const value = data.get("search_value")?.toString();
        const key = data.get("search_by")?.toString();

        if (key == undefined) {
          return alert("Choose something for search");
        }
        if (value == undefined || value.trim() == "") {
          return alert("Type something for search");
        }

        newSearchParams.set("search_by", key);
        newSearchParams.set("search_value", value);
        setSearchParams(newSearchParams);
      }}
      className="inline-flex items-end gap-1.5"
    >
      <div className="flex items-end gap-2">
        <SelectInput
          label="Search By"
          name="search_by"
          options={options}
          defaultValue={selectedOption}
        />
        <LabelInput
          label="Search"
          name="search_value"
          placeholder="Search..."
          className="border-1 border-green-600"
          defaultValue={searchParams.get("search_value") ?? ""}
        />
      </div>

      <Button className="text-sm" title="Search">
        <Search />
      </Button>
    </form>
  );
}
