export interface IResponse<T = null> {
  statusCode: number;
  message: string;
  data: T;
  key: string[];
  totalPage: number;
}

export interface IError {
  statusCode: number;
  message: string;
  key: string[];
}

export interface ICategory {
  id: number;
  name: string;
  slug: string;
  image: string;
  alt_tag: string | null;
  position: number;
  is_visible: boolean;
  sub_categories: ISubCategory[];
}

export interface IProductTag {
  id: number;
  name: string;
}

export interface IRecipient {
  id: number;
  tag_name: string | null;
  image: string | null;
  alt_tag: string | null;
  status: number;
}

export interface ISubCategory {
  category_id: number | null;
  category : string | null;
  id: number;
  name: string;
  slug: string;
  image: string;
  alt_tag: string | null;
  position: number;
}

export type TMediaTypes = "image" | "youtube-link";

export interface IGalleryItem {
  media_item_id: number;
  media_type: TMediaTypes;
  item_link: string;
  alt_tag: string;
}

export type TMediaWhereToUse = "gallery" | "banner" | "thumbnail";

export type ChoosedMediaItem = {
  media_id: number;
  where_to_use: TMediaWhereToUse;
  item_link: string;
  alt_tag: string;
};

export interface IChoosedMediaItem {
  selectedMedia: ChoosedMediaItem[];
}

export interface IUploadedFile {
  url: string;
  downloadUrl: string;
  pathname: string;
  contentType?: string;
  contentDisposition: string;
}

export type TProductMediaType = "thumbnail" | "gallery-item";

export interface IProductsGallery extends ChoosedMediaItem {
  type: TProductMediaType;
}

// export interface IProducts {
//   id: number;
//   title: string;
//   short_desc: string;
//   description: string;
//   category_id: number;
//   status: string;
//   created_at: string;
//   updated_at: string;
//   product_gallery: IProductsGallery[];
// }

export interface IInquiry {
  id: number;
  product_id: number | null;
  name: string;
  email: string;
  phone: string;
  message: string | null;
  business_name: string | null;
  quantity: number | null;
  created_at: string;

  product_name: string | null;
  product_images:
    | {
        alt_tag: string | null;
        id: number;
        image: string;
        position: number;
        product_id: number;
      }[]
    | null;
}

export interface OptionValue {
  id: number;
  value: string;
}

export interface Option {
  id: number;
  name: string;
  values: OptionValue[];
}

export type MediaType = "image" | "video";

// `image` holds the url of the media, for a video item it holds the video link
export type ImageTypes = {
  image: string;
  alt_tag: string | null;
  type: MediaType;
};

export interface Variant {
  id: number;
  combination: string[];
  images: ImageTypes[];
  isNew?: boolean;
  price: string;
  compareAtPrice: string;
  quantity: string;
  sku: string;
  available: boolean;
}

export interface IProducts {
  id: number;
  sku_id: string;
  name: string;
  slug: string | null;
  position: number;
  description_json: any | null;
  category_id: number;
  category_name : string;
  sub_category_id: number | null;
  price: string;
  compare_at_price: string;
  available_quantity: number;
  weight_kg: string;
  length_cm: string;
  breadth_cm: string;
  height_cm: string;
  meta_title: string | null;
  meta_description: string | null;
  status: number;
  tags: Record<string, true> | null;
  created_at: string;
  updated_at: string;
  variants: Variant[];
  options: Option[];
  product_for: string;
  images: {
    id: number;
    product_id: number;
    image: string;
    alt_tag: string | null;
    position: number;
    type: MediaType;
  }[];
  isAlreadyOrdered : boolean
}

export interface IOrderList {
  order_id: number;
  order_number: string;
  user_name: string;
  // from the address snapshot on the order, which is the only contact detail a
  // guest order has
  user_email: string | null;
  // placed without logging in. Read off the order rather than the customer, so
  // a guest who has since made an account still shows as one here.
  is_guest_order: boolean;
  total_amount: number;
  payment_status: string;
  // ONLINE or COD. Older rows predate the column, so it can come back null.
  payment_method: string | null;
  order_status: string;
  order_date: string;
  // True when an invoice of either kind exists — uploaded from the CMS or
  // generated here — in which case invoice_url is set. The payment slip the app
  // renders is always available.
  invoice_avilable: boolean;
  invoice_uploaded: boolean;
  invoice_generated: boolean;
  invoice_number: string | null;
  packing_slip_available: boolean;
  invoice_url: string | null;
  payment_slip_url: string;
  // the generated packing slip, null until it has been generated
  packing_slip_url: string | null;
}

