import { GST_PERCENTAGE, SHIPPING_CHARGE_STATIC } from "../constant";
import { IAppliedAutoDiscount, IAutoDiscountResult } from "./calculateAutoDiscount";

export interface IPriceBreakdown {
  subtotal: number;
  discount: number;
  coupon_discount: number;
  auto_discount: number;
  auto_discount_rule: IAppliedAutoDiscount | null;
  gst_percentage: number;
  gst_amount: number;
  shipping_charge: number;
  total: number;
}

export interface IPriceBreakdownInput {
  subTotal: number;
  priceAfterDiscount: number;
  couponDiscount: number;
  autoDiscount: IAutoDiscountResult;
}

const round2 = (value: number) => parseFloat(value.toFixed(2));

// The one place cart money is turned into a payable amount. Both the checkout
// preview (getPriceBreakdown) and the order that actually gets charged
// (createOrder) go through here, so the customer can never be shown one total
// and billed another.
//
// Two house rules:
//   * GST (fixed 18%) is already inside the product prices, so it is reverse
//     calculated for display only and never added on top.
//   * Shipping is not charged to the customer at all.
export const buildPriceBreakdown = ({
  subTotal,
  priceAfterDiscount,
  couponDiscount,
  autoDiscount,
}: IPriceBreakdownInput): IPriceBreakdown => {
  const baseAmount = round2(priceAfterDiscount - autoDiscount.amount);
  const discountAmount = round2(couponDiscount + autoDiscount.amount);

  // ₹118 inclusive of 18% GST carries ₹18 of tax : amount * 18 / 118
  const gstAmount = round2(
    (baseAmount * GST_PERCENTAGE) / (100 + GST_PERCENTAGE),
  );

  return {
    subtotal: round2(subTotal),
    discount: discountAmount,
    coupon_discount: round2(couponDiscount),
    auto_discount: round2(autoDiscount.amount),
    // { id, title, type, value, min_order_amount } — lets the cart label the row
    auto_discount_rule: autoDiscount.rule,
    gst_percentage: GST_PERCENTAGE,
    gst_amount: gstAmount,
    shipping_charge: SHIPPING_CHARGE_STATIC,
    total: baseAmount,
  };
};
