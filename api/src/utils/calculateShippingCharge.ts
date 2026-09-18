import { PoolClient } from "pg";
import { pool } from "..";

export type IShippingRuleType = "flat" | "percentage" | "free";
export type IShippingPaymentScope = "ALL" | "COD" | "ONLINE";

export interface IShippingRuleRow {
  id: number;
  title: string;
  min_order_amount: string;
  max_order_amount: string | null;
  type: IShippingRuleType;
  value: string;
  max_charge_amount: string | null;
  payment_method: IShippingPaymentScope;
  priority: number;
}

export interface IAppliedShippingRule {
  id: number;
  title: string;
  type: IShippingRuleType;
  value: number;
  min_order_amount: number;
  max_order_amount: number | null;
  payment_method: IShippingPaymentScope;
}

export interface IShippingChargeResult {
  amount: number;
  rule: IAppliedShippingRule | null;
}

// Delivery charge for a cart. Mirrors calculateAutoDiscount: the CMS keeps a
// table of slabs and exactly one of them fires — highest priority first, then
// the bigger slab.
//
// `amount` is the payable cart value AFTER the coupon and the automatic
// discount, so a discount that pulls the cart under the free shipping
// threshold does put the charge back. `paymentMethod` lets a slab target COD
// only (a handling fee) or ONLINE only (free shipping when prepaid).
//
// No matching slab means free delivery, so an empty rules table keeps the old
// behaviour of the seller absorbing shipping.
export const calculateShippingCharge = async (
  amount: number,
  paymentMethod: "COD" | "ONLINE",
  client?: PoolClient,
): Promise<IShippingChargeResult> => {
  const noCharge: IShippingChargeResult = { amount: 0, rule: null };

  if (!Number.isFinite(amount) || amount < 0) return noCharge;

  const runner = client ?? pool;

  const { rows } = await runner.query<IShippingRuleRow>(
    `
    SELECT
      id, title, min_order_amount, max_order_amount, type, value,
      max_charge_amount, payment_method, priority
    FROM shipping_charge_rules
    WHERE status = 'active'
      AND (starts_at IS NULL OR starts_at <= NOW())
      AND (ends_at IS NULL OR ends_at >= NOW())
      AND min_order_amount <= $1
      -- upper bound is exclusive, so (0-1000) and (1000-∞) tile the range
      AND (max_order_amount IS NULL OR max_order_amount > $1)
      AND (payment_method = 'ALL' OR payment_method = $2)
    ORDER BY priority DESC, min_order_amount DESC, id DESC
    LIMIT 1
    `,
    [amount, paymentMethod],
  );

  if (rows.length === 0) return noCharge;

  const rule = rows[0];
  const ruleValue = parseFloat(rule.value);
  const cap =
    rule.max_charge_amount === null ? null : parseFloat(rule.max_charge_amount);

  let charge = 0;
  if (rule.type === "flat") charge = ruleValue;
  else if (rule.type === "percentage") charge = (amount * ruleValue) / 100;
  // 'free' stays at 0 : an explicit "no charge above this slab" row

  if (cap !== null && cap > 0) charge = Math.min(charge, cap);

  charge = parseFloat(Math.max(charge, 0).toFixed(2));

  return {
    amount: charge,
    // the rule is reported even when it charges nothing, so the cart can label
    // the row "Free delivery over ₹1000" instead of a bare "Free"
    rule: {
      id: rule.id,
      title: rule.title,
      type: rule.type,
      value: ruleValue,
      min_order_amount: parseFloat(rule.min_order_amount),
      max_order_amount:
        rule.max_order_amount === null
          ? null
          : parseFloat(rule.max_order_amount),
      payment_method: rule.payment_method,
    },
  };
};
