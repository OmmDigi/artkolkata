import axios, { AxiosInstance, AxiosError } from "axios";
import logger from "../../utils/logger";
import { ShipmentBox } from "./shipmentBoxes";
import { loadEnv } from "../../utils/loadEnv";

loadEnv();

// ============================================================
// Bigship "Unified Outbound API" (api.bigship.direct).
//
// This replaces the older api.bigship.in integration wholesale: different
// host, different routes (everything now lives under /api/outbound), a
// different success flag (`status`, not `success`), and a different booking
// flow — create a DRAFT order first, price it, then place it. The old routes
// answer "Route Not Found" 404s against this host, which is what a stale
// client shows at boot.
//
// Booking flow, per the docs:
//   1. POST api/outbound/create-order              -> CustomGlobalOrderId (draft)
//   2. POST api/outbound/courier-wise-shipment-cost -> serviceable couriers
//   3. POST api/outbound/place-order                -> AWB (multipart/form-data)
// Step 2 is mandatory before step 3 — Bigship rejects a place-order for an
// order it has not priced.
// ============================================================

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
  /** Bigship's CustomGlobalOrderId — the id every other endpoint keys off. */
  bigshipOrderId?: string;
  awbCode?: string;
  courierName?: string;
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
  // One entry books domestic_b2c, more than one books domestic_b2b.
  boxes: ShipmentBox[];
  // B2B only, and mandatory there — the order invoice, as a PDF buffer or a
  // data URI. Uploaded as a file on place-order.
  invoiceDocument?: string | Buffer;
  // B2B only, and mandatory once the invoice reaches EWAYBILL_THRESHOLD.
  ewaybillNumber?: string;
  ewaybillDocument?: string | Buffer;
}

/** invoice, label, manifest or ewaybill — what download-shipment-documents takes. */
export type BigshipDocumentType = "invoice" | "label" | "manifest" | "ewaybill";

// Bigship rejects a B2B shipment invoiced at or above this without an ewaybill
// number and document.
export const EWAYBILL_THRESHOLD = 50000;

// Payment modes, from api/outbound/get-payment-mode.
const PAYMENT_MODE_PREPAID = 1;
const PAYMENT_MODE_COD = 2;

// Risk types, from api/outbound/domestic/risk-types.
// 1 Third Party Insurance, 2 Owner Risk, 3 Carrier Risk.
const RISK_TYPE_OWNER = 2;

// ============================================================
// STATUS MAP — Bigship order_status / tag -> Delhivery-format
//
// Keys are matched loosely (case, spaces and hyphens ignored), because the
// same status comes back as "In-Transit" on one segment and "In Transit" on
// another.
// ============================================================

const BIGSHIP_TO_DELHIVERY: Record<string, { statusType: string; status: string }> = {
  "order placed": { statusType: "UD", status: "Manifested" },
  "pickup scheduled": { statusType: "UD", status: "Manifested" },
  "pickup pending": { statusType: "UD", status: "Manifested" },
  "rider assigned": { statusType: "UD", status: "Manifested" },
  "not picked": { statusType: "UD", status: "Not Picked" },
  "picked up": { statusType: "UD", status: "In Transit" },
  "in transit": { statusType: "UD", status: "In Transit" },
  "out for delivery": { statusType: "UD", status: "Dispatched" },
  delivered: { statusType: "DL", status: "Delivered" },
  undelivered: { statusType: "UD", status: "Pending" },
  cancelled: { statusType: "CN", status: "Canceled" },
  canceled: { statusType: "CN", status: "Canceled" },
  "rto initiated": { statusType: "RT", status: "In Transit" },
  "rto in transit": { statusType: "RT", status: "In Transit" },
  "rto delivered": { statusType: "DL", status: "RTO" },
  lost: { statusType: "CN", status: "Canceled" },
};

