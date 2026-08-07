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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAutoDiscountRules } from "@/hooks/useAutoDiscountRules";
import LoadingHandler from "@/middleware/LoadingHandler";
import type { IAutoDiscountRule } from "@/types";
import { Pencil, Plus, Trash } from "lucide-react";
import { useState } from "react";

const formatRule = (rule: IAutoDiscountRule) => {
  const value = parseFloat(rule.value);
  const cap = rule.max_discount_amount
    ? parseFloat(rule.max_discount_amount)
    : 0;

  if (rule.type === "percentage") {
    return `${value}% off${cap > 0 ? ` (max ₹${cap})` : ""}`;
  }

  return `₹${value} off`;
};

export default function AutoDiscountRules() {
  const { rules, isRuleFetching, ruleError, isMutatingRule, mutateRule } =
    useAutoDiscountRules();

  // null = dialog closed, undefined id = creating a new rule
  const [editingRule, setEditingRule] = useState<IAutoDiscountRule | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const openForm = (rule: IAutoDiscountRule | null) => {
    setEditingRule(rule);
    setIsFormOpen(true);
  };

  return (
    <main className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-gray-500 max-w-2xl">
          Discounts that apply on their own once the order reaches an amount —
          the customer does not type any code. When more than one rule matches,
          the one with the highest priority wins (then the bigger slab). Only
          one rule ever applies to an order.
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
        noDataMsg="No automatic discount added yet"
      >
        <Table>
          <TableHeader>
            <TableRow className="bg-green-600 hover:!bg-green-600">
              <TableHead className="text-white">Rule</TableHead>
              <TableHead className="text-white">Order reaches</TableHead>
              <TableHead className="text-white">Discount</TableHead>
              <TableHead className="text-white text-center">
                With coupon
              </TableHead>
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
                <TableCell>₹{parseFloat(rule.min_order_amount)}</TableCell>
                <TableCell>{formatRule(rule)}</TableCell>
                <TableCell className="text-center">
                  {rule.stackable_with_coupon ? "Stacks" : "Skipped"}
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
                            "Are you sure you want to remove this automatic discount ?",
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
              {editingRule ? "Edit Automatic Discount" : "New Automatic Discount"}
            </DialogTitle>
            <DialogDescription>
              Applied automatically once the order value reaches the amount below.
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
  rule: IAutoDiscountRule | null;
  isSaving: boolean;
  onSubmit: (data: Record<string, any>) => void;
}) {
  const [type, setType] = useState<"percentage" | "fixed_amount">(
    rule?.type ?? "percentage",
  );
  const [stackable, setStackable] = useState(
    rule?.stackable_with_coupon ?? false,
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    onSubmit({
      title: form.get("title"),
      min_order_amount: parseFloat((form.get("min_order_amount") as string) || "0"),
      type,
      value: parseFloat((form.get("value") as string) || "0"),
      max_discount_amount:
        type === "percentage" && form.get("max_discount_amount")
          ? parseFloat(form.get("max_discount_amount") as string)
          : null,
      stackable_with_coupon: stackable,
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
        placeholder="Spend ₹2000, get 10% off"
        defaultValue={rule?.title}
      />

      <LabelInput
        required
        type="number"
        min="0"
        step="0.01"
        name="min_order_amount"
        label="Order amount to reach (₹)"
        placeholder="2000"
        defaultValue={rule?.min_order_amount}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <SelectInput
          required
          label="Discount by"
          value={type}
          onValueChange={(value) => setType(value as typeof type)}
          options={[
            { text: "By Percentage %", value: "percentage" },
            { text: "Fixed Amount", value: "fixed_amount" },
          ]}
        />

        <LabelInput
          required
          type="number"
          min="0"
          step="0.01"
          name="value"
          label={type === "percentage" ? "Percentage (%)" : "Amount (₹)"}
          defaultValue={rule?.value}
        />
      </div>

      {type === "percentage" ? (
        <LabelInput
          type="number"
          min="0"
          step="0.01"
          name="max_discount_amount"
          label="Maximum discount (₹)"
          placeholder="Leave empty for no limit"
          defaultValue={rule?.max_discount_amount ?? ""}
        />
      ) : null}

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

      <div className="flex items-center justify-between border rounded-lg p-4">
        <div className="space-y-1">
          <Label className="font-semibold">Allow with coupon code</Label>
          <p className="text-xs text-gray-500">
            Off means the rule is skipped when the customer already used a coupon.
          </p>
        </div>
        <Switch checked={stackable} onCheckedChange={setStackable} />
      </div>

      <div className="flex items-center justify-end">
        <ButtonLoading loading={isSaving}>Save</ButtonLoading>
      </div>
    </form>
  );
}
