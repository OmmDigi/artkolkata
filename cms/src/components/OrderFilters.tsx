import { useSearchParams } from "react-router-dom";
import { Button } from "./ui/button";
import { RotateCcw, Search } from "lucide-react";
import LabelInput from "./LabelInput";
import SelectInput from "./SelectInput";
import {
  CUSTOMER_TYPE_FILTER,
  FILTER_ALL,
  ORDER_STATUS_FILTER,
  PAYMENT_STATUS_FILTER,
} from "@/constant";

export default function OrderFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  // "All" means no filter at all, so the parameter leaves the URL rather than
  // going to the API as an empty value it would have to special case.
  const applyFilter = (key: string, value: string) => {
    const newSearchParams = new URLSearchParams();
    if (value !== FILTER_ALL) {
      newSearchParams.set(key, value);
    }
    setSearchParams(newSearchParams);
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <form
        key={searchParams.get("orderid")}
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          const orderId = data.get("orderid")?.toString().trim();
          if (!orderId) {
            return alert("Type order id first");
          }

          const newSearchParams = new URLSearchParams();
          newSearchParams.set("orderid", orderId);
          setSearchParams(newSearchParams);
        }}
        className="flex items-end gap-1.5 shrink-0"
      >
        <LabelInput
          label="Order ID"
          name="orderid"
          placeholder="Search by order id"
          className="border-1 border-green-600"
          defaultValue={searchParams.get("orderid") ?? ""}
        />

        <Button className="text-sm" title="Search">
          <Search />
        </Button>
      </form>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          const fromDate = data.get("from")?.toString();
          const toDate = data.get("to")?.toString();

          if (!fromDate || !toDate) {
            return alert("Pick Date Range First");
          }

          const newSearchParams = new URLSearchParams();
          newSearchParams.set("from", fromDate);
          newSearchParams.set("to", toDate);

          setSearchParams(newSearchParams);
        }}
        className="flex items-end gap-1.5 shrink-0"
      >
        <LabelInput label="From Date" type="date" name="from" />
        <LabelInput label="To Date" type="date" name="to" />
        <Button className="text-sm" title="Search">
          <Search />
        </Button>
      </form>

      <SelectInput
        className="w-40 shrink-0"
        onValueChange={(value) => applyFilter("pstatus", value)}
        label="Payment Status"
        options={PAYMENT_STATUS_FILTER}
        value={searchParams.get("pstatus") ?? FILTER_ALL}
      />

      <SelectInput
        className="w-40 shrink-0"
        onValueChange={(value) => applyFilter("ostatus", value)}
        label="Order Status"
        options={ORDER_STATUS_FILTER}
        value={searchParams.get("ostatus") ?? FILTER_ALL}
      />

      <SelectInput
        className="w-40 shrink-0"
        onValueChange={(value) => applyFilter("customer_type", value)}
        label="Customer"
        options={CUSTOMER_TYPE_FILTER}
        value={searchParams.get("customer_type") ?? FILTER_ALL}
      />

      <Button
        className="shrink-0"
        title="Reset filter"
        onClick={() => {
          setSearchParams({});
        }}
      >
        <RotateCcw size={12} />
      </Button>
    </div>
  );
}