const statusKey = (value: string) =>
  String(value ?? "")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/**
 * Timestamps come back in three shapes across the outbound API:
 *   "2026-09-08T07:37:16.000000Z" — UTC ISO with a 6 digit fraction
 *   "2025-05-03 08:13:42"         — UTC, no zone marker
 *   "03-05-2025 08:13:42"         — the legacy IST form, still seen on older scans
 * Anything unparseable falls back to now rather than writing an Invalid Date.
 */
const parseBigshipDateTime = (value: string | undefined | null): string => {
  if (!value) return new Date().toISOString();

  const legacyIst = String(value).match(
    /^(\d{2})-(\d{2})-(\d{4})[ T](\d{2}):(\d{2}):(\d{2})$/,
  );
  if (legacyIst) {
    const [, day, month, year, hour, minute, second] = legacyIst;
    const istMs = Date.UTC(
      parseInt(year, 10),
      parseInt(month, 10) - 1,
      parseInt(day, 10),
      parseInt(hour, 10),
      parseInt(minute, 10),
      parseInt(second, 10),
    );
    return new Date(istMs - 5.5 * 60 * 60 * 1000).toISOString();
  }

  // A bare "YYYY-MM-DD HH:mm:ss" parses as *local* time in JS, but the docs
  // say every datetime the API returns is UTC — so mark it as such.
  const bare = String(value).match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/);
  const normalized = bare ? `${bare[1]}T${bare[2]}Z` : String(value);

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime())
    ? new Date().toISOString()
    : parsed.toISOString();
};

/** MasterOrderDate wants "Y-m-d H:i:s" in UTC, not an ISO string. */
const toBigshipDateTime = (value: string | Date): string => {
  const date = new Date(value);
  const usable = Number.isNaN(date.getTime()) ? new Date() : date;
  return usable.toISOString().replace("T", " ").slice(0, 19);
};

/** Turns a stored data URI or a raw PDF buffer into something FormData takes. */
const toFileBlob = (document: string | Buffer): Blob => {
  if (Buffer.isBuffer(document)) {
    return new Blob([new Uint8Array(document)], { type: "application/pdf" });
  }

  const dataUri = String(document).match(/^data:([^;]+);base64,([\s\S]*)$/);
  const mime = dataUri ? dataUri[1] : "application/pdf";
  const base64 = dataUri ? dataUri[2] : String(document);
  const bytes = Buffer.from(base64, "base64");

  return new Blob([new Uint8Array(bytes)], { type: mime });
};

// ============================================================
// SERVICE CLASS
// ============================================================

class BigshipClient {
  private baseURL: string;
  private userName: string;
  private password: string;
  private accessKey: string;
  private pickupLocationId: string;
  private returnLocationId: string;
  private warehousePincode: string;
  private defaultCategoryId: string;
  private riskTypeId: number;
  private cachedToken: CachedToken | null = null;
  private api: AxiosInstance;

  constructor() {
    this.baseURL = process.env.BIGSHIP_BASE_URL || "https://api.bigship.direct";
    this.userName = process.env.BIGSHIP_USER_NAME || "";
    this.password = process.env.BIGSHIP_PASSWORD || "";
    this.accessKey = process.env.BIGSHIP_ACCESS_KEY || "";
    this.pickupLocationId = process.env.BIGSHIP_PICKUP_LOCATION_ID || "";
    this.returnLocationId =
      process.env.BIGSHIP_RETURN_LOCATION_ID || this.pickupLocationId;
    this.warehousePincode = process.env.WAREHOUSE_PINCODE || "";
    this.defaultCategoryId = process.env.BIGSHIP_DEFAULT_CATEGORY_ID || "1";
    this.riskTypeId =
      parseInt(process.env.BIGSHIP_RISK_TYPE_ID ?? "", 10) || RISK_TYPE_OWNER;

    // Every outbound route is /api/outbound/*, so a base url with or without a
    // trailing slash has to end up at the same place.
    this.api = axios.create({ baseURL: this.baseURL.replace(/\/+$/, "") });
  }

  // The whole API answers with { status, message, status_code, data }. `status`
  // is the flag — the old integration read `success`, which is always
  // undefined here and made every call look like a failure.
  private isOk(body: any): boolean {
    return body?.status === true || body?.status === "true" || body?.status === 1;
  }

