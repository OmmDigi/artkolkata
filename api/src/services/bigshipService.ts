import axios, { AxiosInstance, AxiosError } from "axios";
import logger from "../utils/logger";

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
  bigshipOrderId?: string;
  awbCode?: string;
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

export interface BigshipOrderItem {
  name: string;
  hsn?: string;
  units: number;
  sellingPrice: number;
}

// One physical box as keyed in by the admin. Bigship types the box edges as
// int cm and the dead weight as decimal kg.
export interface BigshipBox {
  weight: number;
  length: number;
  breadth: number;
  height: number;
}

export interface BigshipCreateOrderParams {
  orderNumber: string;
  orderDate: string; // UTC datetime
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  customerAddress: string;
  customerAddress2?: string;
  customerLandmark?: string;
  customerCity: string;
  customerState: string;
  customerPincode: string;
  customerCountry: string;
  paymentMethod: "COD" | "ONLINE";
  items: BigshipOrderItem[];
  // One entry books B2C, more than one books B2B heavy.
  boxes: BigshipBox[];
  // B2B only, and mandatory there — data URI of the order invoice.
  invoiceDocument?: string;
  // B2B only, and mandatory once the invoice reaches EWAYBILL_THRESHOLD.
  ewaybillNumber?: string;
  ewaybillDocument?: string;
}

// Bigship rejects a B2B shipment invoiced at or above this without an ewaybill
// number and document.
export const EWAYBILL_THRESHOLD = 50000;

// ============================================================
// STATUS MAP — Bigship scan_status → Delhivery-format
// (see "List of Scan Status in Tracking API" in the Bigship docs)
// ============================================================

const BIGSHIP_TO_DELHIVERY: Record<string, { statusType: string; status: string }> = {
  "Pickup Scheduled":  { statusType: "UD", status: "Manifested" },
  "Not Picked":        { statusType: "UD", status: "Not Picked" },
  "In-Transit":        { statusType: "UD", status: "In Transit" },
  "Out for Delivery":  { statusType: "UD", status: "Dispatched" },
  Delivered:           { statusType: "DL", status: "Delivered" },
  Undelivered:         { statusType: "UD", status: "Pending" },
  Cancelled:           { statusType: "CN", status: "Canceled" },
  "RTO In Transit":    { statusType: "RT", status: "In Transit" },
  "RTO Delivered":     { statusType: "DL", status: "RTO" },
  Lost:                { statusType: "CN", status: "Canceled" },
};

