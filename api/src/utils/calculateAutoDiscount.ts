import { PoolClient } from "pg";
import { pool } from "..";

export interface IAutoDiscountRuleRow {
  id: number;
  title: string;
  min_order_amount: string;
  type: "percentage" | "fixed_amount";
  value: string;
  max_discount_amount: string | null;
  stackable_with_coupon: boolean;
  priority: number;
}

export interface IAppliedAutoDiscount {
  id: number;
  title: string;
  type: "percentage" | "fixed_amount";
  value: number;
  min_order_amount: number;
}

export interface IAutoDiscountResult {
  amount: number;
  rule: IAppliedAutoDiscount | null;
}

// Order value discount that needs no coupon code. The rule with the highest
// priority (then the biggest slab) among the ones the cart qualifies for wins —
// only one rule ever applies, they never add up.
//
// `amount` is the cart value the slab is compared against and the percentage is
// taken from: subtotal when no coupon was used, the post coupon amount otherwise.
export const calculateAutoDiscount = async (
  amount: number,
  hasCoupon: boolean,
  client?: PoolClient
): Promise<IAutoDiscountResult> => {
  const noDiscount: IAutoDiscountResult = { amount: 0, rule: null };

  if (!Number.isFinite(amount) || amount <= 0) return noDiscount;

  const runner = client ?? pool;

  const { rows } = await runner.query<IAutoDiscountRuleRow>(
    `
    SELECT
      id, title, min_order_amount, type, value,
      max_discount_amount, stackable_with_coupon, priority
    FROM auto_discount_rules
    WHERE status = 'active'
      AND (starts_at IS NULL OR starts_at <= NOW())
      AND (ends_at IS NULL OR ends_at >= NOW())
      AND min_order_amount <= $1
      AND ($2 = false OR stackable_with_coupon = true)
    ORDER BY priority DESC, min_order_amount DESC, id DESC
    LIMIT 1
    `,
    [amount, hasCoupon]
  );

  if (rows.length === 0) return noDiscount;

  const rule = rows[0];
  const ruleValue = parseFloat(rule.value);
  const cap =
    rule.max_discount_amount === null
      ? null
      : parseFloat(rule.max_discount_amount);

  let discount =
    rule.type === "percentage" ? (amount * ruleValue) / 100 : ruleValue;

  if (cap !== null && cap > 0) discount = Math.min(discount, cap);

  // never let a rule push the payable amount below zero
  discount = Math.min(discount, amount);
  discount = parseFloat(Math.max(discount, 0).toFixed(2));

  if (discount === 0) return noDiscount;

  return {
    amount: discount,
    rule: {
      id: rule.id,
      title: rule.title,
      type: rule.type,
      value: ruleValue,
      min_order_amount: parseFloat(rule.min_order_amount),
    },
  };
};
