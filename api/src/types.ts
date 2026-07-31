import { Request } from "express";
import { PaymentDetail } from "@phonepe-pg/pg-sdk-node";

export type RoteIds = `1-${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14}`;

export interface SignupType {
  name: string;
  email: string;
  phone_no: string;
  password: string;
}

export interface SaveUserInfo extends SignupType {
  user_id?: number;
  is_verified: boolean;
  is_active: boolean;
  action : "Add" | "Update",
  role : "User" | "Employee"
}

export interface IError extends Error {
  code?: number;
  message: string;
  statusCode: number;
  isOperational: boolean;
  isCustomError: boolean;
  key: any[];
}

export interface IGAuth {
  access_token: string;
  id_token: string;
}

export interface IGAuthProfile {
  id: string;
  email: string;
  name: string;
  picture: string;
}

export type Role = "Admin" | "User";

export interface ITokenInfo {
  id: number;
  role: Role;
  permissions : Record<string, string> | null
}

export interface CustomRequest extends Request {
  token_info?: ITokenInfo;
}

// types/discount.types.ts
export enum DiscountType {
  PERCENTAGE = "percentage",
  FIXED_AMOUNT = "fixed_amount",
  BUY_X_GET_Y = "buy_x_get_y",
  FREE_SHIPPING = "free_shipping",
}

export enum DiscountStatus {
  ACTIVE = "active",
  SCHEDULED = "scheduled",
  EXPIRED = "expired",
  DISABLED = "disabled",
}

export enum ConditionType {
  PRODUCT = "product",
  COLLECTION = "collection",
  CUSTOMER_SEGMENT = "customer_segment",
  CUSTOMER_TAG = "customer_tag",
}

export enum ConditionOperator {
  INCLUDES = "includes",
  EXCLUDES = "excludes",
}

export interface Discount {
  id: string;
  code: string;
  title: string;
  description?: string;
  type: DiscountType;
  value?: number;
  status: DiscountStatus;
  usage_limit?: number;
  usage_count: number;
  per_customer_limit?: number;
  minimum_purchase_amount?: number;
  starts_at?: Date;
  ends_at?: Date;
  can_combine_with_other_discounts: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface DiscountCondition {
  id: string;
  discount_id: string;
  condition_type: ConditionType;
  operator: ConditionOperator;
  target_ids: string[];
  created_at: Date;
}

export interface BXGYRule {
  id: string;
  discount_id: string;
  buy_quantity: number;
  buy_product_ids: string[];
  get_quantity: number;
  get_product_ids: string[];
  discount_value: number;
  created_at: Date;
}

export interface DiscountUsage {
  id: string;
  discount_id: string;
  customer_id: string;
  order_id: string;
  discount_amount: number;
  used_at: Date;
}

export interface CartItem {
  product_id: string;
  quantity: number;
  price: number;
  title?: string;
}

export interface CreateDiscountRequest {
  code: string;
  title: string;
  description?: string;
  type: DiscountType;
  value?: number;
  usage_limit?: number;
  per_customer_limit?: number;
  minimum_purchase_amount?: number;
  starts_at?: Date;
  ends_at?: Date;
  can_combine_with_other_discounts?: boolean;
  conditions?: Omit<DiscountCondition, "id" | "discount_id" | "created_at">[];
  bxgy_rule?: Omit<BXGYRule, "id" | "discount_id" | "created_at">;
}

export interface ValidateDiscountRequest {
  code: string;
  customer_id?: string;
  cart_items: CartItem[];
  cart_total: number;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export interface DiscountValidationResponse {
  valid: boolean;
  error?: string;
  discount?: {
    code: string;
    title: string;
    type: DiscountType;
    amount: number;
  };
}

export interface DiscountWithRelations extends Discount {
  conditions?: DiscountCondition[];
  bxgy_rules?: BXGYRule[];
}

export interface RecordUsageRequest {
  discount_code: string;
  customer_id: string;
  order_id: string;
  discount_amount: number;
}

export interface IVarients {
  id: number;
  product_id: number;
  sku: string;
  price: string;
  compare_at_price: string;
  quantity: number;
  available: true;
  product_name: string;
  product_category_id: number;
  weight_kg: string;
  length_cm: string;
  breadth_cm: string;
  height_cm: string;
}

export interface IProducts {
  id: number;
  sku_id: string | null;
  name: string;
  description: string;
  category_id: number;
  price: string;
  compare_at_price: string;
  available_quantity: number;
  weight_kg: string;
  length_cm: string;
  breadth_cm: string;
  height_cm: string;
}

export interface ICreateShipment {
  name: string;
  order: string;
  phone: string[];
  add: string;
  pin: number;
  city: string;
  state: string;
}

// Delhivery Types
export type PaymentMode = "Prepaid" | "COD" | "Pickup" | "REPL";

export interface Address {
  name: string;
  phone: string;
  add: string;
  city: string;
  state: string;
  pin: string;
  country: string;
}

export interface OrderInfo {
  orderId: string;
  totalAmount: number;
  productDescription: string;
  hsnCode?: string;
  quantity: number;
  weight: number;
  waybill?: string;
}

export interface WarehouseInfo {
  name: string; // MUST match Delhivery registered warehouse name
  address: Address; // Full warehouse address
}

// phone pe types

interface PaymentData {
  // merchantId: string;
  orderId: string;
  transactionId: string;
  amount: number;
  state: string;
  responseCode: string;
  paymentInstrument: PaymentDetail[];
}

export interface PaymentResponse {
  success: boolean;
  code: string;
  message: string;
  data: PaymentData;
}

export interface IShippingAddress {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export interface ISaveAddress extends IShippingAddress {
  user_id?: number;
  address_id?: number;
}