export interface OrderResponse {
  orderInfo: OrderInfo;
  addressInfo: AddressInfo;
  paymentInfo: PaymentInfo;
  orderItemsInfo: OrderItemInfo[];
  // The partner the API is running with right now, not the one that booked this
  // order. Optional because an older API build does not send it — see how
  // SingleOrderPage defaults it.
  shippingInfo?: ShippingInfo;
}

export interface ShippingInfo {
  // false when SHIPPING_PARTNER=none : nothing is booked and no tracking scan
  // will ever move an order along, so the admin drives every status by hand
  enabled: boolean;
  partner: string;
  partner_label: string;
}

export interface PriceBreakdown {
  subtotal: number;
  discount: number;
  coupon_discount: number;
  auto_discount: number;
  auto_discount_rule: {
    id: number;
    title: string;
    type: "percentage" | "fixed_amount";
    value: number;
    min_order_amount: number;
  } | null;
  // informational only : GST is already inside the product prices
  gst_percentage: number;
  gst_amount: number;
  // comes from the shipping_charge_rules slabs and IS added to the total
  shipping_charge: number;
  // the slab that fired, reported even when it charges nothing, so the row can
  // be labelled ("Free over ₹1000")
  shipping_rule: {
    id: number;
    title: string;
    type: "flat" | "percentage" | "free";
    value: number;
    min_order_amount: number;
    max_order_amount: number | null;
    payment_method: "ALL" | "COD" | "ONLINE";
  } | null;
  total: number;
}

// One physical box of the shipment, keyed in by the admin. Bigship types the
// edges as int cm, hence the whole numbers.
export interface ShipmentBox {
  weight_kg: number | string;
  length_cm: number | string;
  breadth_cm: number | string;
  height_cm: number | string;
}

export interface OrderInfo {
  user_id: number;
  // Placed without logging in. There is no account to look up behind it, so
  // the shipping details on the order are the only way to reach the customer.
  is_guest_order: boolean;
  order_number: string;
  subtotal: string;
  discount: string;
  shipping_charge: string;
  total_amount: string;
  coupon_code: string | null;
  order_status: string;
  payment_status: string;
  payment_method: string;
  price_breakdown: PriceBreakdown | null;
  // Whoever booked the parcel writes the same three columns — see the api's
  // IShippingPartner. partner_order_id being set means it is with the courier.
  shipping_partner: string | null;
  partner_order_id: string | null;
  partner_shipment_id: string | null;
  waybill: string | null;
  courier_name: string | null;
  shipment_boxes: ShipmentBox[] | null;
  ewaybill_number: string | null;
  has_ewaybill_document: boolean;
  has_invoice_document: boolean;
  // the two documents generated from the CMS. The uploaded invoice above still
  // wins over a generated one when both exist.
  has_generated_invoice: boolean;
  has_packing_slip: boolean;
  invoice_number: string | null;
  invoice_generated_at: string | null;
  packing_slip_generated_at: string | null;
}

export interface AddressInfo {
  address_id: number;
  name: string;
  phone: string;
  email: string;
  address_line1: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export type PaymentInstrumentType =
  | "UPI"
  | "CARD"
  | "NETBANKING"
  | "WALLET"
  | "EMI"
  | "PAY_LATER"
  | "COD"
  | "OTHER";

/**
 * The pieces the api pulled out of the gateway's instrument payload. Whichever
 * ones that gateway sent are filled in; the rest are null.
 */
export interface PaymentInstrumentDetail {
  type: PaymentInstrumentType;
  label: string;
  upiId?: string | null;
  cardLast4?: string | null;
  cardNetwork?: string | null;
  cardType?: string | null;
  bank?: string | null;
  wallet?: string | null;
  /** UTR / RRN — the number on the customer's own bank statement. */
  referenceId?: string | null;
}

export interface PaymentInfo {
  payment_id: number;
  order_id: number;
  provider: string;
  provider_order_id: string;
  provider_payment_id: string;
  amount: string;
  currency: string;
  status: string;
  response: any | null;
  created_at: string; // ISO date string

