import axios, { AxiosInstance, AxiosError } from "axios";
import logger from "../utils/logger";

// ============================================================
// Bigship "Unified Outbound API" (Bigship Direct), doc v1.4.
//
// This is a different product from the old api.bigship.in endpoints: new
// host, every path under /api/outbound, success is reported as `status`
// rather than `success`, orders are addressed by CustomGlobalOrderId instead
// of by AWB, and the order is booked in three calls — create draft, fetch
// courier rates for the draft, place it.
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
  // One entry books domestic_b2c, more than one books domestic_b2b.
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

// Ids from "Get Payment Mode List" — fixed across accounts.
const PAYMENT_MODE = { PREPAID: 1, COD: 2, TOPAY: 3 } as const;

// Ids from "Get Risk Type List" — 1 Third Party Insurance, 2 Owner Risk,
// 3 Carrier Risk. Owner Risk is the default when the courier offers it.
const RISK_TYPE = { THIRD_PARTY: 1, OWNER: 2, CARRIER: 3 } as const;

// Segment types the create-order / rate APIs accept. Hyperlocal is a separate
// product we do not book.
const SEGMENT = { B2C: "domestic_b2c", B2B: "domestic_b2b" } as const;

// ============================================================
// STATUS MAP — Bigship order_status/tag → Delhivery-format
// (tracking API returns the tag, e.g. "In-Transit", "Delivered")
// ============================================================

const BIGSHIP_TO_DELHIVERY: Record<string, { statusType: string; status: string }> = {
  "Order Placed":      { statusType: "UD", status: "Manifested" },
  Manifested:          { statusType: "UD", status: "Manifested" },
  "Pickup Scheduled":  { statusType: "UD", status: "Manifested" },
  "Pickup Pending":    { statusType: "UD", status: "Manifested" },
  "Not Picked":        { statusType: "UD", status: "Not Picked" },
  "Picked Up":         { statusType: "UD", status: "In Transit" },
  "In-Transit":        { statusType: "UD", status: "In Transit" },
  "In Transit":        { statusType: "UD", status: "In Transit" },
  "Out for Delivery":  { statusType: "UD", status: "Dispatched" },
  "Out For Delivery":  { statusType: "UD", status: "Dispatched" },
  Delivered:           { statusType: "DL", status: "Delivered" },
  Undelivered:         { statusType: "UD", status: "Pending" },
  Cancelled:           { statusType: "CN", status: "Canceled" },
  Canceled:            { statusType: "CN", status: "Canceled" },
  "RTO In Transit":    { statusType: "RT", status: "In Transit" },
  "RTO In-Transit":    { statusType: "RT", status: "In Transit" },
  RTO:                 { statusType: "RT", status: "In Transit" },
  "RTO Delivered":     { statusType: "DL", status: "RTO" },
  Lost:                { statusType: "CN", status: "Canceled" },
};