// scan_datetime / order_manifest_datetime come back as "DD-MM-YYYY HH:mm:ss" in IST
const parseBigshipDateTime = (value: string): string => {
  const match = value.match(/^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return new Date(value).toISOString();

  const [, day, month, year, hour, minute, second] = match;
  const istMs = Date.UTC(
    parseInt(year, 10),
    parseInt(month, 10) - 1,
    parseInt(day, 10),
    parseInt(hour, 10),
    parseInt(minute, 10),
    parseInt(second, 10),
  );
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  return new Date(istMs - istOffsetMs).toISOString();
};

// ============================================================
// SERVICE CLASS
// ============================================================

class BigshipService {
  private baseURL: string;
  private userName: string;
  private password: string;
  private accessKey: string;
  private pickupLocationId: string;
  private returnLocationId: string;
  private warehousePincode: string;
  private defaultCategory: string;
  private cachedToken: CachedToken | null = null;
  private api: AxiosInstance;

  constructor() {
    this.baseURL = process.env.BIGSHIP_BASE_URL || "https://api.bigship.in";
    this.userName = process.env.BIGSHIP_USER_NAME || "";
    this.password = process.env.BIGSHIP_PASSWORD || "";
    this.accessKey = process.env.BIGSHIP_ACCESS_KEY || "";
    this.pickupLocationId = process.env.BIGSHIP_PICKUP_LOCATION_ID || "";
    this.returnLocationId =
      process.env.BIGSHIP_RETURN_LOCATION_ID || this.pickupLocationId;
    this.warehousePincode = process.env.WAREHOUSE_PINCODE || "";
    this.defaultCategory = process.env.BIGSHIP_DEFAULT_CATEGORY || "Others";

    this.api = axios.create({ baseURL: this.baseURL });
  }

  // ============================================================
  // AUTH — token is valid for 12 hours (per docs); cached with a
  // 1 hr safety buffer and refreshed proactively.
  // ============================================================
  private async getToken(): Promise<string> {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    if (this.cachedToken && this.cachedToken.expiresAt > now + oneHour) {
      return this.cachedToken.token;
    }

    const response = await this.api.post("/api/login/user", {
      user_name: this.userName,
      password: this.password,
      access_key: this.accessKey,
    });

    if (!response.data.success) {
      throw new Error(response.data.message ?? "Bigship login failed");
    }

    const token: string = response.data.data.token;
    this.cachedToken = { token, expiresAt: now + 12 * 60 * 60 * 1000 };
    return token;
  }

  // Bigship binds the warehouse ids as System.Int64, but the seller panel shows
  // them prefixed — "BSW142255" for warehouse 142255. Sending the prefixed form
  // makes the whole request body fail to bind, which Bigship reports as the
  // unhelpful "The req field is required". Accept either form, and fail here
  // with the actual reason if the value is neither.
  private numericLocationId(value: string, envVar: string): number {
    const parsed = Number(value.trim().replace(/^BSW/i, ""));

    if (!value || !Number.isInteger(parsed) || parsed <= 0) {
      throw new Error(
        `${envVar} must be a Bigship warehouse id (e.g. 142255 or BSW142255), but is "${value}".`,
      );
    }

    return parsed;
  }

  // ------------------------------------------------------------
  // FIELD SANITISERS — Bigship validates these strictly and answers
  // any breach with a generic 400, so normalise before sending.
  // ------------------------------------------------------------

  // Names: 3-25 chars, alphabets/dots/spaces only.
  private cleanName(value: string | undefined, fallback: string): string {
    const cleaned = (value ?? "")
      .replace(/[^A-Za-z. ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return (cleaned.length >= 3 ? cleaned : fallback).slice(0, 25);
  }

  // Address parts: alphanumeric, spaces and ' . , - / only.
  private cleanAddress(value: string | undefined, max = 50): string {
    return (value ?? "")
      .replace(/[^A-Za-z0-9 '.,\-/]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max);
  }

  // 10-12 digits starting 0/6/7/8/9 — strip the +91 / spacing people type in.
  private cleanPhone(value: string | undefined): string {
    const digits = (value ?? "").replace(/\D/g, "");
    return digits.length > 12 ? digits.slice(-10) : digits;
  }

  // product_name takes alphabets, spaces and - , / only — digits are rejected,
  // so "Ganesh Idol 12 inch" has to go across as "Ganesh Idol inch".
  private cleanProductName(value: string | undefined): string {
    const cleaned = (value ?? "")
      .replace(/[^A-Za-z ,/-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return cleaned.length > 0 ? cleaned.slice(0, 50) : "Item";
  }

  // The B2B rates API reports the risk a quote was priced at as "owner_risk" /
  // "carrier_risk", but the manifest API only accepts "OwnerRisk" /
  // "CarrierRisk". Anything unrecognised falls back to Bigship's own default.
  private riskTypeOf(rateRiskTypeName: string | undefined): string {
    return String(rateRiskTypeName ?? "").replace(/_/g, "").toLowerCase() ===
      "carrierrisk"
      ? "CarrierRisk"
      : "OwnerRisk";
  }

  private async authHeaders() {
    const token = await this.getToken();
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
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

      // Quote against the same box the shipment will actually be booked with —
      // couriers price on volumetric weight, so quoting a 10x10x10 box for a
      // bulky item undercharges the customer at checkout.
      const payload = {
        shipment_category: "B2C",
        payment_type: codRequired ? "COD" : "Prepaid",
        pickup_pincode: this.warehousePincode,
        destination_pincode: deliveryPincode,
        shipment_invoice_amount: invoiceValue,
        risk_type: "",
        box_details: [
          {
            each_box_dead_weight: Math.max(0.1, weight),
            each_box_length: Math.ceil(dimensions?.length ?? 10),
            each_box_width: Math.ceil(dimensions?.breadth ?? 10),
            each_box_height: Math.ceil(dimensions?.height ?? 10),
            box_count: 1,
          },
        ],
      };

      const response = await this.api.post("/api/calculator", payload, { headers });

      const rates: any[] = response.data?.data ?? [];

      if (!response.data.success || rates.length === 0) {
        return { success: true, serviceable: false };
      }

      const cheapest = rates.sort(
        (a, b) => parseFloat(a.total_shipping_charges) - parseFloat(b.total_shipping_charges),
      )[0];

      return {
        success: true,
        serviceable: true,
        shippingCharge: Math.ceil(parseFloat(cheapest.total_shipping_charges)),
        courierId: parseInt(cheapest.courier_id, 10),
        courierName: cheapest.courier_name,
        codAvailable: true,
        estimatedDays: parseInt(cheapest.tat, 10) || undefined,
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      logger.error({
        message: "Bigship serviceability error",
        error: axiosError.response?.data ?? axiosError.message,
      });
      return {
        success: false,
        serviceable: false,
        error: axiosError.response?.data ?? axiosError.message,
      };
    }
  }

  // ============================================================
  // CREATE ORDER — add order -> get rates -> manifest -> fetch AWB
  //
  // A single box books as B2C through api/order/add/single. Bigship caps B2C
  // at exactly one box, so a multi-box shipment has to go the B2B "heavy"
  // route instead: a different add endpoint, B2B rates, a manifest that wants
  // a risk_type, and a mandatory invoice document. Everything else — auth,
  // consignee, cheapest-courier pick, AWB fetch — is shared.
  // ============================================================
  async createOrder(params: BigshipCreateOrderParams): Promise<CreateOrderResult> {
    try {
      const invoiceAmount = params.items.reduce(
        (sum, item) => sum + item.units * item.sellingPrice,
        0,
      );
      const isCod = params.paymentMethod === "COD";

      const boxes = params.boxes ?? [];
      if (boxes.length === 0) {
        return { success: false, error: "No shipment boxes provided" };
      }

      const isB2B = boxes.length > 1;

      if (isB2B && !params.invoiceDocument) {
        return {
          success: false,
          error: "A B2B (multi-box) shipment needs an invoice document",
        };
      }

      if (
        isB2B &&
        invoiceAmount >= EWAYBILL_THRESHOLD &&
        (!params.ewaybillNumber || !params.ewaybillDocument)
      ) {
        return {
          success: false,
          error: `A B2B shipment invoiced at ${EWAYBILL_THRESHOLD} or above needs an ewaybill number and document`,
        };
      }

      const [rawFirst, ...rest] = (params.customerName ?? "").trim().split(/\s+/);
      const firstName = this.cleanName(rawFirst, "Customer");
      const lastName = this.cleanName(rest.join(" "), firstName);

      // address_line1 has a 10 character minimum, so top a short one up with
      // the city rather than letting Bigship reject the whole order.
      let addressLine1 = this.cleanAddress(params.customerAddress);
      if (addressLine1.length < 10) {
        addressLine1 = this.cleanAddress(
          `${addressLine1} ${params.customerCity}`.trim(),
        );
      }

      // Anything past the 50 char cap spills into line2 instead of being lost.
      const addressOverflow = this.cleanAddress(params.customerAddress).slice(
        addressLine1.length,
      );
      const addressLine2 = this.cleanAddress(
        params.customerAddress2 ?? addressOverflow,
      );

      const email = params.customerEmail ?? "";
      const isValidEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);

      // B2B carries no money on the boxes or the products — Bigship requires
      // every each_box_/each_product_ amount to be 0 there and reads the value
      // off the invoice document instead. B2C is the opposite: the box total
      // has to reconcile exactly with shipment_invoice_amount.
      const productDetails = params.items.map((item) => ({
        product_category: this.defaultCategory,
        product_sub_category: "",
        product_name: this.cleanProductName(item.name),
        product_quantity: item.units,
        each_product_invoice_amount: isB2B ? 0 : item.sellingPrice * item.units,
        each_product_collectable_amount:
          !isB2B && isCod ? item.sellingPrice * item.units : 0,
        hsn: (item.hsn ?? "").replace(/\D/g, ""),
      }));

      // Bigship wants product_details on every box, but the admin keys the
      // boxes in by hand and never says which item went where. The full item
      // list rides on the first box; the rest declare one line naming the same
      // goods so the manifest reads sensibly. Harmless because B2B zeroes all
      // the amounts anyway — this is a description, not an invoice.
      const filler = [
        {
          product_category: this.defaultCategory,
          product_sub_category: "",
          product_name: this.cleanProductName(params.items[0]?.name),
          product_quantity: 1,
          each_product_invoice_amount: 0,
          each_product_collectable_amount: 0,
          hsn: "",
        },
      ];

      const boxDetails = boxes.map((box, index) => ({
        each_box_dead_weight: Math.max(0.1, box.weight),
        each_box_length: Math.ceil(box.length),
        each_box_width: Math.ceil(box.breadth),
        each_box_height: Math.ceil(box.height),
        each_box_invoice_amount: isB2B ? 0 : invoiceAmount,
        each_box_collectable_amount: !isB2B && isCod ? invoiceAmount : 0,
        box_count: 1,
        product_details: index === 0 ? productDetails : filler,
      }));

      const addOrderPayload = {
        shipment_category: isB2B ? "b2b" : "b2c",
        warehouse_detail: {
          pickup_location_id: this.numericLocationId(
            this.pickupLocationId,
            "BIGSHIP_PICKUP_LOCATION_ID",
          ),
          return_location_id: this.numericLocationId(
            this.returnLocationId,
            "BIGSHIP_RETURN_LOCATION_ID",
          ),
        },
        consignee_detail: {
          first_name: firstName,
          last_name: lastName,
          company_name: "",
          contact_number_primary: this.cleanPhone(params.customerPhone),
          contact_number_secondary: "",
          email_id: isValidEmail ? email : "",
          // consignee_address is nested inside consignee_detail, not a sibling
          consignee_address: {
            address_line1: addressLine1,
            address_line2: addressLine2,
            address_landmark: this.cleanAddress(params.customerLandmark ?? "N A"),
            pincode: params.customerPincode,
          },
        },
        order_detail: {
          // Docs require UTC DateTime format
          invoice_date: new Date(params.orderDate).toISOString(),
          invoice_id: params.orderNumber,
          payment_type: isCod ? "COD" : "Prepaid",
          shipment_invoice_amount: invoiceAmount,
          total_collectable_amount: isCod ? invoiceAmount : 0,
          box_details: boxDetails,
          // ewaybill_number and document_detail belong to order_detail
          ewaybill_number: (params.ewaybillNumber ?? "").replace(/\D/g, ""),
          document_detail: {
            invoice_document_file: params.invoiceDocument ?? "",
            ewaybill_document_file: params.ewaybillDocument ?? "",
          },
        },
      };

      const addHeaders = await this.authHeaders();
      const addResponse = await this.api.post(
        isB2B ? "/api/order/add/heavy" : "/api/order/add/single",
        addOrderPayload,
        { headers: addHeaders },
      );

      if (!addResponse.data.success) {
        return { success: false, error: addResponse.data.message };
      }

      const systemOrderIdMatch = String(addResponse.data.data).match(/(\d+)/);
      if (!systemOrderIdMatch) {
        return { success: false, error: "Unable to parse system_order_id from Bigship response" };
      }
      const systemOrderId = systemOrderIdMatch[1];

      logger.info({
        message: "Bigship order added",
        systemOrderId,
        category: isB2B ? "b2b" : "b2c",
        boxes: boxes.length,
      });

      // Get serviceable couriers + rates for this order, pick the cheapest
      const rateHeaders = await this.authHeaders();
      const rateResponse = await this.api.get("/api/order/shipping/rates", {
        headers: rateHeaders,
        params: {
          shipment_category: isB2B ? "b2b" : "b2c",
          system_order_id: systemOrderId,
        },
      });

      const rates: any[] = rateResponse.data?.data ?? [];

      if (!rateResponse.data.success || rates.length === 0) {
        return {
          success: false,
          error: rateResponse.data.message ?? "No courier serviceable for this order",
        };
      }

      const cheapest = rates.sort(
        (a, b) => parseFloat(a.total_shipping_charges) - parseFloat(b.total_shipping_charges),
      )[0];

      // Manifest the order with the cheapest serviceable courier. B2B also
      // needs a risk_type, and Bigship rejects a risk the chosen courier does
      // not offer — so echo back the one the quote we picked was priced at
      // rather than forcing a default onto every courier.
      const manifestHeaders = await this.authHeaders();
      const manifestResponse = await this.api.post(
        isB2B ? "/api/order/manifest/heavy" : "/api/order/manifest/single",
        {
          system_order_id: parseInt(systemOrderId, 10),
          courier_id: cheapest.courier_id,
          ...(isB2B ? { risk_type: this.riskTypeOf(cheapest.risk_type_name) } : {}),
        },
        { headers: manifestHeaders },
      );

      if (!manifestResponse.data.success) {
        return { success: false, error: manifestResponse.data.message };
      }

      // Fetch the AWB assigned during manifesting (shipment_data_id 1 = AWB)
      const awbHeaders = await this.authHeaders();
      const awbResponse = await this.api.post("/api/shipment/data", null, {
        headers: awbHeaders,
        params: { shipment_data_id: 1, system_order_id: systemOrderId },
      });

      if (!awbResponse.data.success) {
        return { success: false, error: awbResponse.data.message };
      }

      logger.info({ message: "Bigship order manifested", systemOrderId, awb: awbResponse.data.data?.master_awb });

      return {
        success: true,
        bigshipOrderId: systemOrderId,
        awbCode: String(awbResponse.data.data.master_awb),
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      logger.error({
        message: "Bigship create order error",
        error: axiosError.response?.data ?? axiosError.message,
      });
      return {
        success: false,
        error: axiosError.response?.data ?? axiosError.message,
      };
    }
  }

  // ============================================================
  // GET WAREHOUSE LIST — the numeric warehouse_id returned here is what
  // BIGSHIP_PICKUP_LOCATION_ID must be set to. The seller panel shows the
  // same id prefixed with "BSW".
  // ============================================================
  async getWarehouseList(pageIndex = 1, pageSize = 50) {
    try {
      const headers = await this.authHeaders();
      const response = await this.api.get("/api/warehouse/get/list", {
        headers,
        params: { page_index: pageIndex, page_size: pageSize },
      });

      if (!response.data.success) {
        return { success: false, error: response.data.message };
      }

      return {
        success: true,
        warehouses: response.data.data?.result_data ?? [],
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      return {
        success: false,
        error: axiosError.response?.data ?? axiosError.message,
      };
    }
  }

  // ============================================================
  // CANCEL ORDER (by AWB)
  // ============================================================
  async cancelOrder(awb: string): Promise<CancelOrderResult> {
    try {
      const headers = await this.authHeaders();
      const response = await this.api.put("/api/order/cancel", [awb], { headers });

      const result = response.data?.data?.[0];
      const cancelled = result?.cancel_response === "Successfully Cancelled";

      return {
        success: !!response.data.success && cancelled,
        message: result?.cancel_response ?? response.data.message,
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      return {
        success: false,
        error: axiosError.response?.data ?? axiosError.message,
      };
    }
  }

  // ============================================================
  // TRACK SHIPMENT (by AWB)
  // ============================================================
  async trackShipment(awb: string): Promise<TrackShipmentResult> {
    try {
      const headers = await this.authHeaders();
      const response = await this.api.get("/api/tracking", {
        headers,
        params: { tracking_type: "awb", tracking_id: awb },
      });

      if (!response.data.success && !response.data.data) {
        return { success: false, error: response.data.message };
      }

      return { success: true, trackingData: response.data.data };
    } catch (error) {
      const axiosError = error as AxiosError;
      return {
        success: false,
        error: axiosError.response?.data ?? axiosError.message,
      };
    }
  }

  // ============================================================
  // NORMALIZE TRACKING — converts one Bigship scan event into the
  // Delhivery-shaped object the webhook_data table + trackOrder
  // query already understand, so no query changes needed.
  // ============================================================
  private normalizeStatusEvent(
    awb: string,
    scanStatus: string,
    scanDateTime: string | undefined,
    location: string | undefined,
    remarks: string | undefined,
  ) {
    const mapped = BIGSHIP_TO_DELHIVERY[scanStatus] ?? {
      statusType: "UD",
      status: scanStatus,
    };

    return {
      Shipment: {
        AWB: awb,
        Status: {
          Status: mapped.status,
          StatusType: mapped.statusType,
          StatusDateTime: scanDateTime ? parseBigshipDateTime(scanDateTime) : new Date().toISOString(),
          StatusLocation: location ?? "",
          Instructions: remarks ?? "",
        },
      },
    };
  }

  // Builds the full chronological (oldest -> newest) list of normalized
  // status events from a trackShipment() response, for backfilling
  // webhook_data since Bigship has no webhook push in this API version.
  normalizeTrackingHistory(trackingData: any, awb: string) {
    const histories: any[] = trackingData?.scan_histories ?? [];

    return [...histories].reverse().map((entry) =>
      this.normalizeStatusEvent(
        awb,
        entry.scan_status,
        entry.scan_datetime,
        entry.scan_location,
        entry.scan_remarks,
      ),
    );
  }
}

export default new BigshipService();
export { BigshipService };
