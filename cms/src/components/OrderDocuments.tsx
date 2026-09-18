import { useState } from "react";
import { Download, FileText, Mail, Package, RefreshCw } from "lucide-react";
import { toast } from "react-toastify";

import Section from "./Section";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { useDoMutation } from "@/hooks/useDoMutation";
import { api } from "@/utils/api";
import type { OrderInfo } from "@/types";

interface IProps {
  orderId: string;
  orderInfo: OrderInfo;
  onGenerated: () => void;
}

export default function OrderDocuments({
  orderId,
  orderInfo,
  onGenerated,
}: IProps) {
  // which of the two buttons is working, so only that one shows a spinner
  const [working, setWorking] = useState<"invoice" | "packing-slip" | null>(
    null,
  );
  const [downloading, setDownloading] = useState(false);
  const [emailing, setEmailing] = useState(false);

  const { mutate } = useDoMutation();

  const generate = (document: "invoice" | "packing-slip") => {
    setWorking(document);

    mutate({
      apiPath: `/api/v1/orders/${orderId}/${document}/generate`,
      method: "post",
      onSuccess: () => {
        setWorking(null);
        onGenerated();
      },
      onError: () => setWorking(null),
    });
  };

  // The customer gets the pdf as an attachment, so this is the one document
  // action that leaves the building — hence the confirm. The success toast
  // carries the address the api actually sent to, which is not always the one
  // on the account: a guest order only has the address typed at checkout.
  const emailInvoice = () => {
    if (
      !confirm(
        "Email this invoice to the customer? They will receive the PDF as an attachment.",
      )
    )
      return;

    setEmailing(true);

    mutate({
      apiPath: `/api/v1/orders/${orderId}/invoice/email`,
      method: "post",
      onSuccess: () => setEmailing(false),
      onError: () => setEmailing(false),
    });
  };

  // The packing slip route is admin only, so it cannot simply be opened in a
  // tab — the token lives in this app, not in a cookie the browser would send
  // on a plain navigation. It is fetched with the api client and handed to the
  // browser as a blob instead.
  const downloadPackingSlip = async () => {
    setDownloading(true);

    try {
      const response = await api.get(`/api/v1/orders/${orderId}/packing-slip`, {
        responseType: "blob",
      });

      const url = URL.createObjectURL(response.data as Blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `packing-slip-${orderInfo.order_number}.pdf`;
      link.click();

      URL.revokeObjectURL(url);
    } catch {
      toast.error("Could not download the packing slip");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Section>
      <div className="flex items-center justify-between gap-3">
        <Label className="text-xl">Documents</Label>
        {orderInfo.invoice_number ? (
          <Badge variant="default">{orderInfo.invoice_number}</Badge>
        ) : null}
      </div>

      <p className="text-sm text-gray-500">
        Both documents are generated from this order and stored on the server.
        Generating again replaces the stored file with a fresh one — the invoice
        keeps its number and its original date.
        {orderInfo.has_invoice_document
          ? " An invoice was uploaded by hand for this order, and that is the one the customer downloads."
          : ""}
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {/* ------------------------------ invoice ------------------------------ */}
        <div className="grid gap-3 rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 font-semibold">
              <FileText size={16} /> Invoice
            </span>
            <Badge variant={orderInfo.has_generated_invoice ? "default" : "secondary"}>
              {orderInfo.has_generated_invoice ? "Generated" : "Not generated"}
            </Badge>
          </div>

          {orderInfo.has_generated_invoice ? (
            <span className="text-sm text-gray-500">
              Generated on {orderInfo.invoice_generated_at}
            </span>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              className="bg-green-700 hover:bg-green-900"
              disabled={working !== null}
              onClick={() => generate("invoice")}
            >
              {orderInfo.has_generated_invoice ? <RefreshCw /> : <FileText />}
              {working === "invoice"
                ? "Generating.."
                : orderInfo.has_generated_invoice
                  ? "Regenerate Invoice"
                  : "Generate Invoice"}
            </Button>

            {orderInfo.has_generated_invoice || orderInfo.has_invoice_document ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    window.open(
                      `${import.meta.env.VITE_API_BASE_URL ?? ""}/api/v1/orders/invoice/${orderId}`,
                    )
                  }
                >
                  <Download /> Download
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  disabled={emailing}
                  onClick={emailInvoice}
                >
                  <Mail /> {emailing ? "Sending.." : "Email to Customer"}
                </Button>
              </>
            ) : null}
          </div>
        </div>

        {/* ---------------------------- packing slip ---------------------------- */}
        <div className="grid gap-3 rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 font-semibold">
              <Package size={16} /> Packing Slip
            </span>
            <Badge variant={orderInfo.has_packing_slip ? "default" : "secondary"}>
              {orderInfo.has_packing_slip ? "Generated" : "Not generated"}
            </Badge>
          </div>

          {orderInfo.has_packing_slip ? (
            <span className="text-sm text-gray-500">
              Generated on {orderInfo.packing_slip_generated_at}
            </span>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              className="bg-green-700 hover:bg-green-900"
              disabled={working !== null}
              onClick={() => generate("packing-slip")}
            >
              {orderInfo.has_packing_slip ? <RefreshCw /> : <Package />}
              {working === "packing-slip"
                ? "Generating.."
                : orderInfo.has_packing_slip
                  ? "Regenerate Packing Slip"
                  : "Generate Packing Slip"}
            </Button>

            {orderInfo.has_packing_slip ? (
              <Button
                type="button"
                variant="outline"
                disabled={downloading}
                onClick={downloadPackingSlip}
              >
                <Download /> {downloading ? "Downloading.." : "Download"}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </Section>
  );
}
