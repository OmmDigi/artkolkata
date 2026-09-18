import { useEffect, useState } from "react";
import { AlertTriangle, Undo2 } from "lucide-react";
import { toast } from "react-toastify";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "../ui/button";
import { ButtonLoading } from "../ui/button-loading";
import LabelInput from "../LabelInput";
import LabelTextArea from "../LabelTextArea";
import { useDoMutation } from "@/hooks/useDoMutation";
import type { OrderInfo, PaymentInfo } from "@/types";

interface IProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  orderId: string;
  orderInfo: OrderInfo;
  paymentInfo: PaymentInfo;
  onDone: () => void;
}

const money = (value: number) =>
  `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function RefundDialog({
  open,
  setOpen,
  orderId,
  orderInfo,
  paymentInfo,
  onDone,
}: IProps) {
  const { isLoading, mutate } = useDoMutation();

  const paid = parseFloat(paymentInfo.amount ?? orderInfo.total_amount ?? "0");
  const alreadyRefunded = parseFloat(paymentInfo.refunded_amount ?? "0");
  // Rounded for the same reason the api rounds it: a floating point remainder
  // of a hundredth of a paisa would fail the api's ceiling check on a refund
  // the admin was told was allowed.
  const remaining = Math.round((paid - alreadyRefunded) * 100) / 100;

  // Prefilled with everything that is left, because that is the usual refund —
  // the admin only touches it for a partial.
  const [amount, setAmount] = useState(remaining.toFixed(2));
  const [note, setNote] = useState("");

  // The dialog stays mounted between openings, so a stale amount from the last
  // time it was opened would otherwise be sitting in the field.
  useEffect(() => {
    if (open) {
      setAmount(remaining.toFixed(2));
      setNote("");
    }
  }, [open, remaining]);

  const isCod = orderInfo.payment_method !== "ONLINE";
  // An order paid through a gateway that is no longer the live one cannot be
  // refunded through the api — the live gateway knows nothing about it.
  const provider = paymentInfo.provider ?? "";

  const submit = (skipGateway: boolean) => {
    const value = parseFloat(amount);

    if (Number.isNaN(value) || value <= 0)
      return toast.error("Enter a refund amount");

    if (value > remaining)
      return toast.error(`Only ${money(remaining)} is left to refund`);

    if (skipGateway && note.trim().length < 3)
      return toast.error(
        "Say where the refund was actually made before recording it",
      );

    mutate({
      apiPath: `/api/v1/payments/refund/${orderId}`,
      method: "post",
      formData: {
        amount: value,
        skip_gateway: skipGateway,
        note: note.trim(),
      },
      onSuccess() {
        setOpen(false);
        onDone();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="w-5 h-5" />
            Refund order #{orderInfo.order_number}
          </DialogTitle>
          <DialogDescription>
            {isCod
              ? "This order was paid cash on delivery, so there is no gateway to refund through. Hand the money back, then record it here."
              : `Paid through ${provider || "the payment gateway"}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border border-gray-200 divide-y text-sm">
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-gray-600">Amount paid</span>
              <span className="font-semibold">{money(paid)}</span>
            </div>
            {alreadyRefunded > 0 ? (
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-gray-600">Already refunded</span>
                <span className="font-semibold">{money(alreadyRefunded)}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-gray-600">Left to refund</span>
              <span className="font-semibold">{money(remaining)}</span>
            </div>
          </div>

          <LabelInput
            label="Refund amount"
            type="number"
            step="0.01"
            min="0"
            max={remaining}
            value={amount}
            onChange={(event) => setAmount(event.currentTarget.value)}
          />
          {parseFloat(amount) < remaining && parseFloat(amount) > 0 ? (
            <p className="text-xs text-amber-700">
              Partial refund. {money(remaining - parseFloat(amount))} will still
              be refundable afterwards.
            </p>
          ) : null}

          <LabelTextArea
            label={isCod ? "Note *" : "Note"}
            rows={3}
            placeholder="e.g. refunded by hand in the PhonePe portal, ref ABC123"
            value={note}
            onChange={(event) => setNote(event.currentTarget.value)}
          />

          <div className="flex gap-2 rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              <span className="font-semibold">Record only</span> moves no money.
              Use it when the refund was already made in the gateway's own
              portal, or for cash handed back — it just writes it down here. A
              note is required so the next person knows where the money went.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>

          <ButtonLoading
            variant="secondary"
            loading={isLoading}
            onClick={() => submit(true)}
          >
            Record only
          </ButtonLoading>

          {/* A COD order was never paid through a gateway, so there is nothing
              for the api to refund against. */}
          {isCod ? null : (
            <ButtonLoading loading={isLoading} onClick={() => submit(false)}>
              Refund via {provider || "gateway"}
            </ButtonLoading>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
