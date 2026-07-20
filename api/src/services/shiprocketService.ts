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
  shiprocketOrderId?: number;
  shipmentId?: number;
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

export interface ShiprocketOrderItem {
  name: string;
  sku: string;
  units: number;
  sellingPrice: number;
}

export interface ShiprocketCreateOrderParams {
  orderNumber: string;
  orderDate: string; // YYYY-MM-DD
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  customerCity: string;
  customerState: string;
  customerPincode: string;
  customerCountry: string;
  paymentMethod: "COD" | "ONLINE";
  subTotal: number;
  items: ShiprocketOrderItem[];
  weight?: number;
  length?: number;
  breadth?: number;
  height?: number;
}

// ============================================================
// STATUS MAP — Shiprocket current_status → Delhivery-format
// ============================================================

const SHIPROCKET_TO_DELHIVERY: Record<string, { statusType: string; status: string }> = {
  "Pickup Scheduled":   { statusType: "UD", status: "Manifested" },
  "Pickup Generated":   { statusType: "UD", status: "Manifested" },
  "Pickup Queued":      { statusType: "UD", status: "Manifested" },
  "Pickup Error":       { statusType: "UD", status: "Not Picked" },
  Shipped:              { statusType: "UD", status: "In Transit" },
  "In Transit":         { statusType: "UD", status: "In Transit" },
  "Out For Delivery":   { statusType: "UD", status: "Dispatched" },
  Delivered:            { statusType: "DL", status: "Delivered" },
  Cancelled:            { statusType: "CN", status: "Canceled" },
  "RTO Initiated":      { statusType: "RT", status: "In Transit" },
  "RTO Delivered":      { statusType: "DL", status: "RTO" },
};

// ============================================================
// SERVICE CLASS
// ============================================================

class ShiprocketService {
  private baseURL: string;
  private email: string;
  private password: string;
  private warehousePincode: string;
  private pickupLocationName: string;
  private cachedToken: CachedToken | null = null;
  private api: AxiosInstance;

  constructor() {
    this.baseURL =
      process.env.SHIPROCKET_BASE_URL || "https://apiv2.shiprocket.in/v1/external";
    this.email = process.env.SHIPROCKET_EMAIL || "";
    this.password = process.env.SHIPROCKET_PASSWORD || "";
    this.warehousePincode = process.env.WAREHOUSE_PINCODE || "";
    this.pickupLocationName = process.env.SHIPROCKET_PICKUP_LOCATION || "Primary";

    this.api = axios.create({ baseURL: this.baseURL });
  }

  // ============================================================
  // AUTH — token cached for 10 days, refreshed 1 hr before expiry
  // ============================================================
  private async getToken(): Promise<string> {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    if (this.cachedToken && this.cachedToken.expiresAt > now + oneHour) {
      return this.cachedToken.token;
    }

    const response = await this.api.post("/auth/login", {
      email: this.email,
      password: this.password,
    });

    const token: string = response.data.token;
    this.cachedToken = { token, expiresAt: now + 10 * 24 * 60 * 60 * 1000 };
    return token;
  }