  private errorOf(body: any, fallback: string): string {
    // A 422 puts the useful text in errors.<field>[0] and only a generic line
    // in message.
    const firstFieldError = Object.values(body?.errors ?? {})
      .flat()
      .find((entry): entry is string => typeof entry === "string");

    return firstFieldError ?? body?.message ?? fallback;
  }

  // ============================================================
  // AUTH — api/outbound/login
  //
  // The response carries tokenExpiringAt, so the cache expires when Bigship
  // says it does rather than on a guessed lifetime, with a 5 minute margin.
  // ============================================================
  private async getToken(): Promise<string> {
    const now = Date.now();
    const margin = 5 * 60 * 1000;

    if (this.cachedToken && this.cachedToken.expiresAt > now + margin) {
      return this.cachedToken.token;
    }

    const response = await this.api.post(
      "/api/outbound/login",
      {
        username: this.userName,
        password: this.password,
        access_key: this.accessKey,
      },
      { headers: { "Content-Type": "application/json" } },
    );

    if (!this.isOk(response.data)) {
      throw new Error(this.errorOf(response.data, "Bigship login failed"));
    }

    const token: string = response.data.data?.token;
    if (!token) throw new Error("Bigship login returned no token");

    const expiresAt = Date.parse(response.data.data?.tokenExpiringAt ?? "");

    this.cachedToken = {
      token,
      expiresAt: Number.isNaN(expiresAt) ? now + 12 * 60 * 60 * 1000 : expiresAt,
    };

    return token;
  }

  // Bigship binds the warehouse ids as integers, but the seller panel shows
  // them prefixed — "BSW142255" for warehouse 142255. Sending the prefixed
  // form makes the request body fail validation. Accept either form, and fail
  // here with the actual reason if the value is neither.
  private numericLocationId(value: string, envVar: string): number {
    const parsed = Number(String(value).trim().replace(/^BSW/i, ""));

    if (!value || !Number.isInteger(parsed) || parsed <= 0) {
      throw new Error(
        `${envVar} must be a Bigship warehouse id (e.g. 142255 or BSW142255), but is "${value}".`,
      );
    }

    return parsed;
  }

  // ------------------------------------------------------------
  // FIELD SANITISERS
  //
  // The unified API is far less fussy than the old one — it no longer rejects
  // digits in a product name or punctuation in an address — so these only
  // normalise whitespace and enforce the lengths, rather than stripping
  // characters out of the customer's own address.
  // ------------------------------------------------------------

