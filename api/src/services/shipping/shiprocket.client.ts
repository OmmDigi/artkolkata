import axios, { AxiosInstance, AxiosError } from "axios";
import logger from "../../utils/logger";
import { consolidateBoxes, ShipmentBox } from "./shipmentBoxes";
import { loadEnv } from "../../utils/loadEnv";

loadEnv();

// ============================================================
// INTERFACES
// ============================================================

interface CachedToken {
  token: string;
  expiresAt: number; // epoch ms
}

export interface ServiceabilityResult {
  success: boolean;
  serviceable: boolean;
  shippingCharge?: number;
  courierId?: number;
  courierName?: string;
  codAvailable?: boolean;
  estimatedDays?: number;
  error?: any;
}

export interface CreateOrderResult {
  success: boolean;
  shiprocketOrderId?: string;
  shipmentId?: string;
  awbCode?: string;
  courierName?: string;
  labelUrl?: string;
  pickupScheduled?: boolean;
  error?: any;
}

export interface CancelOrderResult {
  success: boolean;
  message?: string;
  error?: any;
}

export interface TrackShipmentResult {
  success: boolean;
  trackingData?: any;
  error?: any;
}

export interface ShiprocketOrderItem {
  name: string;
  sku?: string;
  hsn?: string;
  units: number;
  sellingPrice: number;
  discount?: number;
  tax?: number;
}

export interface ShiprocketCreateOrderParams {
  orderNumber: string;
  orderDate: string; // ISO datetime
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  customerAddress: string;
  customerAddress2?: string;
  customerCity: string;
  customerState: string;
  customerPincode: string;
  customerCountry: string;
  paymentMethod: "COD" | "ONLINE";
  items: ShiprocketOrderItem[];
  // The adhoc order API carries exactly one package, so more than one entry is
  // aggregated into a single declared box before it is sent.
  boxes: ShipmentBox[];
  shippingCharges?: number;
  totalDiscount?: number;
  comment?: string;
}

/**
 * A reverse pickup. The customer is the pickup end and our warehouse is the
 * delivery end, which is why this cannot reuse the forward params: Shiprocket
 * takes both addresses explicitly here rather than resolving the pickup from a
 * saved location nickname.
 */