  private async authHeaders() {
    const token = await this.getToken();
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  // ============================================================
  // CHECK SERVICEABILITY + SHIPPING RATE
  // ============================================================
  async checkServiceability(
    deliveryPincode: string,
    weight = 0.5,
    codRequired = false,
  ): Promise<ServiceabilityResult> {
    try {
      const headers = await this.authHeaders();
      const response = await this.api.get("/courier/serviceability/", {
        headers,
        params: {
          pickup_postcode: this.warehousePincode,
          delivery_postcode: deliveryPincode,
          weight,
          cod: codRequired ? 1 : 0,
        },
      });

      const data = response.data;

      if (data.status !== 200) {
        return { success: true, serviceable: false };
      }

      const couriers: any[] = data.data?.available_courier_companies ?? [];

      if (couriers.length === 0) {
        return { success: true, serviceable: false };
      }

      // Pick cheapest available courier
      const cheapest = couriers.sort((a, b) => a.rate - b.rate)[0];

      return {
        success: true,
        serviceable: true,
        shippingCharge: Math.ceil(cheapest.rate),
        courierId: cheapest.courier_company_id,
        courierName: cheapest.courier_name,
        codAvailable: cheapest.cod === 1,
        estimatedDays: cheapest.estimated_delivery_days,
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      logger.error({
        message: "Shiprocket serviceability error",
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
  // CREATE ORDER
  // ============================================================
  async createOrder(params: ShiprocketCreateOrderParams): Promise<CreateOrderResult> {
    try {
      const headers = await this.authHeaders();

      const payload = {
        order_id: params.orderNumber,
        order_date: params.orderDate,
        pickup_location: this.pickupLocationName,
        billing_customer_name: params.customerName,
        billing_last_name: "",
        billing_address: params.customerAddress,
        billing_address_2: "",
        billing_isd_code: "91",
        billing_city: params.customerCity,
        billing_pincode: params.customerPincode,
        billing_state: params.customerState,
        billing_country: params.customerCountry || "India",
        billing_email: params.customerEmail,
        billing_phone: params.customerPhone,
        shipping_is_billing: true,
        order_items: params.items.map((item) => ({
          name: item.name,
          sku: item.sku || item.name.replace(/\s+/g, "-").toLowerCase(),
          units: item.units,
          selling_price: item.sellingPrice,
          discount: 0,
          tax: 0,
          hsn: "",
        })),
        payment_method: params.paymentMethod === "COD" ? "COD" : "Prepaid",
        shipping_charges: 0,
        giftwrap_charges: 0,
        transaction_charges: 0,
        total_discount: 0,
        sub_total: params.subTotal,
        length: params.length ?? 10,
        breadth: params.breadth ?? 10,
        height: params.height ?? 10,
        weight: params.weight ?? 0.5,
      };

      const response = await this.api.post("/orders/create/adhoc", payload, { headers });

      logger.info({ message: "Shiprocket order created", data: response.data });

      return {
        success: true,
        shiprocketOrderId: response.data.order_id,
        shipmentId: response.data.shipment_id,
        awbCode: response.data.awb_code || null,
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      logger.error({
        message: "Shiprocket create order error",
        error: axiosError.response?.data ?? axiosError.message,
      });
      return {
        success: false,
        error: axiosError.response?.data ?? axiosError.message,
      };
    }
  }

  // ============================================================
  // CANCEL ORDER
  // ============================================================
  async cancelOrder(shiprocketOrderIds: number[]): Promise<CancelOrderResult> {
    try {
      const headers = await this.authHeaders();
      const response = await this.api.post(
        "/orders/cancel",
        { ids: shiprocketOrderIds },
        { headers },
      );
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
  // TRACK SHIPMENT
  // ============================================================
  async trackShipment(shipmentId: number): Promise<TrackShipmentResult> {
    try {
      const headers = await this.authHeaders();
      const response = await this.api.get(
        `/courier/track/shipment/${shipmentId}`,
        { headers },
      );
      return { success: true, trackingData: response.data };
    } catch (error) {
      const axiosError = error as AxiosError;
      return {
        success: false,
        error: axiosError.response?.data ?? axiosError.message,
      };
    }
  }

  // ============================================================
  // NORMALIZE WEBHOOK — converts Shiprocket payload to the same
  // Delhivery-shaped object that webhook_data table + trackOrder
  // query already understands, so no query changes needed.
  // ============================================================
  normalizeWebhookPayload(payload: any) {
    const currentStatus: string = payload.current_status ?? "";
    const mapped = SHIPROCKET_TO_DELHIVERY[currentStatus] ?? {
      statusType: "IT",
      status: currentStatus,
    };

    return {
      Shipment: {
        AWB: payload.awb,
        Status: {
          Status: mapped.status,
          StatusType: mapped.statusType,
          StatusDateTime: payload.activity_datetime
            ? new Date(payload.activity_datetime).toISOString()
            : new Date().toISOString(),
          StatusLocation: payload.location ?? "",
          Instructions: payload.remark ?? "",
        },
      },
    };
  }
}

export default new ShiprocketService();
export { ShiprocketService };