  private clean(value: string | undefined, max: number): string {
    return (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  }

  // productName is the one field the unified API still validates hard: it
  // accepts letters, spaces, dashes and underscores only, so digits, commas,
  // slashes, ampersands and the unicode dashes a catalogue picks up from a
  // word processor all come back as a 422. Fold what we can (– — → -,
  // accents → ascii) and drop the rest rather than failing the shipment.
  private cleanProductName(value: string | undefined, max: number): string {
    const words = (value ?? "")
      .normalize("NFKD")
      .replace(/[\u2010-\u2015]/g, "-")
      .replace(/[^A-Za-z\s\-_]+/g, " ")
      .split(/\s+/)
      // stripping the digits out of "AK-183" leaves a trailing dash behind.
      .map((word) => word.replace(/^[-_]+/, "").replace(/[-_]+$/, ""))
      .filter(Boolean);

    return words.join(" ").slice(0, max).trim();
  }

  // 10-12 digits — strip the +91 / spacing people type in.
  private cleanPhone(value: string | undefined): string {
    const digits = (value ?? "").replace(/\D/g, "");
    return digits.length > 12 ? digits.slice(-10) : digits;
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
  // api/outbound/user-rate-calculator
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
        segment_type: "domestic_b2c",
        sourcePincode: this.warehousePincode,
        destPincode: deliveryPincode,
        invoiceValue: String(invoiceValue),
        paymentModeId: codRequired ? PAYMENT_MODE_COD : PAYMENT_MODE_PREPAID,
        ...(codRequired ? { codAmount: String(invoiceValue) } : {}),
        riskTypeId: this.riskTypeId,
        boxes: [
          {
            no_of_box: 1,
            box_length: Math.ceil(dimensions?.length ?? 10),
            box_width: Math.ceil(dimensions?.breadth ?? 10),
            box_height: Math.ceil(dimensions?.height ?? 10),
            box_dead_weight: Math.max(0.1, weight),
          },
        ],
      };

      const response = await this.api.post(
        "/api/outbound/user-rate-calculator",
        payload,
        { headers },
      );

      // The docs describe `data` as an object but the sample is an array;
      // accept either so a tightened-up response does not break checkout.
      const body = response.data?.data;
      const rates: any[] = Array.isArray(body) ? body : (body?.calculatedRates ?? []);

      if (!this.isOk(response.data) || rates.length === 0) {
        return { success: true, serviceable: false };
      }

      const cheapest = [...rates].sort(
        (a, b) => this.rateTotal(a) - this.rateTotal(b),
      )[0];

      return {
        success: true,
        serviceable: true,
        shippingCharge: Math.ceil(this.rateTotal(cheapest)),
        courierId: parseInt(
          String(cheapest.courier_partner_id ?? cheapest.courierId),
          10,
        ),
        courierName: cheapest.courierName ?? cheapest.courier_name,
        codAvailable: true,
        estimatedDays: parseInt(String(cheapest.tat), 10) || undefined,
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

  // The rate calculator calls the payable figure totalCharge, the per-order
  // rates call it total, and hyperlocal calls it total_freight.
  private rateTotal(rate: any): number {
    const raw = rate?.totalCharge ?? rate?.total ?? rate?.total_freight ?? 0;
    return parseFloat(String(raw)) || 0;
  }

  // ============================================================
  // CREATE ORDER — draft -> rates -> place
  //
  // A single box books as domestic_b2c. Bigship caps B2C at exactly one box,
  // so a multi-box shipment goes as domestic_b2b instead: the products move
  // off the boxes onto a single ProductName, and the real invoice has to be
  // uploaded with the placement (plus an ewaybill above the threshold).
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

      const segmentType = isB2B ? "domestic_b2b" : "domestic_b2c";

      const email = params.customerEmail ?? "";
      const isValidEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);

      // Every box carries its own dimensions row. Only B2C carries products,
      // and MasterOrderInvoiceAmount has to equal the sum of their totalAmount
      // — so the whole item list rides on the first box rather than being
      // split across boxes the admin never mapped items to.
      const products = params.items.map((item) => ({
        productName: this.cleanProductName(item.name, 100) || "Item",
        hsn: (item.hsn ?? "").replace(/\D/g, ""),
        qty: String(item.units),
        amount: String(item.sellingPrice),
        totalAmount: item.units * item.sellingPrice,
        collectableAmount: isCod ? item.units * item.sellingPrice : 0,
        categoryId: this.defaultCategoryId,
      }));

      const boxPayload = boxes.map((box, index) => ({
        weight_unit: "kg",
        dimension_unit: "cm",
        noOfBoxes: 1,
        dimensions: [
          {
            length: Math.ceil(box.length),
            breadth: Math.ceil(box.breadth),
            height: Math.ceil(box.height),
            weight: Math.max(0.1, box.weight),
          },
        ],
        // products is required for domestic_b2c only.
        ...(isB2B ? {} : { products: index === 0 ? products : [] }),
      }));

      const createPayload: Record<string, any> = {
        segment_type: segmentType,
        MasterOrderPickUpLocation: this.numericLocationId(
          this.pickupLocationId,
          "BIGSHIP_PICKUP_LOCATION_ID",
        ),
        MasterOrderReturnLocation: this.numericLocationId(
          this.returnLocationId,
          "BIGSHIP_RETURN_LOCATION_ID",
        ),
        MasterOrderDate: toBigshipDateTime(params.orderDate),
        MasterOrderPaymentMode: isCod ? PAYMENT_MODE_COD : PAYMENT_MODE_PREPAID,
        OrderInvoiceNo: params.orderNumber,
        MasterOrderInvoiceAmount: invoiceAmount,
        MasterOrderCollectableAmount: isCod ? String(invoiceAmount) : "",
        MasterOrderShippingName: this.clean(params.customerName, 100) || "Customer",
        MasterOrderShippingEmail: isValidEmail ? email : "",
        MasterOrderShippingMobileNo: this.cleanPhone(params.customerPhone),
        MasterOrderShippingAddress: this.clean(params.customerAddress, 200),
        MasterOrderShippingAddress2: this.clean(params.customerAddress2, 200),
        MasterOrderShippingLandmark: this.clean(params.customerLandmark, 100),
        MasterOrderShippingZipCode: String(params.customerPincode ?? "").trim(),
        MasterOrderShippingCountry: params.customerCountry || "India",
        MasterOrderShippingState: this.clean(params.customerState, 100),
        MasterOrderShippingCity: this.clean(params.customerCity, 100),
        totalNumOfBoxes: boxes.length,
        boxes: boxPayload,
      };

      // B2B has no per-product lines; it names the goods once and reads the
      // money off the uploaded invoice instead.
      if (isB2B) {
        createPayload.ProductName =
          this.cleanProductName(params.items[0]?.name, 100) || "Goods";
      }

      const createHeaders = await this.authHeaders();
      const createResponse = await this.api.post(
        "/api/outbound/create-order",
        createPayload,
        { headers: createHeaders },
      );

      if (!this.isOk(createResponse.data)) {
        return {
          success: false,
          error: this.errorOf(createResponse.data, "Bigship draft order failed"),
        };
      }

      const customGlobalOrderId = String(
        createResponse.data.data?.CustomGlobalOrderId ?? "",
      ).trim();

      if (!customGlobalOrderId) {
        return {
          success: false,
          error: "Bigship returned no CustomGlobalOrderId for the draft order",
        };
      }

      logger.info({
        message: "Bigship draft order created",
        customGlobalOrderId,
        segment: segmentType,
        boxes: boxes.length,
      });

      // Rates must be fetched before the order can be placed — Bigship stores
      // the quote against the draft and refuses a placement without one.
      const rateHeaders = await this.authHeaders();
      const rateResponse = await this.api.post(
        "/api/outbound/courier-wise-shipment-cost",
        { MasterCustomOrderId: customGlobalOrderId },
        { headers: rateHeaders },
      );

      const rates: any[] = rateResponse.data?.data?.calculatedRates ?? [];

      if (!this.isOk(rateResponse.data) || rates.length === 0) {
        return {
          success: false,
          error: this.errorOf(
            rateResponse.data,
            "No courier serviceable for this order",
          ),
        };
      }

      const cheapest = [...rates].sort(
        (a, b) => this.rateTotal(a) - this.rateTotal(b),
      )[0];

      // Bigship rejects a risk type the chosen courier does not offer, so take
      // the one its own quote is marked with (isRisk) and only fall back to the
      // configured default when the rate carries no riskCharges at all.
      const quotedRisk = (cheapest.riskCharges ?? []).find(
        (risk: any) => risk?.isRisk === true,
      );
      const riskTypeId = parseInt(String(quotedRisk?.typeId ?? ""), 10) || this.riskTypeId;

      // Domestic placements are multipart/form-data because the invoice and
      // ewaybill go up as files.
      const form = new FormData();
      form.append("MasterCustomOrderId", customGlobalOrderId);
      form.append("courierId", String(cheapest.courierId));
      form.append("riskTypeId", String(riskTypeId));

      if (isB2B && params.invoiceDocument) {
        form.append("invoiceType", "uploaded");
        form.append(
          "InvoiceData",
          toFileBlob(params.invoiceDocument),
          `invoice-${params.orderNumber}.pdf`,
        );
      }

      if (isB2B && params.ewaybillNumber && params.ewaybillDocument) {
        form.append("EwaybillNo", params.ewaybillNumber.replace(/\D/g, ""));
        form.append(
          "EwayBillData",
          toFileBlob(params.ewaybillDocument),
          `ewaybill-${params.orderNumber}.pdf`,
        );
      }

      const token = await this.getToken();
      const placeResponse = await this.api.post("/api/outbound/place-order", form, {
        // Content-Type is left to axios so it can add the multipart boundary.
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!this.isOk(placeResponse.data)) {
        return {
          success: false,
          bigshipOrderId: customGlobalOrderId,
          error: this.errorOf(placeResponse.data, "Bigship order placement failed"),
        };
      }

      const awb = placeResponse.data.data?.awb_assigned;

      logger.info({
        message: "Bigship order placed",
        customGlobalOrderId,
        courier: cheapest.courierName,
        awb,
      });

      return {
        success: true,
        bigshipOrderId: customGlobalOrderId,
        awbCode: awb == null ? undefined : String(awb),
        courierName: cheapest.courierName,
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
  // GET WAREHOUSE LIST — api/outbound/get-warehouse-list
  //
  // The numeric warehouseId returned here is what BIGSHIP_PICKUP_LOCATION_ID
  // must be set to; the seller panel shows the same id prefixed with "BSW".
  // perPage must be a multiple of 5 and at most 25.
  // ============================================================
  async getWarehouseList(page = 1, perPage = 25, segmentType = "local") {
    try {
      const headers = await this.authHeaders();
      const size = Math.min(25, Math.max(5, Math.round(perPage / 5) * 5));

      const response = await this.api.get("/api/outbound/get-warehouse-list", {
        headers,
        params: {
          page: String(page),
          perPage: String(size),
          segment_type: segmentType,
        },
      });

      if (!this.isOk(response.data)) {
        return {
          success: false,
          error: this.errorOf(response.data, "Bigship warehouse list failed"),
        };
      }

      return {
        success: true,
        warehouses: response.data.data?.warehouse ?? [],
        total: response.data.data?.total ?? 0,
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
  // CANCEL ORDER
  //
  // Cancellation is keyed off the CustomGlobalOrderId now, not the AWB, and
  // only works before the shipment reaches Rider-Assigned. The docs name the
  // field MasterCustomOrderId in prose and CustomGlobalOrderId in the sample,
  // so both are sent — they hold the same value either way.
  // ============================================================
  async cancelOrder(customGlobalOrderId: string): Promise<CancelOrderResult> {
    try {
      const headers = await this.authHeaders();
      const response = await this.api.post(
        "/api/outbound/cancel-order",
        {
          CustomGlobalOrderId: customGlobalOrderId,
          MasterCustomOrderId: customGlobalOrderId,
        },
        { headers },
      );

      return {
        success: this.isOk(response.data),
        message: response.data?.message,
        ...(this.isOk(response.data)
          ? {}
          : { error: this.errorOf(response.data, "Bigship cancel failed") }),
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
  // TRACK SHIPMENT — api/outbound/track-order
  //
  // Takes either the AWB (TrackingNumber) or the CustomGlobalOrderId. It is a
  // GET with a JSON body, so the identifiers also go on the query string — a
  // GET body is easy for a proxy to drop.
  // ============================================================
  async trackShipment(
    trackingNumber?: string | null,
    customGlobalOrderId?: string | null,
  ): Promise<TrackShipmentResult> {
    if (!trackingNumber && !customGlobalOrderId) {
      return {
        success: false,
        error: "Bigship tracking needs a tracking number or a CustomGlobalOrderId",
      };
    }

    try {
      const headers = await this.authHeaders();
      const identifiers = {
        ...(trackingNumber ? { TrackingNumber: trackingNumber } : {}),
        ...(customGlobalOrderId
          ? { CustomGlobalOrderId: customGlobalOrderId }
          : {}),
      };

      const response = await this.api.get("/api/outbound/track-order", {
        headers,
        params: identifiers,
        data: identifiers,
      });

      if (!this.isOk(response.data) && !response.data?.data) {
        return {
          success: false,
          error: this.errorOf(response.data, "Bigship tracking failed"),
        };
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
  // ORDER DETAIL — api/outbound/order-shipment-details
  // ============================================================
  async getOrderDetail(customGlobalOrderId: string) {
    try {
      const headers = await this.authHeaders();
      const body = { MasterCustomOrderId: customGlobalOrderId };

      const response = await this.api.get("/api/outbound/order-shipment-details", {
        headers,
        params: body,
        data: body,
      });

      if (!this.isOk(response.data)) {
        return {
          success: false,
          error: this.errorOf(response.data, "Bigship order detail failed"),
        };
      }

      return { success: true, detail: response.data.data };
    } catch (error) {
      const axiosError = error as AxiosError;
      return {
        success: false,
        error: axiosError.response?.data ?? axiosError.message,
      };
    }
  }

  // ============================================================
  // DOWNLOAD SHIPMENT DOCUMENTS — api/outbound/download-shipment-documents
  //
  // Answers with a URL to the document rather than the bytes.
  // ============================================================
  async downloadShipmentDocument(
    customGlobalOrderId: string,
    documentType: BigshipDocumentType,
  ) {
    try {
      const headers = await this.authHeaders();
      const body = {
        CustomGlobalOrderId: customGlobalOrderId,
        document_type: documentType,
      };

      const response = await this.api.get(
        "/api/outbound/download-shipment-documents",
        { headers, params: body, data: body },
      );

      if (!this.isOk(response.data)) {
        return {
          success: false,
          error: this.errorOf(
            response.data,
            `Bigship ${documentType} document not found`,
          ),
        };
      }

      return {
        success: true,
        url: response.data.data?.AttachmentData,
        mimeType: response.data.data?.File_extention,
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
  // NORMALIZE TRACKING — converts one Bigship checkpoint into the
  // Delhivery-shaped object the webhook_data table + trackOrder
  // query already understand, so no query changes needed.
  // ============================================================
  private normalizeStatusEvent(
    awb: string,
    orderStatus: string,
    checkpointTime: string | undefined,
    location: any,
    message: string | undefined,
  ) {
    const mapped = BIGSHIP_TO_DELHIVERY[statusKey(orderStatus)] ?? {
      statusType: "UD",
      status: orderStatus,
    };

    // Domestic checkpoints carry no place name, only a lat/long pair (often
    // null). A coordinate is better than an empty column when there is one.
    const where =
      typeof location === "string"
        ? location
        : location?.latitude && location?.longitude
          ? `${location.latitude},${location.longitude}`
          : "";

    return {
      Shipment: {
        AWB: awb,
        Status: {
          Status: mapped.status,
          StatusType: mapped.statusType,
          StatusDateTime: parseBigshipDateTime(checkpointTime),
          StatusLocation: where,
          Instructions: message ?? "",
        },
      },
    };
  }

  // Builds the full chronological (oldest -> newest) list of normalized
  // status events from a trackShipment() response, for backfilling
  // webhook_data since Bigship has no webhook push in this API version.
  //
  // Domestic shipments report them as `checkpoints`, hyperlocal as
  // `tracking_histories`; both come back newest first, so they are sorted by
  // their own timestamps rather than trusted to arrive in order.
  normalizeTrackingHistory(trackingData: any, awb: string) {
    const checkpoints: any[] =
      trackingData?.checkpoints ??
      trackingData?.tracking_histories ??
      trackingData?.scan_histories ??
      [];

    return checkpoints
      .map((entry) =>
        this.normalizeStatusEvent(
          awb,
          entry.order_status ?? entry.tag ?? entry.scan_status,
          entry.checkpoint_time ?? entry.scan_datetime,
          entry.location ?? entry.scan_location,
          entry.message ?? entry.scan_remarks,
        ),
      )
      .sort(
        (a, b) =>
          Date.parse(a.Shipment.Status.StatusDateTime) -
          Date.parse(b.Shipment.Status.StatusDateTime),
      );
  }
}

export default new BigshipClient();
export { BigshipClient };
