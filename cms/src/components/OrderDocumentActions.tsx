import { useState } from "react";
import { Download, FileText, Package } from "lucide-react";
import { toast } from "react-toastify";

import { Button } from "./ui/button";
import { useDoMutation } from "@/hooks/useDoMutation";
import { api } from "@/utils/api";
import type { IOrderList } from "@/types";

interface IProps {
  order: IOrderList;
  onGenerated: () => void;
}

/**
 * The generate / download pair carried by every row of the order listing. The
 * same two documents are also managed from the order page; this is the version
 * for someone working through a day's orders without opening each one.
 */
export default function OrderDocumentActions({ order, onGenerated }: IProps) {
  const [working, setWorking] = useState<"invoice" | "packing-slip" | null>(
    null,
  );

  const { mutate } = useDoMutation();

  const generate = (target: "invoice" | "packing-slip") => {
    setWorking(target);

    mutate({
      apiPath: `/api/v1/orders/${order.order_id}/${target}/generate`,
      method: "post",
      onSuccess: () => {
        setWorking(null);
        onGenerated();
      },
      onError: () => setWorking(null),
    });
  };

  // Admin only, so it is fetched with the api client rather than opened in a
  // tab — see OrderDocuments for the same reasoning.
  const downloadPackingSlip = async () => {
    try {
      const response = await api.get(
        `/api/v1/orders/${order.order_id}/packing-slip`,
        { responseType: "blob" },
      );

      const url = URL.createObjectURL(response.data as Blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `packing-slip-${order.order_number}.pdf`;
      link.click();

      URL.revokeObjectURL(url);
    } catch {
      toast.error("Could not download the packing slip");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 pt-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={working !== null}
        title={
          order.invoice_generated
            ? "Generate the invoice again, keeping its number"
            : "Generate the invoice for this order"
        }
        onClick={() => generate("invoice")}
      >
        <FileText size={12} />
        {working === "invoice"
          ? "Generating.."
          : order.invoice_generated
            ? "Regenerate invoice"
            : "Generate invoice"}
      </Button>

      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={working !== null}
        title={
          order.packing_slip_available
            ? "Generate the packing slip again"
            : "Generate the packing slip for this order"
        }
        onClick={() => generate("packing-slip")}
      >
        <Package size={12} />
        {working === "packing-slip"
          ? "Generating.."
          : order.packing_slip_available
            ? "Regenerate packing slip"
            : "Generate packing slip"}
      </Button>

      {order.packing_slip_available ? (
        <button
          type="button"
          className="underline text-purple-600 cursor-pointer flex items-center gap-1"
          onClick={downloadPackingSlip}
        >
          Packing slip
          <Download size={12} />
        </button>
      ) : null}
    </div>
  );
}
