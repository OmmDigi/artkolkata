import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "react-toastify";

import LabelInput from "./LabelInput";
import Section from "./Section";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { ORDER_PENDING } from "@/constant";
import { useDoMutation } from "@/hooks/useDoMutation";
import type { OrderInfo, ShipmentBox } from "@/types";

// Bigship refuses a multi-box shipment invoiced at or above this without an
// ewaybill. Mirrors EWAYBILL_THRESHOLD on the API.
const EWAYBILL_THRESHOLD = 50000;

const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

// Guards against a stray keystroke in the box count turning into thousands of
// rendered rows.
const MAX_BOXES = 50;

const emptyRow = (): ShipmentBox => ({
  weight_kg: "",
  length_cm: "",
  breadth_cm: "",
  height_cm: "",
});

interface IProps {
  orderId: string;
  orderInfo: OrderInfo;
  onSaved: () => void;
}

export default function ShipmentBoxes({ orderId, orderInfo, onSaved }: IProps) {
  const [rows, setRows] = useState<ShipmentBox[]>(
    orderInfo.shipment_boxes?.length
      ? orderInfo.shipment_boxes
      : [emptyRow()],
  );
  // The box count keeps its own text, so clearing the field leaves it blank
  // while you retype instead of snapping back to the current row count.
  const [boxCount, setBoxCount] = useState(String(rows.length));
  const [ewaybillNumber, setEwaybillNumber] = useState(
    orderInfo.ewaybill_number ?? "",
  );
  const [ewaybillDocument, setEwaybillDocument] = useState<string | null>(null);
  const [documentName, setDocumentName] = useState("");

  const { isLoading, mutate } = useDoMutation();

  // Confirming is what sends the boxes to the courier, so a pending order is
  // the only place they can still be changed. Past that the goods are packed
  // and on their way, and an edit here would only make the CMS disagree with
  // what actually shipped.
  const locked =
    !!orderInfo.bigship_order_id || orderInfo.order_status !== ORDER_PENDING;

  // More than one box cannot go as a normal B2C parcel; Bigship books it as a
  // B2B heavy shipment, which is where the ewaybill rules kick in.
  const isMultiBox = rows.length > 1;
  const invoiceAmount = parseFloat(orderInfo.subtotal ?? "0");
  const needsEwaybill = isMultiBox && invoiceAmount >= EWAYBILL_THRESHOLD;

  const setField = (index: number, field: keyof ShipmentBox, value: string) => {
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  };

  const removeRow = (index: number) => {
    setRows((current) =>
      current.length === 1 ? current : current.filter((_, i) => i !== index),
    );
  };

  // Typing a count builds that many rows in one go. Growing appends blanks and
  // shrinking trims from the end, so measurements already keyed in survive. A
  // blank or nonsense count is left alone until the field is done being edited.
  const onBoxCountChange = (raw: string) => {
    setBoxCount(raw);

    const count = parseInt(raw, 10);
    if (!Number.isFinite(count) || count < 1) return;

    const target = Math.min(count, MAX_BOXES);

    setRows((current) =>
      target <= current.length
        ? current.slice(0, target)
        : [
            ...current,
            ...Array.from({ length: target - current.length }, emptyRow),
          ],
    );
  };

  // Adding or deleting a row from the list below has to move the count too.
  useEffect(() => {
    setBoxCount(String(rows.length));
  }, [rows.length]);

  const readDocument = (file: File) => {
    if (file.size > MAX_DOCUMENT_BYTES) {
      toast.error("Ewaybill document must be under 5 MB");
      return;
    }

    if (!["application/pdf", "image/jpeg"].includes(file.type)) {
      toast.error("Ewaybill document must be a PDF or JPEG file");
      return;
    }

    // Bigship takes the document as a base64 Data URI, so it is read here and
    // posted inline rather than uploaded to the media service first.
    const reader = new FileReader();
    reader.onload = () => {
      setEwaybillDocument(String(reader.result));
      setDocumentName(file.name);
    };
    reader.onerror = () => toast.error("Could not read that file");
    reader.readAsDataURL(file);
  };

  const save = () => {
    const boxes = rows.map((row) => ({
      weight_kg: parseFloat(String(row.weight_kg)),
      length_cm: parseInt(String(row.length_cm), 10),
      breadth_cm: parseInt(String(row.breadth_cm), 10),
      height_cm: parseInt(String(row.height_cm), 10),
    }));

    const incomplete = boxes.some((box) =>
      Object.values(box).some((value) => !Number.isFinite(value) || value <= 0),
    );

    if (incomplete) {
      toast.error("Every box needs a weight, length, breadth and height above 0");
      return;
    }

    if (needsEwaybill && !/^\d{12}$/.test(ewaybillNumber)) {
      toast.error("Ewaybill number must be exactly 12 digits");
      return;
    }

    if (needsEwaybill && !ewaybillDocument && !orderInfo.has_ewaybill_document) {
      toast.error("Attach the ewaybill document");
      return;
    }

    mutate({
      apiPath: `/api/v1/orders/${orderId}/shipment-boxes`,
      method: "put",
      formData: {
        boxes,
        // Left out entirely when untouched so the API keeps what it has —
        // re-saving the boxes should not wipe a document already on file.
        ...(ewaybillNumber ? { ewaybill_number: ewaybillNumber } : {}),
        ...(ewaybillDocument ? { ewaybill_document: ewaybillDocument } : {}),
      },
      onSuccess: onSaved,
    });
  };

  return (
    <Section>
      <div className="flex items-center justify-between gap-3">
        <Label className="text-xl">Shipment Boxes</Label>
        <Badge variant={isMultiBox ? "destructive" : "default"}>
          {isMultiBox ? "B2B / Heavy" : "B2C"}
        </Badge>
      </div>

      <p className="text-sm text-gray-500">
        These are the boxes the order actually ships in. They replace the
        product dimensions when the order is confirmed, so they must be filled
        in before confirming.
        {isMultiBox
          ? " More than one box books as a Bigship B2B heavy shipment, which is priced on freight rates rather than normal parcel rates."
          : null}
      </p>

      {locked ? (
        <p className="text-sm font-semibold text-amber-700">
          {orderInfo.bigship_order_id
            ? `This order is already booked with the courier (${orderInfo.bigship_order_id}), so the boxes can no longer be changed.`
            : `This order is already ${orderInfo.order_status}, so the boxes can no longer be changed.`}
        </p>
      ) : null}

      <div className="w-56">
        <LabelInput
          label="No. of Boxes"
          type="number"
          min="1"
          max={String(MAX_BOXES)}
          disabled={locked}
          value={boxCount}
          onChange={(e) => onBoxCountChange(e.target.value)}
          // Leaving the field blank or on something unusable puts the real row
          // count back, so it never sits there disagreeing with the list.
          onBlur={() => setBoxCount(String(rows.length))}
        />
      </div>

      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={index} className="flex items-end gap-2.5">
            <span className="pb-2.5 text-sm font-semibold text-gray-500 w-8">
              #{index + 1}
            </span>

            <LabelInput
              label="Physical Weight (KG)"
              type="number"
              step="0.001"
              min="0"
              disabled={locked}
              value={String(row.weight_kg ?? "")}
              onChange={(e) => setField(index, "weight_kg", e.target.value)}
            />
            <LabelInput
              label="Length (CM)"
              type="number"
              step="1"
              min="1"
              disabled={locked}
              value={String(row.length_cm ?? "")}
              onChange={(e) => setField(index, "length_cm", e.target.value)}
            />
            <LabelInput
              label="Breadth (CM)"
              type="number"
              step="1"
              min="1"
              disabled={locked}
              value={String(row.breadth_cm ?? "")}
              onChange={(e) => setField(index, "breadth_cm", e.target.value)}
            />
            <LabelInput
              label="Height (CM)"
              type="number"
              step="1"
              min="1"
              disabled={locked}
              value={String(row.height_cm ?? "")}
              onChange={(e) => setField(index, "height_cm", e.target.value)}
            />

            <Button
              type="button"
              variant="ghost"
              disabled={locked || rows.length === 1}
              onClick={() => removeRow(index)}
              title="Remove this box"
            >
              <Trash2 className="text-red-600" />
            </Button>
          </div>
        ))}
      </div>

      {needsEwaybill ? (
        <div className="space-y-3 border-t border-gray-200 pt-4">
          <p className="text-sm font-semibold text-amber-700">
            This shipment is invoiced at ₹{invoiceAmount} across {rows.length}{" "}
            boxes, so Bigship requires an ewaybill.
          </p>

          <LabelInput
            label="Ewaybill Number (12 digits)"
            inputMode="numeric"
            maxLength={12}
            disabled={locked}
            value={ewaybillNumber}
            onChange={(e) =>
              setEwaybillNumber(e.target.value.replace(/\D/g, "").slice(0, 12))
            }
          />

          <div className="grid gap-3">
            <Label className="font-semibold">Ewaybill Document (PDF or JPEG)</Label>
            <Input
              type="file"
              accept="application/pdf,image/jpeg"
              disabled={locked}
              className="border-1 border-green-600"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) readDocument(file);
              }}
            />
            <span className="text-sm text-gray-500">
              {documentName
                ? `Selected: ${documentName}`
                : orderInfo.has_ewaybill_document
                  ? "A document is already on file. Choose a new one only to replace it."
                  : "No document attached yet."}
            </span>
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={locked}
          onClick={() => setRows((current) => [...current, emptyRow()])}
        >
          <Plus /> Add Box
        </Button>

        <Button
          type="button"
          className="bg-green-700 hover:bg-green-900"
          disabled={locked || isLoading}
          onClick={save}
        >
          {isLoading ? "Saving.." : "Save Boxes"}
        </Button>
      </div>
    </Section>
  );
}
