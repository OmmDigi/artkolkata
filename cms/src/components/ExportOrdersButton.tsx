import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { toast } from "react-toastify";
import { useSearchParams } from "react-router-dom";
import { AxiosError } from "axios";

import { Button } from "./ui/button";
import { api } from "@/utils/api";

/**
 * Downloads the order list as an Excel file, with whatever filters are on
 * screen. The file is built and streamed by the api, so it covers every
 * matching order, not just the page being looked at.
 */
export default function ExportOrdersButton() {
  const [searchParams] = useSearchParams();
  const [exporting, setExporting] = useState(false);

  const exportOrders = async () => {
    const params = new URLSearchParams(searchParams);
    params.delete("page");
    params.delete("limit");

    setExporting(true);
    try {
      const response = await api.get(
        `/api/v1/orders/export?${params.toString()}`,
        { responseType: "blob" },
      );

      const disposition = response.headers["content-disposition"] as
        | string
        | undefined;
      const fileName =
        disposition?.match(/filename="?([^"]+)"?/)?.[1] ?? "orders.xlsx";

      const url = URL.createObjectURL(response.data as Blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      // The body of a failed blob request is the api's json error, still
      // wrapped in a Blob.
      let message = "Could not export orders";
      const data = (error as AxiosError).response?.data;
      if (data instanceof Blob) {
        try {
          message = JSON.parse(await data.text()).message ?? message;
        } catch {
          /* not json — keep the generic message */
        }
      }
      toast.error(message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button
      type="button"
      className="shrink-0 bg-green-600 hover:bg-green-700"
      title="Download the filtered orders as an Excel file"
      disabled={exporting}
      onClick={exportOrders}
    >
      <FileSpreadsheet size={14} />
      {exporting ? "Exporting.." : "Export Excel"}
    </Button>
  );
}
