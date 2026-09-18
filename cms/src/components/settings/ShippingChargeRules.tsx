import LabelInput from "@/components/LabelInput";
import SelectInput from "@/components/SelectInput";
import { Button } from "@/components/ui/button";
import { ButtonLoading } from "@/components/ui/button-loading";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useShippingRules } from "@/hooks/useShippingRules";
import LoadingHandler from "@/middleware/LoadingHandler";
import type { IShippingRule } from "@/types";
import { Pencil, Plus, Trash } from "lucide-react";
import { useState } from "react";

const formatSlab = (rule: IShippingRule) => {
  const min = parseFloat(rule.min_order_amount);
  const max = rule.max_order_amount ? parseFloat(rule.max_order_amount) : null;

  if (max === null) return `₹${min} and above`;
  if (min === 0) return `Below ₹${max}`;
  return `₹${min} to below ₹${max}`;
};

const formatCharge = (rule: IShippingRule) => {
  const value = parseFloat(rule.value);
  const cap = rule.max_charge_amount ? parseFloat(rule.max_charge_amount) : 0;

  if (rule.type === "free") return "Free";
  if (rule.type === "percentage") {
    return `${value}% of order${cap > 0 ? ` (max ₹${cap})` : ""}`;
  }
  return `₹${value}`;
};

const PAYMENT_LABEL: Record<IShippingRule["payment_method"], string> = {
  ALL: "Any",
  COD: "COD only",
  ONLINE: "Prepaid only",
};

