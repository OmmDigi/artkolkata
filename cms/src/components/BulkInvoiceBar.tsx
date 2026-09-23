import { useState } from "react";
import { FileStack, X } from "lucide-react";
import { toast } from "react-toastify";
import { AxiosError } from "axios";

import { Button } from "./ui/button";
import { api } from "@/utils/api";
import { MAX_BULK_INVOICES } from "@/constant";

interface IProps {
  /** order_id → order_number, in the order the admin ticked them */
  selected: Map<number, string>;
  onClear: () => void;
  /** invoices may have been generated, so the list's badges need refreshing */
  onDone: () => void;
}

interface IFailed {
  order_number: string;
  reason: string;
}

const saveBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

const readBlobError = async (error: unknown, fallback: string) => {
  const data = (error as AxiosError).response?.data;
  if (data instanceof Blob) {
    try {
      return JSON.parse(await data.text()).message ?? fallback;
    } catch {
      /* not json — keep the fallback */
    }
  }
  return fallback;
};

/**
 * Downloads the ticked orders' invoices as one pdf. The api merges at most
 * MAX_BULK_INVOICES per request, so a bigger selection is fetched in parts,
 * one after another, each saved as its own file.
 */
export default function BulkInvoiceBar({ selected, onClear, onDone }: IProps) {
  const [progress, setProgress] = useState<string | null>(null);

  if (selected.size === 0) return null;

  const download = async () => {
    const ids = [...selected.keys()];
    const parts: number[][] = [];
    for (let i = 0; i < ids.length; i += MAX_BULK_INVOICES) {
      parts.push(ids.slice(i, i + MAX_BULK_INVOICES));
    }

    const failed: IFailed[] = [];
    let included = 0;

    try {
      for (let i = 0; i < parts.length; i++) {
        setProgress(
          parts.length > 1 ? `Part ${i + 1} of ${parts.length}..` : "Preparing..",
        );

        const response = await api.post(
          "/api/v1/orders/invoices/bulk",
          { order_ids: parts[i] },
          { responseType: "blob" },
        );

        const suffix = parts.length > 1 ? `-part-${i + 1}` : "";
        saveBlob(response.data as Blob, `invoices${suffix}.pdf`);

        included += Number(response.headers["x-invoices-included"] ?? 0);
        const failedHeader = response.headers["x-invoices-failed"] as
          | string
          | undefined;
        if (failedHeader) {
          failed.push(...(JSON.parse(decodeURIComponent(failedHeader)) as IFailed[]));
        }
      }

      toast.success(`${included} invoice${included === 1 ? "" : "s"} downloaded`);
      if (failed.length) {
        toast.warn(
          `Skipped ${failed.length}: ` +
            failed.map((f) => `${f.order_number} (${f.reason})`).join(", "),
          { autoClose: false },
        );
      }
      onClear();
    } catch (error) {
      toast.error(await readBlobError(error, "Could not download the invoices"));
    } finally {
      setProgress(null);
      onDone();
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-green-600 bg-green-50 px-3 py-2 text-sm">
      <span className="font-medium">
        {selected.size} order{selected.size === 1 ? "" : "s"} selected
      </span>
      <Button
        type="button"
        size="sm"
        className="bg-green-600 hover:bg-green-700"
        disabled={progress !== null}
        title="Download the selected orders' invoices as one PDF. Missing invoices are generated."
        onClick={download}
      >
        <FileStack size={14} />
        {progress ?? "Download invoices (PDF)"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={progress !== null}
        onClick={onClear}
      >
        <X size={14} />
        Clear
      </Button>
    </div>
  );
}
