import { PoolClient } from "pg";
import { pool } from "../..";
import { GST_PERCENTAGE } from "../../constant";
import { ErrorHandler } from "../../utils/ErrorHandler";
import { IOrderAddressSnapshot } from "../../types";
import { IPriceBreakdown } from "../../utils/buildPriceBreakdown";

// One order, flattened into exactly what the invoice and the packing slip
// print. Both documents read the same object: the slip ignores the money, the
// invoice uses all of it, and neither of them touches the database itself.
// One product that went inside a combo. It carries no price of its own: the
// combo was sold and charged as a single line, and these are printed only so
// the reader knows what that line contained.
export interface IOrderDocumentBundleItem {
  name: string;
  sku: string | null;
  // "Red / 20g" when the combo named a specific variant, otherwise null
  variantLabel: string | null;
  // per one combo — multiplied by the line quantity for display
  quantity: number;
}

export interface IOrderDocumentItem {
  name: string;
  sku: string | null;
  quantity: number;
  // unit price, GST inclusive, as it was at checkout
  price: number;
  lineTotal: number;
  // what was inside, when this line was a combo. Empty for every ordinary
  // product, which is what makes it safe to render unconditionally.
  bundleItems: IOrderDocumentBundleItem[];
}

export interface IOrderDocumentData {
  orderId: number;
  orderNumber: string;
  orderDate: Date;
  paymentMethodLabel: string;
  // the slab that priced the delivery ("Flat Rate"), shown on the packing slip
  // as the shipping method and next to the shipping charge on the invoice
  shippingMethod: string;

  customerName: string;
  addressLines: string[];
  customerEmail: string | null;
  customerPhone: string | null;

  items: IOrderDocumentItem[];

  subtotal: number;
  couponCode: string | null;
  couponDiscount: number;
  autoDiscount: number;
  autoDiscountTitle: string | null;
  shipping: number;
  // GST is already inside the prices — it is reported, never added
  gstPercentage: number;
  gstAmount: number;
  total: number;

  // set once the invoice has been generated at least once
  invoiceNumber: string | null;
  invoiceGeneratedAt: Date | null;
  invoicePdfUrl: string | null;
  packingSlipUrl: string | null;
}

const round2 = (value: number) => parseFloat(value.toFixed(2));

const num = (value: any) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

// The address block on both documents, in the order it is printed. City and
// pincode share a line the way a postal address is written; anything missing
// from the snapshot just drops out instead of leaving a blank line behind.
const buildAddressLines = (address: Partial<IOrderAddressSnapshot>) =>
  [
    address.address_line1,
    address.address_line2,
    [address.city, address.pincode].filter(Boolean).join(" "),
    address.state,
  ]
    .map((line) => (line ?? "").toString().trim())
    .filter((line) => line.length > 0);

/**
 * Loads everything the two documents print.
 *
 * Money is read from the `price_breakdown` snapshot the order was placed with,
 * exactly as the payment slip does, so a generated invoice always agrees with
 * what the customer was charged even after a discount rule or a shipping slab
 * has since been edited. Orders placed before that column existed fall back to
 * the flat columns with GST reverse calculated at the current rate.
 *
 * `client` is accepted so a caller that is already inside a transaction (the
 * generate endpoints are, because they allot the invoice number in the same
 * breath) reads the order it just locked rather than a second snapshot of it.
 */
export const getOrderDocumentData = async (
  orderId: number,
  client: PoolClient | typeof pool = pool,
): Promise<IOrderDocumentData> => {
  const orderInfo = await client.query(
    `
     SELECT
      order_id,
      order_number,
      created_at,
      subtotal,
      discount,
      coupon_discount,
      auto_discount,
      shipping_charge,
      total_amount,
      coupon_code,
      payment_method,
      courier_name,
      shipping_address,
      price_breakdown,
      invoice_number,
      invoice_generated_at,
      invoice_pdf_url,
      packing_slip_url
     FROM orders
     WHERE order_id = $1
    `,
    [orderId],
  );

  if (orderInfo.rowCount === 0)
    throw new ErrorHandler(404, "Order information not found!");

  const order = orderInfo.rows[0];
  const address: Partial<IOrderAddressSnapshot> = order.shipping_address ?? {};
  const snapshot: Partial<IPriceBreakdown> = order.price_breakdown ?? {};

  const orderItems = await client.query(
    `
     SELECT
      oi.quantity,
      oi.price,
      oi.subtotal,

      CASE
       WHEN oi.variant_info IS NOT NULL
       THEN oi.variant_info->>'product_name'
       ELSE oi.product_info->>'name'
      END AS product_name,

      CASE
       WHEN oi.variant_info IS NOT NULL
       THEN oi.variant_info->>'sku'
       ELSE null
      END AS sku,

      -- the combo contents frozen onto the line at checkout, so a document
      -- reprinted later lists what actually went in the box
      COALESCE(
       oi.variant_info->'bundle_items',
       oi.product_info->'bundle_items',
       '[]'::jsonb
      ) AS bundle_items

     FROM order_items oi
     WHERE oi.order_id = $1
     ORDER BY oi.order_item_id ASC
    `,
    [orderId],
  );

  const subtotal = num(snapshot.subtotal ?? order.subtotal);
  const total = num(snapshot.total ?? order.total_amount);
  const gstPercentage = num(snapshot.gst_percentage ?? GST_PERCENTAGE);
  const gstAmount = round2(
    num(
      snapshot.gst_amount ?? (total * gstPercentage) / (100 + gstPercentage),
    ),
  );

  return {
    orderId: order.order_id,
    orderNumber: order.order_number,
    orderDate: new Date(order.created_at),
    paymentMethodLabel:
      order.payment_method === "COD" ? "Cash on delivery" : "Online Paid",
    // the priced slab names the service; the courier is only known once the
    // parcel is booked, and plain "Standard" covers an order that is neither
    shippingMethod:
      snapshot.shipping_rule?.title ?? order.courier_name ?? "Standard",

    customerName: (address.name ?? "").trim(),
    addressLines: buildAddressLines(address),
    customerEmail: (address.email ?? "").trim() || null,
    customerPhone: (address.phone ?? "").trim() || null,

    items: orderItems.rows.map((item: any) => ({
      name: item.product_name ?? "",
      sku: item.sku ?? null,
      quantity: num(item.quantity),
      price: num(item.price),
      lineTotal: num(item.subtotal ?? num(item.price) * num(item.quantity)),
      bundleItems: ((item.bundle_items ?? []) as any[]).map((child) => ({
        name: child.name ?? "",
        sku: child.sku ?? null,
        variantLabel: child.variant_label ?? null,
        quantity: num(child.quantity) || 1,
      })),
    })),

    subtotal,
    couponCode: order.coupon_code ?? null,
    couponDiscount: num(snapshot.coupon_discount ?? order.coupon_discount),
    autoDiscount: num(snapshot.auto_discount ?? order.auto_discount),
    autoDiscountTitle: snapshot.auto_discount_rule?.title ?? null,
    shipping: num(snapshot.shipping_charge ?? order.shipping_charge),
    gstPercentage,
    gstAmount,
    total,

    invoiceNumber: order.invoice_number ?? null,
    invoiceGeneratedAt: order.invoice_generated_at
      ? new Date(order.invoice_generated_at)
      : null,
    invoicePdfUrl: order.invoice_pdf_url ?? null,
    packingSlipUrl: order.packing_slip_url ?? null,
  };
};