export interface ShiprocketReturnParams {
  /** Must be unique at Shiprocket, and different from the forward order's id. */
  orderNumber: string;
  orderDate: string; // ISO datetime
  /** Where the courier collects — the customer. */
  pickup: {
    name: string;
    email?: string;
    phone: string;
    address: string;
    address2?: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  /** Where the goods are delivered back to — us. */
  destination: {
    name: string;
    email?: string;
    phone: string;
    address: string;
    address2?: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  items: ShiprocketOrderItem[];
  boxes: ShipmentBox[];
  /** What the goods are worth, for the courier's declaration. */
  subTotal?: number;
}

// ============================================================
// STATUS MAP — Shiprocket status label -> Delhivery-format
//
// The webhook_data table and the trackOrder query were both built around
// Delhivery's { StatusType, Status } pair, and SHIPMENT_MAPING keys off that
// pair. Translating here keeps every consumer downstream untouched.
// ============================================================

const SHIPROCKET_TO_DELHIVERY: Record<string, { statusType: string; status: string }> = {
  // Booked, not yet in the courier's hands
  "AWB ASSIGNED":            { statusType: "UD", status: "Manifested" },
  "LABEL GENERATED":         { statusType: "UD", status: "Manifested" },
  "MANIFEST GENERATED":      { statusType: "UD", status: "Manifested" },
  "PICKUP SCHEDULED":        { statusType: "UD", status: "Manifested" },
  "PICKUP GENERATED":        { statusType: "UD", status: "Manifested" },
  "PICKUP QUEUED":           { statusType: "UD", status: "Manifested" },
  "PICKUP RESCHEDULED":      { statusType: "UD", status: "Not Picked" },
  "OUT FOR PICKUP":          { statusType: "UD", status: "Not Picked" },
  "PICKUP EXCEPTION":        { statusType: "UD", status: "Not Picked" },
  "PICKUP ERROR":            { statusType: "UD", status: "Not Picked" },

  // Moving
  "PICKED UP":                 { statusType: "UD", status: "In Transit" },
  SHIPPED:                     { statusType: "UD", status: "In Transit" },
  "IN TRANSIT":                { statusType: "UD", status: "In Transit" },
  "REACHED AT DESTINATION":    { statusType: "UD", status: "In Transit" },
  "REACHED AT DESTINATION HUB":{ statusType: "UD", status: "In Transit" },
  "REACHED WAREHOUSE":         { statusType: "UD", status: "In Transit" },
  MISROUTED:                   { statusType: "UD", status: "In Transit" },
  "OUT FOR DELIVERY":          { statusType: "UD", status: "Dispatched" },

  // Delivered
  DELIVERED:           { statusType: "DL", status: "Delivered" },
  FULFILLED:           { statusType: "DL", status: "Delivered" },
  PARTIAL_DELIVERED:   { statusType: "DL", status: "Delivered" },
  "PARTIAL DELIVERED": { statusType: "DL", status: "Delivered" },

  // A failed attempt is not a terminal state — the shipment is still out, so
  // it maps to the "pending" bucket rather than to cancelled.
  UNDELIVERED:              { statusType: "UD", status: "Pending" },
  DELAYED:                  { statusType: "UD", status: "Pending" },
  "CUSTOMER NOT AVAILABLE": { statusType: "UD", status: "Pending" },

  // Cancelled / written off
  CANCELED:                 { statusType: "CN", status: "Canceled" },
  CANCELLED:                { statusType: "CN", status: "Canceled" },
  "CANCELLATION REQUESTED": { statusType: "CN", status: "Canceled" },
  LOST:                     { statusType: "CN", status: "Canceled" },
  DAMAGED:                  { statusType: "CN", status: "Canceled" },
  DESTROYED:                { statusType: "CN", status: "Canceled" },

  // Return to origin
  "RTO INITIATED":    { statusType: "RT", status: "In Transit" },
  "RTO ACKNOWLEDGED": { statusType: "RT", status: "In Transit" },
  "RTO IN TRANSIT":   { statusType: "RT", status: "In Transit" },
  "RTO DELIVERED":    { statusType: "DL", status: "RTO" },
};

// Shiprocket writes the same state a few different ways across the tracking
// API, the webhook and the label flow ("RTO_INITIATED", "Rto Initiated",
// "IN TRANSIT"), so normalise before looking the status up.
const normalizeStatusLabel = (value: string | undefined): string =>
  String(value ?? "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

// Shiprocket timestamps are IST wall-clock with no offset ("2024-05-02 18:30:00"
// or the ISO-looking "2024-05-02T18:30:00"), so they have to be shifted by
// +05:30 rather than handed straight to Date, which would read them as UTC.
const parseShiprocketDateTime = (value: string | undefined): string => {
  if (!value) return new Date().toISOString();

  const match = String(value).match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/,
  );

  if (!match) {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  }

  const [, year, month, day, hour, minute, second] = match;
  const istMs = Date.UTC(
    parseInt(year, 10),
    parseInt(month, 10) - 1,
    parseInt(day, 10),
    parseInt(hour, 10),
    parseInt(minute, 10),
    parseInt(second ?? "0", 10),
  );
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  return new Date(istMs - istOffsetMs).toISOString();
};

// ============================================================
// SERVICE CLASS
// ============================================================

class ShiprocketClient {
  private baseURL: string;
  private email: string;
  private password: string;
  private pickupLocation: string;
  private warehousePincode: string;
  private channelId: string;
  private preferredCourierId: string;
  private autoPickup: boolean;
  private cachedToken: CachedToken | null = null;
  private api: AxiosInstance;

  constructor() {
    this.baseURL =
      process.env.SHIPROCKET_BASE_URL || "https://apiv2.shiprocket.in/v1/external";
    this.email = process.env.SHIPROCKET_EMAIL || "";
    this.password = process.env.SHIPROCKET_PASSWORD || "";
    // The nickname of the pickup address as it is saved in the Shiprocket
    // panel, not an id — Shiprocket matches this string exactly.
    this.pickupLocation = process.env.SHIPROCKET_PICKUP_LOCATION || "Primary";
    this.warehousePincode = process.env.WAREHOUSE_PINCODE || "";
    this.channelId = process.env.SHIPROCKET_CHANNEL_ID || "";
    // Left unset, Shiprocket picks the courier itself when the AWB is assigned.
    this.preferredCourierId = process.env.SHIPROCKET_COURIER_ID || "";
    // Booking a pickup is a real courier commitment, so it is opt-in.
    this.autoPickup = process.env.SHIPROCKET_AUTO_PICKUP === "true";

    this.api = axios.create({ baseURL: this.baseURL });
  }

  // ============================================================
  // AUTH — the token is valid for 240 hours (10 days). Cached with a
  // 1 hour safety buffer so a request never goes out on a token that
  // expires mid-flight.
  // ============================================================
  private async getToken(): Promise<string> {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    if (this.cachedToken && this.cachedToken.expiresAt > now + oneHour) {
      return this.cachedToken.token;
    }

    if (!this.email || !this.password) {
      throw new Error(
        "Shiprocket is not configured — set SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD.",
      );
    }

    const response = await this.api.post("/auth/login", {
      email: this.email,
      password: this.password,
    });

    const token: string | undefined = response.data?.token;
    if (!token) {
      throw new Error(response.data?.message ?? "Shiprocket login failed");
    }

    this.cachedToken = { token, expiresAt: now + 240 * 60 * 60 * 1000 };
    return token;
  }

  private async authHeaders() {
    const token = await this.getToken();
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  // A 401 means the cached token was revoked before its 10 days were up
  // (a password change, or the same API user logging in elsewhere). Drop it so
  // the next call logs in again instead of failing forever on a stale token.
  private handleError(context: string, error: unknown) {
    const axiosError = error as AxiosError;

    if (axiosError.response?.status === 401) {
      this.cachedToken = null;
    }

    const detail = axiosError.response?.data ?? axiosError.message;
    logger.error({ message: `Shiprocket ${context} error`, error: detail });
    return detail;
  }

  // ------------------------------------------------------------
  // FIELD SANITISERS
  // ------------------------------------------------------------

  // Shiprocket splits the consignee into first/last name and rejects an empty
  // first name, so a single-word name is echoed into both halves.
  private splitName(fullName: string | undefined): { first: string; last: string } {
    const parts = String(fullName ?? "").trim().split(/\s+/).filter(Boolean);

    if (parts.length === 0) return { first: "Customer", last: "." };
    if (parts.length === 1) return { first: parts[0], last: parts[0] };

    return { first: parts[0], last: parts.slice(1).join(" ") };
  }

  // 10 digit Indian mobile — strip the +91 / spacing / dashes people type in.
  private cleanPhone(value: string | undefined): string {
    const digits = String(value ?? "").replace(/\D/g, "");
    return digits.length > 10 ? digits.slice(-10) : digits;
  }

  // ============================================================
  // CHECK SERVICEABILITY + SHIPPING RATE (no order created)
  // ============================================================
  async checkServiceability(
    deliveryPincode: string,
    weight = 0.5,
    invoiceValue = 500,
    codRequired = false,
    dimensions?: { length: number; breadth: number; height: number },
  ): Promise<ServiceabilityResult> {
    try {
      const headers = await this.authHeaders();

      // Quote against the box the shipment will actually be booked with —
      // couriers price on volumetric weight, so quoting a default 10x10x10 for
      // a bulky item under-reads the real rate.
      const response = await this.api.get("/courier/serviceability/", {
        headers,
        params: {
          pickup_postcode: this.warehousePincode,
          delivery_postcode: deliveryPincode,
          weight: Math.max(0.1, weight),
          cod: codRequired ? 1 : 0,
          declared_value: invoiceValue,
          length: dimensions?.length ?? 10,
          breadth: dimensions?.breadth ?? 10,
          height: dimensions?.height ?? 10,
        },
      });

      const couriers: any[] = response.data?.data?.available_courier_companies ?? [];

      if (couriers.length === 0) {
        return { success: true, serviceable: false };
      }

      // Shiprocket names a recommended courier; honour it when it is actually
      // in the returned list, otherwise fall back to the cheapest quote.
      const recommendedId = response.data?.data?.recommended_courier_company_id;
      const cheapest = [...couriers].sort(
        (a, b) => parseFloat(a.rate) - parseFloat(b.rate),
      )[0];
      const chosen =
        couriers.find((c) => c.courier_company_id === recommendedId) ?? cheapest;

      return {
        success: true,
        serviceable: true,
        shippingCharge: Math.ceil(parseFloat(chosen.rate)),
        courierId: parseInt(chosen.courier_company_id, 10),
        courierName: chosen.courier_name,
        codAvailable: couriers.some((c) => Number(c.cod) === 1),
        estimatedDays: parseInt(chosen.estimated_delivery_days, 10) || undefined,
      };
    } catch (error) {
      return {
        success: false,
        serviceable: false,
        error: this.handleError("serviceability", error),
      };
    }
  }

  // ============================================================
  // CREATE ORDER — adhoc order -> assign AWB -> (optional) pickup
  //
  // "Adhoc" is Shiprocket's channel-less order: the order is created directly
  // against the account rather than being imported from a connected store,
  // which is what we want since the storefront is the source of truth.
  // ============================================================
  async createOrder(
    params: ShiprocketCreateOrderParams,
  ): Promise<CreateOrderResult> {
    try {
      const isCod = params.paymentMethod === "COD";

      const boxes = params.boxes ?? [];
      if (boxes.length === 0) {
        return { success: false, error: "No shipment boxes provided" };
      }

      // The adhoc API declares one package, so several boxes ship as one
      // consolidated declaration.
      const declared = consolidateBoxes(boxes);

      const { first, last } = this.splitName(params.customerName);
      const phone = this.cleanPhone(params.customerPhone);

      // Shiprocket does not total the order itself — sub_total has to match the
      // line items or COD is collected for the wrong amount.
      const subTotal = params.items.reduce(
        (sum, item) => sum + item.units * item.sellingPrice,
        0,
      );

      const orderPayload = {
        order_id: params.orderNumber,
        // Shiprocket parses "YYYY-MM-DD HH:mm", not an ISO string with a Z.
        order_date: new Date(params.orderDate)
          .toISOString()
          .replace("T", " ")
          .slice(0, 16),
        pickup_location: this.pickupLocation,
        channel_id: this.channelId,
        comment: params.comment ?? "",

        billing_customer_name: first,
        billing_last_name: last,
        billing_address: params.customerAddress,
        billing_address_2: params.customerAddress2 ?? "",
        billing_city: params.customerCity,
        billing_pincode: params.customerPincode,
        billing_state: params.customerState,
        billing_country: params.customerCountry || "India",
        billing_email: params.customerEmail ?? "",
        billing_phone: phone,

        // We only ever capture one address, so billing is the shipping address.
        shipping_is_billing: true,

        order_items: params.items.map((item) => ({
          name: item.name,
          // Shiprocket requires a non-empty sku, and rejects duplicates within
          // an order, so fall back to the item name.
          sku: item.sku || item.name,
          units: item.units,
          selling_price: item.sellingPrice,
          discount: item.discount ?? 0,
          tax: item.tax ?? 0,
          hsn: item.hsn ?? "",
        })),

        payment_method: isCod ? "COD" : "Prepaid",
        shipping_charges: params.shippingCharges ?? 0,
        giftwrap_charges: 0,
        transaction_charges: 0,
        total_discount: params.totalDiscount ?? 0,
        sub_total: subTotal,

        // Dimensions are cm and weight is kg. Shiprocket rejects a zero.
        length: Math.max(0.5, declared.length),
        breadth: Math.max(0.5, declared.breadth),
        height: Math.max(0.5, declared.height),
        weight: Math.max(0.1, parseFloat(declared.weight.toFixed(3))),
      };

      const createHeaders = await this.authHeaders();
      const createResponse = await this.api.post(
        "/orders/create/adhoc",
        orderPayload,
        { headers: createHeaders },
      );

      const shiprocketOrderId = createResponse.data?.order_id;
      const shipmentId = createResponse.data?.shipment_id;

      if (!shiprocketOrderId || !shipmentId) {
        return {
          success: false,
          error: createResponse.data?.message ?? createResponse.data,
        };
      }

      logger.info({
        message: "Shiprocket order created",
        shiprocketOrderId,
        shipmentId,
        boxes: boxes.length,
      });

      // The order exists at Shiprocket from here on. If anything below fails we
      // still return its ids, so the caller can persist them and the order is
      // never created twice — only the AWB step needs retrying.
      const awbResult = await this.assignAwb(String(shipmentId));

      if (!awbResult.success) {
        return {
          success: false,
          shiprocketOrderId: String(shiprocketOrderId),
          shipmentId: String(shipmentId),
          error: awbResult.error,
        };
      }

      let pickupScheduled = false;
      if (this.autoPickup) {
        const pickup = await this.requestPickup(String(shipmentId));
        pickupScheduled = pickup.success;
      }

      return {
        success: true,
        shiprocketOrderId: String(shiprocketOrderId),
        shipmentId: String(shipmentId),
        awbCode: awbResult.awbCode,
        courierName: awbResult.courierName,
        pickupScheduled,
      };
    } catch (error) {
      return { success: false, error: this.handleError("create order", error) };
    }
  }

  // ============================================================
  // ASSIGN AWB — picks the courier and returns the tracking number.
  // With no courier id Shiprocket assigns its own recommendation.
  // ============================================================
  async assignAwb(
    shipmentId: string,
    options: { courierId?: number; isReturn?: boolean } = {},
  ): Promise<{ success: boolean; awbCode?: string; courierName?: string; error?: any }> {
    try {
      const headers = await this.authHeaders();

      const chosenCourier =
        options.courierId ??
        (this.preferredCourierId ? parseInt(this.preferredCourierId, 10) : undefined);

      const response = await this.api.post(
        "/courier/assign/awb",
        {
          shipment_id: shipmentId,
          // Reverse pickups are a separate courier product at Shiprocket: the
          // same endpoint hands back a forward AWB without this flag, and the
          // courier then never turns up at the customer's door.
          ...(options.isReturn ? { is_return: 1 } : {}),
          ...(chosenCourier ? { courier_id: chosenCourier } : {}),
        },
        { headers },
      );

      // The AWB lands under response_data on success, but Shiprocket also
      // answers 200 with awb_assign_status 0 and the reason in the body.
      const data = response.data?.response?.data ?? response.data?.response ?? {};
      const awbCode = data.awb_code;

      if (!awbCode) {
        return {
          success: false,
          error:
            response.data?.message ??
            data.awb_assign_error ??
            "Shiprocket did not return an AWB",
        };
      }

      logger.info({
        message: "Shiprocket AWB assigned",
        shipmentId,
        awb: awbCode,
        isReturn: !!options.isReturn,
      });

      return {
        success: true,
        awbCode: String(awbCode),
        courierName: data.courier_name,
      };
    } catch (error) {
      return { success: false, error: this.handleError("assign awb", error) };
    }
  }

  // ============================================================
  // REQUEST PICKUP — books the courier to collect the shipment.
  // ============================================================
  async requestPickup(
    shipmentId: string,
  ): Promise<{ success: boolean; scheduledDate?: string; error?: any }> {
    try {
      const headers = await this.authHeaders();
      const response = await this.api.post(
        "/courier/generate/pickup",
        { shipment_id: [shipmentId] },
        { headers },
      );

      // Shiprocket reports an already-scheduled pickup as an error, which is
      // not a failure for us — the pickup we wanted exists either way.
      const alreadyScheduled = /already/i.test(String(response.data?.message ?? ""));
      const scheduled =
        response.data?.pickup_status === 1 ||
        !!response.data?.response?.pickup_scheduled_date ||
        alreadyScheduled;

      return {
        success: scheduled,
        scheduledDate: response.data?.response?.pickup_scheduled_date,
        error: scheduled ? undefined : response.data?.message,
      };
    } catch (error) {
      return { success: false, error: this.handleError("request pickup", error) };
    }
  }

  // ============================================================
  // LABEL / MANIFEST / INVOICE — each returns a Shiprocket-hosted PDF URL.
  // ============================================================
  async generateLabel(
    shipmentIds: string[],
  ): Promise<{ success: boolean; labelUrl?: string; error?: any }> {
    try {
      const headers = await this.authHeaders();
      const response = await this.api.post(
        "/courier/generate/label",
        { shipment_id: shipmentIds },
        { headers },
      );

      if (!response.data?.label_url) {
        return { success: false, error: response.data?.message ?? response.data };
      }

      return { success: true, labelUrl: response.data.label_url };
    } catch (error) {
      return { success: false, error: this.handleError("generate label", error) };
    }
  }

  async generateManifest(
    shipmentIds: string[],
  ): Promise<{ success: boolean; manifestUrl?: string; error?: any }> {
    try {
      const headers = await this.authHeaders();
      const response = await this.api.post(
        "/manifests/generate",
        { shipment_id: shipmentIds },
        { headers },
      );

      if (!response.data?.manifest_url) {
        return { success: false, error: response.data?.message ?? response.data };
      }

      return { success: true, manifestUrl: response.data.manifest_url };
    } catch (error) {
      return { success: false, error: this.handleError("generate manifest", error) };
    }
  }

  async generateInvoice(
    orderIds: string[],
  ): Promise<{ success: boolean; invoiceUrl?: string; error?: any }> {
    try {
      const headers = await this.authHeaders();
      const response = await this.api.post(
        "/orders/print/invoice",
        { ids: orderIds },
        { headers },
      );

      if (!response.data?.invoice_url) {
        return { success: false, error: response.data?.message ?? response.data };
      }

      return { success: true, invoiceUrl: response.data.invoice_url };
    } catch (error) {
      return { success: false, error: this.handleError("generate invoice", error) };
    }
  }

  // ============================================================
  // CREATE RETURN ORDER — reverse pickup from the customer back to us
  //
  // A return is its own order at Shiprocket, not a flag on the forward one, so
  // it gets its own order id, its own shipment id and its own AWB. The AWB step
  // is the same endpoint as a forward booking with is_return set.
  // ============================================================
  async createReturnOrder(
    params: ShiprocketReturnParams,
  ): Promise<CreateOrderResult> {
    try {
      const boxes = params.boxes ?? [];
      if (boxes.length === 0) {
        return { success: false, error: "No shipment boxes provided" };
      }

      const declared = consolidateBoxes(boxes);

      const pickupName = this.splitName(params.pickup.name);
      const destinationName = this.splitName(params.destination.name);

      const subTotal =
        params.subTotal ??
        params.items.reduce((sum, item) => sum + item.units * item.sellingPrice, 0);

      const payload = {
        order_id: params.orderNumber,
        order_date: new Date(params.orderDate)
          .toISOString()
          .replace("T", " ")
          .slice(0, 16),
        channel_id: this.channelId,

        pickup_customer_name: pickupName.first,
        pickup_last_name: pickupName.last,
        pickup_address: params.pickup.address,
        pickup_address_2: params.pickup.address2 ?? "",
        pickup_city: params.pickup.city,
        pickup_state: params.pickup.state,
        pickup_country: params.pickup.country || "India",
        pickup_pincode: params.pickup.pincode,
        pickup_email: params.pickup.email ?? "",
        pickup_phone: this.cleanPhone(params.pickup.phone),
        pickup_isd_code: "91",

        shipping_customer_name: destinationName.first,
        shipping_last_name: destinationName.last,
        shipping_address: params.destination.address,
        shipping_address_2: params.destination.address2 ?? "",
        shipping_city: params.destination.city,
        shipping_state: params.destination.state,
        shipping_country: params.destination.country || "India",
        shipping_pincode: params.destination.pincode,
        shipping_email: params.destination.email ?? "",
        shipping_phone: this.cleanPhone(params.destination.phone),
        shipping_isd_code: "91",

        order_items: params.items.map((item) => ({
          name: item.name,
          // qty and units are both read by Shiprocket depending on the plan the
          // account is on, so both are sent with the same value.
          qty: item.units,
          units: item.units,
          sku: item.sku || item.name,
          selling_price: item.sellingPrice,
          discount: item.discount ?? 0,
          tax: item.tax ?? 0,
          hsn: item.hsn ?? "",
        })),

        // A reverse pickup is never collected against, whatever the forward leg
        // was paid with — a COD order's return is still PREPAID here.
        payment_method: "PREPAID",
        total_discount: 0,
        sub_total: subTotal,

        length: Math.max(0.5, declared.length),
        breadth: Math.max(0.5, declared.breadth),
        height: Math.max(0.5, declared.height),
        weight: Math.max(0.1, parseFloat(declared.weight.toFixed(3))),
      };

      const headers = await this.authHeaders();
      const response = await this.api.post("/orders/create/return", payload, {
        headers,
      });

      const returnOrderId = response.data?.order_id;
      const shipmentId = response.data?.shipment_id;

      if (!returnOrderId || !shipmentId) {
        return {
          success: false,
          error: response.data?.message ?? response.data,
        };
      }

      logger.info({
        message: "Shiprocket return order created",
        returnOrderId,
        shipmentId,
      });

      // Same as the forward leg: the order exists at Shiprocket from here on,
      // so its ids are returned even when the AWB step fails. Only the AWB
      // needs retrying, and booking the return again would duplicate it.
      const awbResult = await this.assignAwb(String(shipmentId), {
        isReturn: true,
      });

      if (!awbResult.success) {
        return {
          success: false,
          shiprocketOrderId: String(returnOrderId),
          shipmentId: String(shipmentId),
          error: awbResult.error,
        };
      }

      return {
        success: true,
        shiprocketOrderId: String(returnOrderId),
        shipmentId: String(shipmentId),
        awbCode: awbResult.awbCode,
        courierName: awbResult.courierName,
      };
    } catch (error) {
      return { success: false, error: this.handleError("create return", error) };
    }
  }

  // ============================================================
  // CANCEL
  //
  // An order with no AWB yet is cancelled at the order level; once a courier
  // holds an AWB the shipment has to be cancelled too, or the courier still
  // turns up to collect it. Callers pass whichever ids they have.
  // ============================================================
  async cancelOrder(shiprocketOrderId: string): Promise<CancelOrderResult> {
    try {
      const headers = await this.authHeaders();
      const response = await this.api.post(
        "/orders/cancel",
        { ids: [parseInt(shiprocketOrderId, 10)] },
        { headers },
      );

      const message = response.data?.message ?? "";
      // Shiprocket answers an already-cancelled order with a 200 and a message
      // saying so; the end state is what we wanted, so treat it as success.
      const cancelled =
        response.data?.status_code === 200 ||
        /cancel/i.test(message) ||
        !!response.data?.status;

      return { success: cancelled, message: message || undefined };
    } catch (error) {
      return { success: false, error: this.handleError("cancel order", error) };
    }
  }

  async cancelShipment(awb: string): Promise<CancelOrderResult> {
    try {
      const headers = await this.authHeaders();
      const response = await this.api.post(
        "/orders/cancel/shipment/awbs",
        { awbs: [awb] },
        { headers },
      );

      const message = response.data?.message ?? "";
      const cancelled =
        response.data?.status_code === 200 || /cancel/i.test(message);

      return { success: cancelled, message: message || undefined };
    } catch (error) {
      return { success: false, error: this.handleError("cancel shipment", error) };
    }
  }

  // ============================================================
  // TRACK SHIPMENT (by AWB)
  // ============================================================
  async trackShipment(awb: string): Promise<TrackShipmentResult> {
    try {
      const headers = await this.authHeaders();
      const response = await this.api.get(
        `/courier/track/awb/${encodeURIComponent(awb)}`,
        { headers },
      );

      // Shiprocket wraps the payload as either { tracking_data } or
      // [{ "<awb>": { tracking_data } }] depending on how the AWB was booked.
      const trackingData =
        response.data?.tracking_data ??
        response.data?.[0]?.[awb]?.tracking_data ??
        null;

      if (!trackingData) {
        return { success: false, error: response.data?.message ?? response.data };
      }

      // track_status 0 means Shiprocket knows the AWB but the courier has not
      // scanned it yet — no events, but not an error either.
      return { success: true, trackingData };
    } catch (error) {
      return { success: false, error: this.handleError("track shipment", error) };
    }
  }

  // ============================================================
  // NORMALIZE TRACKING — converts one Shiprocket scan into the
  // Delhivery-shaped object webhook_data and the trackOrder query
  // already understand, so no query changes are needed.
  // ============================================================
  normalizeStatusEvent(
    awb: string,
    statusLabel: string | undefined,
    scanDateTime: string | undefined,
    location: string | undefined,
    remarks: string | undefined,
  ) {
    const normalized = normalizeStatusLabel(statusLabel);
    const mapped = SHIPROCKET_TO_DELHIVERY[normalized] ?? {
      statusType: "UD",
      status: statusLabel ?? "",
    };

    return {
      Shipment: {
        AWB: awb,
        Status: {
          Status: mapped.status,
          StatusType: mapped.statusType,
          StatusDateTime: parseShiprocketDateTime(scanDateTime),
          StatusLocation: location ?? "",
          Instructions: remarks ?? "",
        },
      },
    };
  }

  // Builds the full chronological (oldest -> newest) list of normalized events
  // from a trackShipment() response. Shiprocket returns its activity list
  // newest-first, and webhook_data is read in insertion order, so it is
  // reversed here.
  normalizeTrackingHistory(trackingData: any, awb: string) {
    const activities: any[] = trackingData?.shipment_track_activities ?? [];

    if (activities.length === 0) {
      // No courier scan yet, but the shipment itself carries a current_status
      // (typically "AWB ASSIGNED") worth recording so the customer sees
      // something on the tracking page.
      const track = trackingData?.shipment_track?.[0];
      if (!track?.current_status) return [];

      return [
        this.normalizeStatusEvent(
          awb,
          track.current_status,
          track.pickup_date,
          track.origin,
          "",
        ),
      ];
    }

    return [...activities].reverse().map((entry) =>
      this.normalizeStatusEvent(
        awb,
        // "sr-status-label" is Shiprocket's own normalised label; `status` is
        // the raw courier string, which varies per courier.
        entry["sr-status-label"] ?? entry.status,
        entry.date,
        entry.location,
        entry.activity,
      ),
    );
  }

  // Same translation for a webhook push, which carries the scan list under a
  // different key and states the current status at the top level.
  normalizeWebhookEvents(payload: any) {
    const awb = String(payload?.awb ?? "");
    if (!awb) return [];

    const scans: any[] = payload?.scans ?? [];

    if (scans.length === 0) {
      return [
        this.normalizeStatusEvent(
          awb,
          payload?.current_status ?? payload?.shipment_status,
          payload?.current_timestamp,
          payload?.location ?? "",
          "",
        ),
      ];
    }

    return [...scans].reverse().map((scan) =>
      this.normalizeStatusEvent(
        awb,
        scan["sr-status-label"] ?? scan.status ?? payload?.current_status,
        scan.date,
        scan.location,
        scan.activity,
      ),
    );
  }
}

export default new ShiprocketClient();
export { ShiprocketClient, normalizeStatusLabel, parseShiprocketDateTime };
