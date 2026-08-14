import { useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { toast } from "react-toastify";

import Section from "./Section";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useDoMutation } from "@/hooks/useDoMutation";
import type { OrderInfo } from "@/types";

const MAX_INVOICE_BYTES = 8 * 1024 * 1024;

interface IProps {
  orderId: string;
  orderInfo: OrderInfo;
  onChanged: () => void;
}

export default function OrderInvoice({ orderId, orderInfo, onChanged }: IProps) {
  const [invoice, setInvoice] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");

  const { isLoading, mutate } = useDoMutation();

  const uploaded = orderInfo.has_invoice_document;

  const readFile = (file: File) => {
    if (file.size > MAX_INVOICE_BYTES) {
      toast.error("Invoice must be under 8 MB");
      return;
    }

    // PDF and JPEG only — the same file is what a multi-box order is booked
    // with, and Bigship takes nothing else there.
    if (!["application/pdf", "image/jpeg"].includes(file.type)) {
      toast.error("Invoice must be a PDF or JPEG file");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setInvoice(String(reader.result));
      setFileName(file.name);
    };
    reader.onerror = () => toast.error("Could not read that file");
    reader.readAsDataURL(file);
  };

  const upload = () => {
    if (!invoice) {
      toast.error("Choose an invoice file first");
      return;
    }

    mutate({
      apiPath: `/api/v1/orders/${orderId}/invoice`,
      method: "put",
      formData: { invoice_document: invoice },
      onSuccess: () => {
        setInvoice(null);
        setFileName("");
        onChanged();
      },
    });
  };

  const remove = () => {
    if (!confirm("Remove the uploaded invoice? The generated one comes back."))
      return;

    mutate({
      apiPath: `/api/v1/orders/${orderId}/invoice`,
      method: "delete",
      onSuccess: onChanged,
    });
  };

  return (
    <Section>
      <div className="flex items-center justify-between gap-3">
        <Label className="text-xl">Invoice</Label>
        <Badge variant={uploaded ? "default" : "secondary"}>
          {uploaded ? "Uploaded" : "Auto generated"}
        </Badge>
      </div>

      <p className="text-sm text-gray-500">
        {uploaded
          ? "The customer downloads this uploaded invoice. The generated one is not used."
          : "No invoice uploaded, so the customer gets the automatically generated one once the order is delivered. Upload a file here to replace it and make it downloadable right away."}
      </p>

      {uploaded ? (
        <div className="flex items-center gap-3">
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
            variant="ghost"
            disabled={isLoading}
            onClick={remove}
          >
            <Trash2 className="text-red-600" /> Remove
          </Button>
        </div>
      ) : null}

      <div className="grid gap-3">
        <Label className="font-semibold">
          {uploaded ? "Replace Invoice (PDF or JPEG)" : "Upload Invoice (PDF or JPEG)"}
        </Label>
        <Input
          type="file"
          accept="application/pdf,image/jpeg"
          className="border-1 border-green-600"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) readFile(file);
          }}
        />
        {fileName ? (
          <span className="text-sm text-gray-500">Selected: {fileName}</span>
        ) : null}
      </div>

      <Button
        type="button"
        className="bg-green-700 hover:bg-green-900"
        disabled={isLoading || !invoice}
        onClick={upload}
      >
        {isLoading ? "Uploading.." : "Upload Invoice"}
      </Button>
    </Section>
  );
}