export default function ShippingChargeRules() {
  const { rules, isRuleFetching, ruleError, isMutatingRule, mutateRule } =
    useShippingRules();

  // null = creating a new rule, a rule = editing that one
  const [editingRule, setEditingRule] = useState<IShippingRule | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const openForm = (rule: IShippingRule | null) => {
    setEditingRule(rule);
    setIsFormOpen(true);
  };

  return (
    <main className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-gray-500 max-w-2xl">
          What delivery costs the customer, decided by the order amount left
          after every discount. Each rule covers one slab — the "from" amount is
          included and the "below" amount is not, so a ₹99 charge below ₹1000
          plus a free rule from ₹1000 covers every cart. When more than one rule
          matches, the highest priority wins. With no rules at all, delivery is
          free.
        </p>

        <Button
          variant="own"
          className="flex items-center gap-1.5 shrink-0"
          onClick={() => openForm(null)}
        >
          <Plus size={16} />
          Add Rule
        </Button>
      </div>

      <LoadingHandler
        loading={isRuleFetching}
        error={ruleError}
        length={rules.length}
        noDataMsg="No shipping charge rule added yet — delivery is free"
      >
        <Table>
          <TableHeader>
            <TableRow className="bg-green-600 hover:!bg-green-600">
              <TableHead className="text-white">Rule</TableHead>
              <TableHead className="text-white">Order amount</TableHead>
              <TableHead className="text-white">Shipping charge</TableHead>
              <TableHead className="text-white text-center">Payment</TableHead>
              <TableHead className="text-white text-center">Priority</TableHead>
              <TableHead className="text-white text-center">Status</TableHead>
              <TableHead className="text-white text-right">Action</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {rules.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell className="font-medium">
                  {rule.title}
                  {rule.ends_at ? (
                    <span className="block text-xs font-normal text-gray-500">
                      Ends at: {rule.ends_at.replace("T", " ")}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell>{formatSlab(rule)}</TableCell>
                <TableCell>{formatCharge(rule)}</TableCell>
                <TableCell className="text-center">
                  {PAYMENT_LABEL[rule.payment_method]}
                </TableCell>
                <TableCell className="text-center">{rule.priority}</TableCell>
                <TableCell className="text-center">
                  {rule.status === "active" ? (
                    <span className="inline-block px-3.5 py-1 rounded-full bg-green-700 text-white">
                      Active
                    </span>
                  ) : (
                    <span className="inline-block px-3.5 py-1 rounded-full bg-red-700 text-white">
                      In Active
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-5">
                    <Pencil
                      size={16}
                      className="cursor-pointer"
                      onClick={() => openForm(rule)}
                    />
                    <Trash
                      size={16}
                      className="cursor-pointer"
                      onClick={() => {
                        if (
                          !confirm(
                            "Are you sure you want to remove this shipping rule ?",
                          )
                        )
                          return;
                        mutateRule({ type: "delete", id: rule.id });
                      }}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </LoadingHandler>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? "Edit Shipping Rule" : "New Shipping Rule"}
            </DialogTitle>
            <DialogDescription>
              Charged on top of the order total when the cart falls in this slab.
            </DialogDescription>
          </DialogHeader>

          {/* remount on rule change so the uncontrolled inputs pick up the values */}
          <RuleForm
            key={editingRule?.id ?? "new"}
            rule={editingRule}
            isSaving={isMutatingRule}
            onSubmit={(data) =>
              mutateRule({
                type: editingRule ? "update" : "add",
                id: editingRule?.id,
                data,
                onSuccess: () => setIsFormOpen(false),
              })
            }
          />
        </DialogContent>
      </Dialog>
    </main>
  );
}

function RuleForm({
  rule,
  isSaving,
  onSubmit,
}: {
  rule: IShippingRule | null;
  isSaving: boolean;
  onSubmit: (data: Record<string, any>) => void;
}) {
  const [type, setType] = useState<IShippingRule["type"]>(rule?.type ?? "flat");
  const [paymentMethod, setPaymentMethod] = useState<
    IShippingRule["payment_method"]
  >(rule?.payment_method ?? "ALL");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    const maxOrderAmount = form.get("max_order_amount") as string;

    onSubmit({
      title: form.get("title"),
      min_order_amount: parseFloat(
        (form.get("min_order_amount") as string) || "0",
      ),
      // empty means the slab has no upper bound
      max_order_amount: maxOrderAmount ? parseFloat(maxOrderAmount) : null,
      type,
      // a free rule charges nothing, the value input is not rendered for it
      value:
        type === "free"
          ? 0
          : parseFloat((form.get("value") as string) || "0"),
      max_charge_amount:
        type === "percentage" && form.get("max_charge_amount")
          ? parseFloat(form.get("max_charge_amount") as string)
          : null,
      payment_method: paymentMethod,
      status: form.get("status"),
      priority: parseInt((form.get("priority") as string) || "0"),
      starts_at: form.get("starts_at") || "",
      ends_at: form.get("ends_at") || "",
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <LabelInput
        required
        name="title"
        label="Rule name"
        placeholder="Free delivery over ₹1000"
        defaultValue={rule?.title}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <LabelInput
          required
          type="number"
          min="0"
          step="0.01"
          name="min_order_amount"
          label="Order amount from (₹)"
          placeholder="0"
          defaultValue={rule?.min_order_amount ?? 0}
        />

        <LabelInput
          type="number"
          min="0"
          step="0.01"
          name="max_order_amount"
          label="Order amount below (₹)"
          placeholder="Leave empty for no upper limit"
          defaultValue={rule?.max_order_amount ?? ""}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <SelectInput
          required
          label="Shipping charge"
          value={type}
          onValueChange={(value) => setType(value as typeof type)}
          options={[
            { text: "Fixed Amount", value: "flat" },
            { text: "By Percentage %", value: "percentage" },
            { text: "Free Delivery", value: "free" },
          ]}
        />

        {type === "free" ? null : (
          <LabelInput
            required
            type="number"
            min="0"
            step="0.01"
            name="value"
            label={type === "percentage" ? "Percentage (%)" : "Amount (₹)"}
            defaultValue={rule?.value}
          />
        )}
      </div>

      {type === "percentage" ? (
        <LabelInput
          type="number"
          min="0"
          step="0.01"
          name="max_charge_amount"
          label="Maximum shipping charge (₹)"
          placeholder="Leave empty for no limit"
          defaultValue={rule?.max_charge_amount ?? ""}
        />
      ) : null}

      <SelectInput
        required
        label="Applies to payment method"
        value={paymentMethod}
        onValueChange={(value) =>
          setPaymentMethod(value as typeof paymentMethod)
        }
        options={[
          { text: "Both COD and Prepaid", value: "ALL" },
          { text: "Cash on delivery only", value: "COD" },
          { text: "Prepaid (online) only", value: "ONLINE" },
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <LabelInput
          type="datetime-local"
          name="starts_at"
          label="Start date (optional)"
          defaultValue={rule?.starts_at ?? ""}
        />
        <LabelInput
          type="datetime-local"
          name="ends_at"
          label="End date (optional)"
          defaultValue={rule?.ends_at ?? ""}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <LabelInput
          type="number"
          min="0"
          name="priority"
          label="Priority"
          placeholder="0"
          defaultValue={rule?.priority ?? 0}
        />

        <SelectInput
          required
          label="Status"
          name="status"
          options={[
            { text: "Active", value: "active" },
            { text: "Inactive", value: "disabled" },
          ]}
          defaultValue={rule?.status ?? "active"}
        />
      </div>

      <div className="flex items-center justify-end">
        <ButtonLoading loading={isSaving}>Save</ButtonLoading>
      </div>
    </form>
  );
}
