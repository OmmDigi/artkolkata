import { pool } from "..";
import {
  BXGYRule,
  CartItem,
  ConditionOperator,
  DiscountCondition,
  DiscountStatus,
  DiscountType,
  DiscountWithRelations,
  ValidationResult,
} from "../types";

// Calculate Buy X Get Y discount
export function calculateBXGYDiscount(
  rule: BXGYRule,
  cart_items: CartItem[]
): number {
  let discount = 0;

  const buyItems = cart_items.filter((item) =>
    rule.buy_product_ids.includes(item.product_id)
  );

  const getItems = cart_items.filter((item) =>
    rule.get_product_ids.includes(item.product_id)
  );

  const qualifyingSets = Math.floor(
    buyItems.reduce((sum, item) => sum + item.quantity, 0) / rule.buy_quantity
  );

  if (qualifyingSets > 0) {
    const freeQuantity = Math.min(
      qualifyingSets * rule.get_quantity,
      getItems.reduce((sum, item) => sum + item.quantity, 0)
    );

    // Apply discount to cheapest eligible items
    const sortedGetItems = [...getItems].sort((a, b) => a.price - b.price);
    let remaining = freeQuantity;

    for (const item of sortedGetItems) {
      const discountQty = Math.min(remaining, item.quantity);
      discount += (item.price * discountQty * rule.discount_value) / 100;
      remaining -= discountQty;
      if (remaining === 0) break;
    }
  }

  return discount;
}

// Helper function to calculate discount amount
export function calculateDiscountAmount(
  discount: DiscountWithRelations,
  cart_items: CartItem[],
  cart_total: number
): number {
  switch (discount.type) {
    case DiscountType.PERCENTAGE:
      return discount.value ? (cart_total * discount.value) / 100 : 0;

    case DiscountType.FIXED_AMOUNT:
      return discount.value ? Math.min(discount.value, cart_total) : 0;

    case DiscountType.FREE_SHIPPING:
      return 0; // Handle shipping in separate logic

    case DiscountType.BUY_X_GET_Y:
      if (discount.bxgy_rules && discount.bxgy_rules.length > 0) {
        return calculateBXGYDiscount(discount.bxgy_rules[0], cart_items);
      }
      return 0;

    default:
      return 0;
  }
}

// Helper function to check conditions
export function checkConditions(
  conditions: DiscountCondition[],
  cart_items: CartItem[]
): boolean {
  for (const condition of conditions) {
    if (condition.condition_type === "product") {
      const cartProductIds = cart_items.map((item) => item.product_id);

      if (condition.operator === ConditionOperator.INCLUDES) {
        const hasMatch = condition.target_ids.some((id) =>
          cartProductIds.includes(id)
        );
        if (!hasMatch) return false;
      }

      if (condition.operator === ConditionOperator.EXCLUDES) {
        const hasExcluded = condition.target_ids.some((id) =>
          cartProductIds.includes(id)
        );
        if (hasExcluded) return false;
      }
    }
  }
  return true;
}

// Helper function to validate discount
export async function validateDiscount(
  discount: DiscountWithRelations,
  customer_id: string | undefined,
  cart_items: CartItem[],
  cart_total: number
): Promise<ValidationResult> {
  const now = new Date();

  // Check status
  if (discount.status !== DiscountStatus.ACTIVE) {
    return { valid: false, reason: "Discount is not active" };
  }

  // Check date range
  if (discount.starts_at && new Date(discount.starts_at) > now) {
    return { valid: false, reason: "Discount has not started yet" };
  }

  if (discount.ends_at && new Date(discount.ends_at) < now) {
    return { valid: false, reason: "Discount has expired" };
  }

  // Check usage limit
  if (discount.usage_limit && discount.usage_count >= discount.usage_limit) {
    return { valid: false, reason: "Discount usage limit reached" };
  }

  // Check per-customer limit
  if (discount.per_customer_limit && customer_id) {
    const usageResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM discount_usage 
             WHERE discount_id = $1 AND customer_id = $2`,
      [discount.id, customer_id]
    );

    if (parseInt(usageResult.rows[0].count) >= discount.per_customer_limit) {
      return {
        valid: false,
        reason: "You have reached the usage limit for this discount",
      };
    }
  }

  // Check minimum purchase amount
  if (
    discount.minimum_purchase_amount &&
    cart_total < discount.minimum_purchase_amount
  ) {
    return {
      valid: false,
      reason: `Minimum purchase amount of $${discount.minimum_purchase_amount} required`,
    };
  }

  // Check conditions (product/collection eligibility)
  if (
    discount.conditions &&
    discount.conditions.length > 0 &&
    discount.conditions[0]
  ) {
    const eligible = checkConditions(discount.conditions, cart_items);
    if (!eligible) {
      return {
        valid: false,
        reason: "Cart does not meet discount requirements",
      };
    }
  }

  return { valid: true };
}
