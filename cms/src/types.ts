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

export type ImageTypes = { image: string; alt_tag: string | null };

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
  sub_category_id: number | null;
  price: string;
  compare_at_price: string;
  available_quantity: number;
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
  }[];
}

export interface IOrderList {
  order_id: number;
  order_number: string;
  user_name: string;
  total_amount: number;
  payment_status: string;
  order_status: string;
  order_date: string;
  invoice_avilable: boolean;
}

export interface OrderResponse {
  orderInfo: OrderInfo;
  addressInfo: AddressInfo;
  paymentInfo: PaymentInfo;
  orderItemsInfo: OrderItemInfo[];
}

export interface PriceBreakdown {
  subtotal: number;
  discount: number;
  gst_percentage: number;
  gst_amount: number;
  shipping_charge: number;
  total: number;
}

export interface OrderInfo {
  user_id: number;
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
  shiprocket_order_id: number | null;
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
}

export interface IUserProfile extends IUsers {
  user_address: AddressInfo[];
  permissions: Record<string, string>;
}

export interface IUserOrders extends OrderInfo {
  order_id: number;
  ordered_products: OrderItemInfo[];
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

export interface IBlog {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  content_json: any | null;
  cover_image: string | null;
  cover_image_alt: string | null;
  tags: string | null;
  status: "draft" | "published";
  meta_title: string | null;
  meta_description: string | null;
  author_id: number | null;
  created_at: string;
  updated_at: string;
}