  // How the customer actually paid. payment_method on the order only says
  // ONLINE or COD; these say UPI, or which card, and stay null on an online
  // order until the gateway reports the attempt.
  payment_instrument: PaymentInstrumentType | null;
  instrument_label: string | null;
  instrument_detail: PaymentInstrumentDetail | null;

  // Refund audit. Null until somebody refunds the order.
  refunded_amount: string | null;
  refund_note: string | null;
  refunded_by: number | null;
  refunded_by_name: string | null;
  refunded_at: string | null;
  // false when an admin settled the refund outside this system and only
  // recorded it here.
  refunded_via_gateway: boolean | null;
}

export interface OrderItemInfo {
  order_item_id: number;
  quantity: number;
  price: string;
  subtotal: string;
  product_name: string;
  sku: string | null;
  status: string;
  images?: ProductImage;
}

export interface ProductImage {
  image: string;
  alt_tag: string | null;
  product_variant_id: number;
}

export interface IReviews {
  id: number;
  user_id: number;
  stars: number;
  message: string;
  status: number;
  created_at: string;
  user_name: string;
  product_name: string;
  product_id: number;
}

export interface IUsers {
  id: number;
  name: string;
  email: string;
  phone_no: string;
  role: string;
  is_verified: boolean;
  is_active: boolean;
  password: string;
  // A shadow row left by guest checkout : no password, never verified, cannot
  // be logged into. It becomes an ordinary account the moment the customer
  // sets a password.
  is_guest: boolean;
}

export interface IUserProfile extends IUsers {
  user_address: AddressInfo[];
  permissions: Record<string, string>;
}

export interface IUserOrders extends OrderInfo {
  order_id: number;
  ordered_products: OrderItemInfo[];
}

export interface IUserWishlistItem {
  wishlist_id: number;
  added_at: string;
  product_id: number;
  product_name: string;
  product_slug: string | null;
  product_status: number;
  category_name: string | null;
  min_price: string | null;
  max_price: string | null;
  image: string | null;
}

export type InputOptions = {
  value: string;
  text: string;
};

export interface INavItem {
  id: string;
  title: string;
  url: string;
  items: INavItem[];
}

export interface ISideBar {
  dropdownOptions: string[];
  navItem: INavItem[];
}

// The byline printed on a post. Stored once and attached to many posts, so
// editing a bio here fixes it everywhere that author appears.
export interface IBlogAuthor {
  id: number;
  name: string;
  designation: string | null;
  bio: string | null;
  image: string | null;
  email: string | null;
  website_url: string | null;
}

// One piece of blog media, same shape as a product image: "image" is an
// uploaded file, "video" is a link (YouTube) kept in the same image field.
export interface IBlogMedia {
  id?: number;
  image: string;
  alt_tag: string | null;
  type: MediaType;
  position?: number;
}

// The share-card values the api resolves for the website: an OG field left
// empty falls back to the post's own meta, then to its title and cover.
export interface IBlogSeo {
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  og_type: string | null;
  canonical_url: string | null;
  twitter_card: string | null;
  twitter_title: string | null;
  twitter_description: string | null;
  twitter_image: string | null;
}

export interface IBlog {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  content_json: any | null;
  cover_image: string | null;
  cover_image_alt: string | null;
  media?: IBlogMedia[];
  tags: string | null;
  status: "draft" | "published";
  /** ISO instant the post is meant to go public, null when never published */
  published_at: string | null;
  published_at_label: string | null;
  /** published, but the date has not arrived yet */
  is_scheduled: boolean;
  /** actually readable by the public right now */
  is_live: boolean;
  meta_title: string | null;
  meta_description: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  og_type: string | null;
  canonical_url: string | null;
  twitter_card: string | null;
  twitter_title: string | null;
  twitter_description: string | null;
  twitter_image: string | null;
  seo?: IBlogSeo;
  /** the blog_authors row shown as the byline */
  blog_author_id: number | null;
  author?: IBlogAuthor | null;
  /** the admin account that created the row, kept for audit */
  author_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface IContactEntry {
  label: string;
  value: string;
  is_primary: boolean;
}

export interface IAddressEntry {
  label: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  map_url: string;
  is_primary: boolean;
}

// promo strip shown across the storefront, link is optional (null when empty)
export interface IRibbonSection {
  text: string;
  link: string | null;
}

// Which payment methods checkout offers. At least one must stay on : the API
// refuses a save that turns both off.
export interface IPaymentMethodSettings {
  cod_enabled: boolean;
  online_enabled: boolean;
}

// Whether checkout takes an order from someone who is not logged in. Off puts
// the store back to requiring an account, which is where it was before guest
// checkout existed.
export interface IGuestCheckoutSettings {
  enabled: boolean;
}

export interface ISiteInfo {
  site_logo: string;
  site_logo_alt: string;
  contact_emails: IContactEntry[];
  contact_phones: IContactEntry[];
  site_addresses: IAddressEntry[];
  ribbon_section: IRibbonSection;
  payment_methods: IPaymentMethodSettings;
  guest_checkout: IGuestCheckoutSettings;
}

export interface IBanner {
  id: number;
  image_url: string;
  // device specific artwork, both optional : image_url is the fallback
  mobile_image_url: string | null;
  tablet_image_url: string | null;
  alt_text: string | null;
  link_url: string | null;
  position: number;
  is_active: boolean;
}

// order value discount that applies without any coupon code
export interface IAutoDiscountRule {
  id: number;
  title: string;
  min_order_amount: string;
  type: "percentage" | "fixed_amount";
  value: string;
  max_discount_amount: string | null;
  stackable_with_coupon: boolean;
  status: "active" | "disabled";
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
}

// one slab of the conditional shipping charge table.
// min_order_amount is inclusive, max_order_amount is exclusive (null = no cap)
export interface IShippingRule {
  id: number;
  title: string;
  min_order_amount: string;
  max_order_amount: string | null;
  type: "flat" | "percentage" | "free";
  value: string;
  max_charge_amount: string | null;
  payment_method: "ALL" | "COD" | "ONLINE";
  status: "active" | "disabled";
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
}

// ============================================================
// DASHBOARD ANALYTICS
//
// Mirrors api/src/controllers/analytics.controller.ts. See
// api/docs/dashboard-analytics-api.md for what each number means.
// ============================================================

export type TAnalyticsPreset = "today" | "7d" | "30d" | "3m" | "1y" | "custom";

export interface IAnalyticsRange {
  preset: TAnalyticsPreset;
  label: string;
  timezone: string;
  /** IST wall clock, inclusive */
  start_at: string;
  /** IST wall clock, EXCLUSIVE — a 30 day window ending today reads as the 17th */
  end_at: string;
}

export interface IDashboardKpi {
  range: IAnalyticsRange;
  total_sales: {
    gross: number;
    /** gross minus refunds ISSUED in this window, so it can be negative */
    net: number;
    subtotal: number;
    discount: number;
    shipping: number;
    average_order_value: number;
  };
  orders: { total: number };
  products_sold: { total: number };
  customers: { new: number; buying: number };
  refunds: {
    amount: number;
    count: number;
    /** null when the window made no sales — render as an em dash, never as 0% */
    rate: number | null;
  };
}

export interface IAnalyticsPoint {
  /** IST start of the bucket, "YYYY-MM-DDTHH:mm" */
  bucket: string;
  revenue: number;
  orders: number;
  units: number;
}

export interface IAnalyticsTimeseries {
  range: IAnalyticsRange;
  bucket: "hour" | "day" | "month";
  points: IAnalyticsPoint[];
}

export interface IAnalyticsTopProduct {
  product_id: number | null;
  /** the name as it was when the order was placed, not the current one */
  product_name: string;
  units_sold: number;
  revenue: number;
  order_count: number;
  image: { image: string; alt_tag: string | null } | null;
}

export interface IAnalyticsTopProducts {
  range: IAnalyticsRange;
  products: IAnalyticsTopProduct[];
}

export interface IAnalyticsBreakdownRow {
  value: string;
  count: number;
  amount: number;
  percentage: number | null;
}

export interface IAnalyticsOrderStatus {
  range: IAnalyticsRange;
  total_orders: number;
  order_status: IAnalyticsBreakdownRow[];
  payment_status: IAnalyticsBreakdownRow[];
  payment_method: IAnalyticsBreakdownRow[];
}