// checkpoint_time comes back as a UTC ISO string on this API version; the
// older "DD-MM-YYYY HH:mm:ss" IST form is still accepted here so a mixed
// response does not poison the timeline.
const parseBigshipDateTime = (value: string): string => {
  const match = value.match(/^(\d{2})-(\d{2})-(\d{4})[ T](\d{2}):(\d{2}):(\d{2})$/);

  if (!match) {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  }

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

// MasterOrderDate is typed "Y-m-d H:i:s" in UTC, not ISO-8601.
const toBigshipDateTime = (value: string): string => {
  const parsed = new Date(value);
  const date = isNaN(parsed.getTime()) ? new Date() : parsed;
  return date.toISOString().slice(0, 19).replace("T", " ");
};

// ============================================================
// SERVICE CLASS
// ============================================================

// Every setting is read from process.env at call time, never cached in the
// constructor. index.ts calls dotenv.config() after its imports, and ES
// imports run first — a constructor reading process.env here would capture
// empty credentials and Bigship would answer "The username field is
// required." on every call.
class BigshipService {
  private cachedToken: CachedToken | null = null;
  private apiClient: AxiosInstance | null = null;

  private get baseURL(): string {
    return process.env.BIGSHIP_BASE_URL || "https://api.bigship.direct";
  }

  private get userName(): string {
    return process.env.BIGSHIP_USER_NAME || "";
  }

  private get password(): string {
    return process.env.BIGSHIP_PASSWORD || "";
  }

  private get accessKey(): string {
    return process.env.BIGSHIP_ACCESS_KEY || "";
  }

  private get pickupLocationId(): string {
    return process.env.BIGSHIP_PICKUP_LOCATION_ID || "";
  }

  private get returnLocationId(): string {
    return process.env.BIGSHIP_RETURN_LOCATION_ID || this.pickupLocationId;
  }

  private get warehousePincode(): string {
    return process.env.WAREHOUSE_PINCODE || "";
  }

  // categoryId is required on every B2C product line. The panel's category
  // ids are numeric on this API; "Others" is no longer accepted.
  private get defaultCategoryId(): string {
    return process.env.BIGSHIP_DEFAULT_CATEGORY_ID || "1";
  }

  private get defaultRiskTypeId(): number {
    return parseInt(process.env.BIGSHIP_RISK_TYPE_ID || "", 10) || RISK_TYPE.OWNER;
  }

  // Built on first use, and rebuilt if the configured host ever changes.
  private get api(): AxiosInstance {
    if (!this.apiClient || this.apiClient.defaults.baseURL !== this.baseURL) {
      this.apiClient = axios.create({ baseURL: this.baseURL });
    }

    return this.apiClient;
  }

  // Every endpoint reports success as `status`. Older deployments answered
  // with `success`, so both are accepted rather than silently reading a
  // truthy-looking payload as a failure.
  private ok(payload: any): boolean {
    const flag = payload?.status ?? payload?.success;
    return flag === true || flag === 1 || flag === "1" || flag === "true";
  }

  // 422 responses carry the offending fields in `errors`, which is the only
  // place that says what was actually wrong with the payload.
  private errorOf(payload: any): string {
    const fieldErrors = payload?.errors
      ? Object.entries(payload.errors)
          .map(([field, messages]) =>
            `${field}: ${Array.isArray(messages) ? messages.join(", ") : messages}`,
          )
          .join(" | ")
      : "";

    return [payload?.message, fieldErrors].filter(Boolean).join(" — ") ||
      "Bigship request failed";
  }

  // ============================================================
  // AUTH — the login response states its own expiry in tokenExpiringAt;
  // cached with a 1 hr safety buffer and refreshed proactively.
  // ============================================================
  private async getToken(): Promise<string> {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    if (this.cachedToken && this.cachedToken.expiresAt > now + oneHour) {
      return this.cachedToken.token;
    }

    // Bigship answers a blank credential with a 422 naming the field rather
    // than the cause, so say plainly which variable is missing instead.
    const missing = (
      [
        ["BIGSHIP_USER_NAME", this.userName],
        ["BIGSHIP_PASSWORD", this.password],
        ["BIGSHIP_ACCESS_KEY", this.accessKey],
      ] as const
    )
      .filter(([, value]) => !value)
      .map(([name]) => name);

    if (missing.length > 0) {
      throw new Error(`Bigship credentials missing from env: ${missing.join(", ")}`);
    }

    const response = await this.api.post("/api/outbound/login", {
      username: this.userName,
      password: this.password,
      access_key: this.accessKey,
    });

    if (!this.ok(response.data)) {
      throw new Error(this.errorOf(response.data));
    }

    const token: string = response.data.data.token;
    const statedExpiry = Date.parse(response.data.data.tokenExpiringAt ?? "");

    this.cachedToken = {
      token,
      expiresAt: isNaN(statedExpiry) ? now + 12 * 60 * 60 * 1000 : statedExpiry,
    };

    return token;
  }

  // Warehouse ids bind as integers, but the seller panel shows them prefixed —
  // "BSW142255" for warehouse 142255. Accept either form, and fail here with
  // the actual reason if the value is neither.
  private numericLocationId(value: string, envVar: string): number {
    const parsed = Number(value.trim().replace(/^BSW/i, ""));

    if (!value || !Number.isInteger(parsed) || parsed <= 0) {
      throw new Error(
        `${envVar} must be a Bigship warehouse id (e.g. 258 or BSW258), but is "${value}".`,
      );
    }

    return parsed;
  }

  // ------------------------------------------------------------
  // FIELD SANITISERS — validation failures come back as a generic 422,
  // so normalise the free-text fields before sending.
  // ------------------------------------------------------------

  private cleanName(value: string | undefined, fallback: string): string {
    const cleaned = (value ?? "")
      .replace(/[^A-Za-z. ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return (cleaned.length >= 3 ? cleaned : fallback).slice(0, 50);
  }

  // Address parts: alphanumeric, spaces and ' . , - / only.
  private cleanAddress(value: string | undefined, max = 100): string {
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

  // Product names go across as typed apart from characters that break the
  // JSON-schema validation; unlike the old API, digits are allowed here.
  private cleanProductName(value: string | undefined): string {
    const cleaned = (value ?? "")
      .replace(/[^A-Za-z0-9 .,/-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return cleaned.length > 0 ? cleaned.slice(0, 100) : "Item";
  }

  private async authHeaders() {
    const token = await this.getToken();
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  // place-order is multipart for domestic shipments, so the stored documents
  // (kept as data URIs) have to go across as real files.
  private fileFromDataUri(
    value: string | undefined,
    fallbackName: string,
  ): { blob: Blob; filename: string } | null {
    if (!value) return null;

    const match = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(value.trim());
    const mime = match?.[1] || "application/pdf";
    const payload = match ? match[3] : value.trim();
    const isBase64 = match ? !!match[2] : true;

    try {
      const buffer = isBase64
        ? Buffer.from(payload, "base64")
        : Buffer.from(decodeURIComponent(payload), "utf8");

      if (buffer.length === 0) return null;

      const extension = mime.split("/")[1]?.split("+")[0] || "pdf";

      return {
        blob: new Blob([new Uint8Array(buffer)], { type: mime }),
        filename: `${fallbackName}.${extension}`,
      };
    } catch {
      return null;
    }
  }

  // The rate response lists every risk the quote could be priced at and flags
  // the one actually used with isRisk. Echo that back when placing the order
  // so we never ask for a risk the chosen courier does not offer.
  private riskTypeIdOf(rate: any): number {
    const selected = (rate?.riskCharges as any[] | undefined)?.find(
      (risk) => risk?.isRisk === true,
    );

    const fromRate = parseInt(String(selected?.typeId ?? ""), 10);
    if (Number.isInteger(fromRate) && fromRate > 0) return fromRate;

    const byName = String(rate?.riskTypeName ?? "").toLowerCase();
    if (byName.includes("carrier")) return RISK_TYPE.CARRIER;
    if (byName.includes("third")) return RISK_TYPE.THIRD_PARTY;

    return this.defaultRiskTypeId;
  }

  // Domestic quotes price into `total`; hyperlocal into `total_freight`, and
  // the standalone calculator into `totalCharge`.
  private rateTotal(rate: any): number {
    const raw = rate?.total ?? rate?.totalCharge ?? rate?.total_freight ?? 0;
    const parsed = parseFloat(String(raw));
    return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
  }

  private cheapestRate(rates: any[]): any {
    return [...rates].sort((a, b) => this.rateTotal(a) - this.rateTotal(b))[0];
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
        segment_type: SEGMENT.B2C,
        sourcePincode: this.warehousePincode,
        destPincode: deliveryPincode,
        invoiceValue,
        paymentModeId: codRequired ? PAYMENT_MODE.COD : PAYMENT_MODE.PREPAID,
        ...(codRequired ? { codAmount: invoiceValue } : {}),
        riskTypeId: this.defaultRiskTypeId,
        // B2C is capped at a single box on this endpoint.
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

      const rates: any[] = response.data?.data ?? [];

      if (!this.ok(response.data) || rates.length === 0) {
        return { success: true, serviceable: false };
      }

      const cheapest = this.cheapestRate(rates);

      return {
        success: true,
        serviceable: true,
        shippingCharge: Math.ceil(this.rateTotal(cheapest)),
        courierId: parseInt(String(cheapest.courier_partner_id ?? cheapest.courierId), 10),
        courierName: cheapest.courierName,
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

  // ============================================================
  // CREATE ORDER — create draft -> courier rates -> place order
  //
  // A single box books as domestic_b2c. Bigship caps B2C at one box, so a
  // multi-box shipment books as domestic_b2b instead: box product lines are
  // replaced by a single ProductName, the placement needs a risk type and an
  // invoice document, and an ewaybill above the threshold. Everything else —
  // auth, consignee, cheapest-courier pick, AWB — is shared.
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

      const shippingName = this.cleanName(params.customerName, "Customer");

      let addressLine1 = this.cleanAddress(params.customerAddress);
      if (addressLine1.length < 10) {
        addressLine1 = this.cleanAddress(
          `${addressLine1} ${params.customerCity}`.trim(),
        );
      }

      const email = params.customerEmail ?? "";
      const isValidEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);

      // B2C prices the shipment off the product lines, and Bigship checks that
      // MasterOrderInvoiceAmount equals the sum of every totalAmount.
      const products = params.items.map((item) => {
        const lineTotal = item.units * item.sellingPrice;

        return {
          productName: this.cleanProductName(item.name),
          hsn: (item.hsn ?? "").replace(/\D/g, ""),
          qty: item.units,
          amount: item.sellingPrice,
          totalAmount: lineTotal,
          collectableAmount: isCod ? lineTotal : 0,
          categoryId: this.defaultCategoryId,
        };
      });

      // Every box declares its own dimension block. The admin keys the boxes
      // in by hand and never says which item went where, so on B2C the full
      // item list rides on the single box; B2B carries no product lines at
      // all and is invoiced on the attached document instead.
      const boxPayload = boxes.map((box) => ({
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
        ...(isB2B ? {} : { products }),
      }));

      const createOrderPayload = {
        segment_type: isB2B ? SEGMENT.B2B : SEGMENT.B2C,
        MasterOrderPickUpLocation: this.numericLocationId(
          this.pickupLocationId,
          "BIGSHIP_PICKUP_LOCATION_ID",
        ),
        MasterOrderReturnLocation: this.numericLocationId(
          this.returnLocationId,
          "BIGSHIP_RETURN_LOCATION_ID",
        ),
        MasterOrderDate: toBigshipDateTime(params.orderDate),
        MasterOrderPaymentMode: isCod ? PAYMENT_MODE.COD : PAYMENT_MODE.PREPAID,
        OrderInvoiceNo: params.orderNumber,
        MasterOrderInvoiceAmount: invoiceAmount,
        MasterOrderCollectableAmount: isCod ? String(invoiceAmount) : "",
        // Start::Receiver information
        MasterOrderShippingName: shippingName,
        MasterOrderShippingEmail: isValidEmail ? email : "",
        MasterOrderShippingMobileNo: this.cleanPhone(params.customerPhone),
        MasterOrderShippingAddress: addressLine1,
        MasterOrderShippingAddress2: this.cleanAddress(params.customerAddress2 ?? ""),
        MasterOrderShippingLandmark: this.cleanAddress(params.customerLandmark ?? "N A"),
        MasterOrderShippingZipCode: params.customerPincode,
        MasterOrderShippingCity: params.customerCity,
        MasterOrderShippingState: params.customerState,
        MasterOrderShippingCountry: params.customerCountry || "India",
        // End::Receiver information
        totalNumOfBoxes: boxes.length,
        // B2B has no per-box product lines, so the goods are named once.
        ...(isB2B
          ? { ProductName: this.cleanProductName(params.items[0]?.name) }
          : {}),
        boxes: boxPayload,
      };

      const createHeaders = await this.authHeaders();
      const createResponse = await this.api.post(
        "/api/outbound/create-order",
        createOrderPayload,
        { headers: createHeaders },
      );

      if (!this.ok(createResponse.data)) {
        return { success: false, error: this.errorOf(createResponse.data) };
      }

      const orderId = String(
        createResponse.data.data?.CustomGlobalOrderId ??
          createResponse.data.data?.MasterCustomOrderId ??
          "",
      ).trim();

      if (!orderId) {
        return {
          success: false,
          error: "Unable to read CustomGlobalOrderId from Bigship response",
        };
      }

      logger.info({
        message: "Bigship draft order created",
        orderId,
        segment: isB2B ? SEGMENT.B2B : SEGMENT.B2C,
        boxes: boxes.length,
      });

      // Serviceable couriers + rates for the draft, cheapest wins. Bigship
      // requires this call before the order can be placed.
      const rateHeaders = await this.authHeaders();
      const rateResponse = await this.api.post(
        "/api/outbound/courier-wise-shipment-cost",
        { MasterCustomOrderId: orderId },
        { headers: rateHeaders },
      );

      const rates: any[] = rateResponse.data?.data?.calculatedRates ?? [];

      if (!this.ok(rateResponse.data) || rates.length === 0) {
        return {
          success: false,
          error:
            this.errorOf(rateResponse.data) ??
            "No courier serviceable for this order",
        };
      }

      const cheapest = this.cheapestRate(rates);

      // Domestic placement is multipart — the invoice and ewaybill go across
      // as files, not as base64 in a JSON body.
      const form = new FormData();
      form.append("MasterCustomOrderId", orderId);
      form.append("courierId", String(cheapest.courierId));
      form.append("riskTypeId", String(this.riskTypeIdOf(cheapest)));

      const invoiceFile = this.fileFromDataUri(
        params.invoiceDocument,
        `invoice-${params.orderNumber}`,
      );

      if (invoiceFile) {
        form.append("invoiceType", "uploaded");
        form.append("InvoiceData", invoiceFile.blob, invoiceFile.filename);
      }

      if (isB2B && invoiceAmount >= EWAYBILL_THRESHOLD) {
        const ewaybillFile = this.fileFromDataUri(
          params.ewaybillDocument,
          `ewaybill-${params.orderNumber}`,
        );

        form.append("EwaybillNo", (params.ewaybillNumber ?? "").replace(/\D/g, ""));

        if (ewaybillFile) {
          form.append("EwayBillData", ewaybillFile.blob, ewaybillFile.filename);
        }
      }

      const token = await this.getToken();
      const placeResponse = await this.api.post("/api/outbound/place-order", form, {
        // Content-Type (with its multipart boundary) is set by axios here.
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!this.ok(placeResponse.data)) {
        return { success: false, error: this.errorOf(placeResponse.data) };
      }

      const awb = placeResponse.data.data?.awb_assigned;

      logger.info({
        message: "Bigship order placed",
        orderId,
        courierId: cheapest.courierId,
        awb,
      });

      return {
        success: true,
        bigshipOrderId: orderId,
        awbCode: awb != null ? String(awb) : undefined,
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
  // GET WAREHOUSE LIST — the numeric warehouseId returned here is what
  // BIGSHIP_PICKUP_LOCATION_ID must be set to. perPage must be a multiple
  // of 5 and at most 25.
  // ============================================================
  async getWarehouseList(page = 1, perPage = 25, segmentType = "local") {
    try {
      const headers = await this.authHeaders();
      const size = Math.min(25, Math.max(5, Math.round(perPage / 5) * 5));

      const response = await this.api.get("/api/outbound/get-warehouse-list", {
        headers,
        params: { page, perPage: size, segment_type: segmentType },
      });

      if (!this.ok(response.data)) {
        return { success: false, error: this.errorOf(response.data) };
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
  // REFERENCE DATA — payment modes and risk types, whose ids the
  // create/place payloads are built from.
  // ============================================================
  async getPaymentModes(segmentType: string = SEGMENT.B2C) {
    try {
      const headers = await this.authHeaders();
      const response = await this.api.get("/api/outbound/get-payment-mode", {
        headers,
        params: { segment_type: segmentType },
      });

      if (!this.ok(response.data)) {
        return { success: false, error: this.errorOf(response.data) };
      }

      return { success: true, paymentModes: response.data.data ?? [] };
    } catch (error) {
      const axiosError = error as AxiosError;
      return { success: false, error: axiosError.response?.data ?? axiosError.message };
    }
  }

  async getRiskTypes() {
    try {
      const headers = await this.authHeaders();
      const response = await this.api.get("/api/outbound/domestic/risk-types", {
        headers,
      });

      if (!this.ok(response.data)) {
        return { success: false, error: this.errorOf(response.data) };
      }

      return { success: true, riskTypes: response.data.data ?? [] };
    } catch (error) {
      const axiosError = error as AxiosError;
      return { success: false, error: axiosError.response?.data ?? axiosError.message };
    }
  }

  // ============================================================
  // CANCEL ORDER — keyed on the Bigship order id (CustomGlobalOrderId)
  // stored as orders.bigship_order_id, not on the AWB.
  // ============================================================
  async cancelOrder(bigshipOrderId: string): Promise<CancelOrderResult> {
    try {
      const headers = await this.authHeaders();
      const response = await this.api.post(
        "/api/outbound/cancel-order",
        { CustomGlobalOrderId: String(bigshipOrderId) },
        { headers },
      );

      if (!this.ok(response.data)) {
        return { success: false, error: this.errorOf(response.data) };
      }

      return { success: true, message: response.data.message };
    } catch (error) {
      const axiosError = error as AxiosError;
      return {
        success: false,
        error: axiosError.response?.data ?? axiosError.message,
      };
    }
  }

  // ============================================================
  // TRACK SHIPMENT — also keyed on the Bigship order id.
  // ============================================================
  async trackShipment(bigshipOrderId: string): Promise<TrackShipmentResult> {
    try {
      const headers = await this.authHeaders();
      const response = await this.api.get("/api/outbound/track-order", {
        headers,
        params: { CustomGlobalOrderId: String(bigshipOrderId) },
      });

      if (!this.ok(response.data) && !response.data?.data) {
        return { success: false, error: this.errorOf(response.data) };
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
  // ORDER DETAIL + DOCUMENTS
  // ============================================================
  async getOrderDetail(bigshipOrderId: string) {
    try {
      const headers = await this.authHeaders();
      const response = await this.api.get("/api/outbound/order-shipment-details", {
        headers,
        params: { MasterCustomOrderId: String(bigshipOrderId) },
      });

      if (!this.ok(response.data)) {
        return { success: false, error: this.errorOf(response.data) };
      }

      return { success: true, order: response.data.data };
    } catch (error) {
      const axiosError = error as AxiosError;
      return { success: false, error: axiosError.response?.data ?? axiosError.message };
    }
  }

  // Returns a URL to the document on Bigship's storage, not the bytes.
  async downloadShipmentDocument(
    bigshipOrderId: string,
    documentType: "invoice" | "label" | "ewaybill" | "manifest",
  ) {
    try {
      const headers = await this.authHeaders();
      const response = await this.api.get(
        "/api/outbound/download-shipment-documents",
        {
          headers,
          params: {
            CustomGlobalOrderId: String(bigshipOrderId),
            document_type: documentType,
          },
        },
      );

      if (!this.ok(response.data)) {
        return { success: false, error: this.errorOf(response.data) };
      }

      return {
        success: true,
        url: response.data.data?.AttachmentData,
        mimeType: response.data.data?.File_extention,
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      return { success: false, error: axiosError.response?.data ?? axiosError.message };
    }
  }

  // ============================================================
  // NORMALIZE TRACKING — converts one Bigship checkpoint into the
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
          StatusDateTime: scanDateTime
            ? parseBigshipDateTime(scanDateTime)
            : new Date().toISOString(),
          StatusLocation: location ?? "",
          Instructions: remarks ?? "",
        },
      },
    };
  }

  // Builds the full chronological (oldest -> newest) list of normalized
  // status events from a trackShipment() response, for backfilling
  // webhook_data since Bigship has no webhook push in this API version.
  // tracking_histories comes back newest-first.
  normalizeTrackingHistory(trackingData: any, awb?: string) {
    const histories: any[] =
      trackingData?.tracking_histories ?? trackingData?.scan_histories ?? [];

    const waybill = String(awb ?? trackingData?.tracking_number ?? "");

    return [...histories].reverse().map((entry) =>
      this.normalizeStatusEvent(
        waybill,
        entry.order_status ?? entry.tag ?? entry.scan_status,
        entry.checkpoint_time ?? entry.scan_datetime,
        // Domestic checkpoints carry a place name; hyperlocal only sends
        // coordinates, which are not worth rendering as a location.
        entry.scan_location ?? entry.location_name ?? "",
        entry.message ?? entry.scan_remarks,
      ),
    );
  }
}

export default new BigshipService();
export { BigshipService };
