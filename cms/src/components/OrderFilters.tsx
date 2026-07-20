import { useSearchParams } from "react-router-dom";
import { Button } from "./ui/button";
import { RotateCcw, Search } from "lucide-react";
import LabelInput from "./LabelInput";
import SelectInput from "./SelectInput";
import { ORDER_STATUS, PAYMENT_STATUS } from "@/constant";

export default function OrderFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  return (
    <div className="flex items-end justify-between">
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
        className="inline-flex items-end gap-1.5"
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
        className="flex items-end gap-1.5"
      >
        <LabelInput label="From Date" type="date" name="from" />
        <LabelInput label="To Date" type="date" name="to" />
        <Button className="text-sm" title="Search">
          <Search />
        </Button>
      </form>

      <SelectInput
        onValueChange={(value) => {
          const newSearchParams = new URLSearchParams();
          newSearchParams.set("pstatus", value);
          setSearchParams(newSearchParams);
        }}
        label="Payment Status"
        options={PAYMENT_STATUS}
        defaultValue={searchParams.get("pstatus") ?? PAYMENT_STATUS[0].value}
      />

      <SelectInput
        onValueChange={(value) => {
          const newSearchParams = new URLSearchParams();
          newSearchParams.set("ostatus", value);
          setSearchParams(newSearchParams);
        }}
        label="Order Status"
        options={ORDER_STATUS}
        defaultValue={searchParams.get("ostatus") ?? ORDER_STATUS[0].value}
      />

      <Button
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
