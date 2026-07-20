// delhiveryService.ts - Complete Delhivery API Service in TypeScript
import axios, { AxiosInstance, AxiosError } from "axios";
import { buildShipmentPayload } from "../utils/buildDelhiveryPayload";
import { Address, OrderInfo } from "../types";
import logger from "../utils/logger";

// ============================================================
// INTERFACES AND TYPES
// ============================================================

interface ServiceabilityData {
  pincode: string;
  city: string;
  state: string;
  cod_available: boolean;
  prepaid_available: boolean;
  pickup_available: boolean;
  repl_available: boolean;
}

interface ServiceabilityResponse {
  success: boolean;
  serviceable?: boolean;
  data?: ServiceabilityData;
  error?: any;
}

interface WarehouseData {
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country?: string;
  pincode: string;
  returnAddress?: string;
  returnPincode?: string;
  returnCity?: string;
  returnState?: string;
  returnCountry?: string;
}

interface WarehouseResponse {
  success: boolean;
  message?: string;
  warehouseName?: string;
  error?: any;
}

interface ShipmentData {
  // Customer details
  customerName: string;
  customerAddress: string;
  customerPincode: string;
  customerCity: string;
  customerState: string;
  customerPhone: string;
  customerEmail?: string;

  // Order details
  orderID: string;
  productDescription: string;
  quantity?: number;

  // Payment
  paymentMode: "Prepaid" | "COD";
  codAmount?: number;
  totalAmount?: number;

  // Package details
  // weight: number; // in kg
  // length: number; // in cm
  // breadth: number; // in cm
  // height: number; // in cm

  // Business details
  // pickupLocation?: string;
  // returnAddress?: string;
  // returnPincode?: string;
  // returnCity?: string;
  // returnState?: string;
  // sellerName?: string;
  sellerGSTIN?: string;

  // Optional
  shippingMode?: "Surface" | "Express";
  waybill?: string;
  invoiceNumber?: string;
  hsnCode?: string;
}

interface ShipmentResponse {
  success: boolean;
  waybill?: string;
  status?: string;
  rmk?: string;
  data?: any;
  error?: any;
}

interface PickupData {
  pickupLocation: string;
  pickupDate: string; // Format: YYYY-MM-DD
  pickupTime: string; // Format: HH:MM (24-hour)
  expectedPackageCount: number;
}

interface PickupResponse {
  success: boolean;
  pickupId?: string;
  message?: string;
  error?: any;
}

interface TrackingResponse {
  success: boolean;
  status?: string;
  currentLocation?: string;
  expectedDelivery?: string;
  scans?: any[];
  data?: any;
  error?: any;
}

interface CancelResponse {
  success: boolean;
  message?: string;
  data?: any;
  error?: any;
}

interface ReturnShipmentData {
  originalWaybill: string;
  originalOrderID: string;

  // Customer details (pickup from)
  customerName: string;
  customerAddress: string;
  customerPincode: string;
  customerCity: string;
  customerState: string;
  customerPhone: string;

  // Your warehouse (deliver to)
  // warehouseName: string;
  // warehouseAddress: string;
  // warehousePincode: string;
  // warehouseCity: string;
  // warehouseState: string;
  // warehousePhone: string;

  // Return details
  returnReason: string;
  productDescription: string;
  // weight?: number;
  // length?: number;
  // breadth?: number;
  // height?: number;
}

interface ReturnShipmentResponse {
  success: boolean;
  returnWaybill?: string;
  originalWaybill?: string;
  data?: any;
  error?: any;
  remarks?: any;
}

interface RateData {
  pickupPincode: string;
  deliveryPincode: string;
  weight: number;
  paymentMode?: "Prepaid" | "COD";
}

interface RateResponse {
  success: boolean;
  charges?: any;
  totalAmount?: number;
  error?: any;
}

// ============================================================
// DELHIVERY SERVICE CLASS
// ============================================================

class DelhiveryService {
  private baseURL: string;
  private token: string;
  private clientName: string;
  private api: AxiosInstance;
  private pickupLocation: string;

  private warehousePincode: string;
  private warehouseCity: string;
  private warehousePhone: string;
  private warehouseAddress: string;
  private warehouseState: string;
  private warehouseCountry: string;
  private sallerName: string;

  constructor() {
    this.baseURL =
      process.env.DELHIVERY_BASE_URL || "https://track.delhivery.com/api";
    this.token = process.env.DELHIVERY_API_TOKEN || "";
    this.clientName = process.env.DELHIVERY_CLIENT_NAME || "";
    this.pickupLocation = process.env.PICKUP_LOCATION || "";

    this.warehousePincode = process.env.WAREHOUSE_PINCODE ?? "";
    this.warehouseCity = process.env.WAREHOUSE_CITY ?? "";
    this.warehousePhone = process.env.WAREHOUSE_PHONE ?? "";
    this.warehouseAddress = process.env.WAREHOUSE_ADDRESS ?? "";
    this.warehouseState = process.env.WAREHOUSE_STATE ?? "";
    this.warehouseCountry = process.env.WAREHOUSE_COUNTRY ?? "";
    this.sallerName = process.env.SALLER_NAME ?? "";

    this.api = axios.create({
      baseURL: this.baseURL,
      headers: {
        Authorization: `Token ${this.token}`,
        "Content-Type": "application/json",
      },
    });
  }

  // ============================================================
  // STEP 1: CHECK SERVICEABILITY
  // ============================================================
  async checkServiceability(pincode: string): Promise<ServiceabilityResponse> {
    try {
      const response = await this.api.get("/c/api/pin-codes/json/", {
        params: { filter_codes: pincode },
      });

      const deliveryInfo = response.data.delivery_codes?.[0];

      return {
        success: true,
        serviceable: deliveryInfo?.postal_code?.pin == pincode,
        data: {
          pincode: deliveryInfo?.postal_code?.pin,
          city: deliveryInfo?.postal_code?.city,
          state: deliveryInfo?.postal_code?.state_code,
          cod_available: deliveryInfo?.cod === "Y",
          prepaid_available: deliveryInfo?.prepaid === "Y",
          pickup_available: deliveryInfo?.pickup === "Y",
          repl_available: deliveryInfo?.repl === "Y",
        },
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      return {
        success: false,
        error: axiosError.response?.data || axiosError.message,
      };
    }
  }

  // ============================================================
  // STEP 2: CREATE WAREHOUSE
  // ============================================================
  async createWarehouse(
    warehouseData: WarehouseData
  ): Promise<WarehouseResponse> {
    try {
      const data = {
        name: warehouseData.name,
        phone: warehouseData.phone,
        address: warehouseData.address,
        city: warehouseData.city,
        state: warehouseData.state,
        country: warehouseData.country || "India",
        pin: warehouseData.pincode,
        return_address: warehouseData.returnAddress || warehouseData.address,
        return_pin: warehouseData.returnPincode || warehouseData.pincode,
        return_city: warehouseData.returnCity || warehouseData.city,
        return_state: warehouseData.returnState || warehouseData.state,
        return_country: warehouseData.returnCountry || "India",
      };

      await this.api.post("/backend/clientwarehouse/create/", data);

      return {
        success: true,
        message: "Warehouse created successfully",
        warehouseName: warehouseData.name,
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      return {
        success: false,
        error: axiosError.response?.data || axiosError.message,
      };
    }
  }

  // ============================================================
  // STEP 3: CREATE SHIPMENT
  // ============================================================
  // shipmentData: ShipmentData
  async createShipment(
    customerAddress: Address,
    orderDetails: OrderInfo,
    paymentMode: "COD" | "ONLINE"
  ): Promise<ShipmentResponse> {
    try {
      // const {
      //   customerName,
      //   customerAddress,
      //   customerPincode,
      //   customerCity,
      //   customerState,
      //   customerPhone,
      //   customerEmail,
      //   orderID,
      //   productDescription,
      //   quantity = 1,
      //   paymentMode,
      //   codAmount = 0,
      //   totalAmount,
      //   // weight, length, breadth, height,
      //   // pickupLocation, returnAddress, returnPincode, returnCity,
      //   // returnState, sellerName,
      //   sellerGSTIN,
      //   shippingMode = "Surface",
      //   waybill = "",
      //   invoiceNumber = "",
      //   hsnCode = "",
      // } = shipmentData;

      // Calculate volumetric weight
      // const volumetricWeight = (length * breadth * height) / 5000;
      // const chargeableWeight = Math.max(weight, volumetricWeight);

      // const payload = {
      //   shipments: [
      //     {
      //       name: customerName,
      //       add: customerAddress,
      //       pin: customerPincode,
      //       city: customerCity,
      //       state: customerState,
      //       country: "India",
      //       phone: customerPhone,
      //       email: customerEmail || "",
      //       order: orderID,
      //       payment_mode: paymentMode,
      //       cod_amount: paymentMode === "COD" ? codAmount : 0,
      //       total_amount: totalAmount || codAmount,
      //       return_pin: this.warehousePincode,
      //       return_city: this.warehouseCity,
      //       return_phone: this.warehousePhone,
      //       return_add: this.warehouseAddress,
      //       return_state: this.warehouseState,
      //       return_country: this.warehouseCountry,
      //       products_desc: productDescription,
      //       hsn_code: hsnCode,
      //       quantity: quantity.toString(),
      //       order_date: new Date().toISOString(),
      //       seller_add: this.warehouseAddress,
      //       seller_name: this.sallerName,
      //       seller_inv: invoiceNumber,
      //       seller_gst_tin: sellerGSTIN,
      //       waybill: waybill,
      //       // shipment_width: breadth,
      //       // shipment_height: height,
      //       // weight: chargeableWeight,
      //       shipping_mode: shippingMode,
      //       address_type: "home",
      //     },
      //   ],
      //   pickup_location: {
      //     name: this.pickupLocation,
      //   },
      // };

      const payload = buildShipmentPayload(
        paymentMode == "COD" ? "COD" : "Prepaid",
        customerAddress,
        {
          address: {
            name: this.sallerName,
            phone: this.warehousePhone,
            add: this.warehouseAddress,
            city: this.warehouseCity,
            state: this.warehouseState,
            pin: this.warehousePincode,
            country: this.warehouseCountry,
          },
          name: this.pickupLocation,
        },
        orderDetails
      );

      const response = await this.api.post(
        "/api/cmu/create.json",
        `format=json&data=${JSON.stringify(payload)}`,
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }
      );

      const logPayload = {
        message: "Delhivery Shipment Creation Info",
        stack: response.data,
        payload
      };

      logger.error(logPayload);

      return {
        success: response.data.success,
        waybill: response.data.packages?.[0]?.waybill || response.data.waybill,
        status: response.data.packages?.[0]?.status,
        rmk: response.data.rmk,
        data: response.data,
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      return {
        success: false,
        error: axiosError.response?.data || axiosError.message,
      };
    }
  }

  // ============================================================
  // STEP 4: CREATE PICKUP REQUEST
  // ============================================================
  async createPickupRequest(pickupData: PickupData): Promise<PickupResponse> {
    try {
      const payload = {
        pickup_location: pickupData.pickupLocation,
        pickup_date: pickupData.pickupDate,
        pickup_time: pickupData.pickupTime,
        expected_package_count: pickupData.expectedPackageCount,
      };

      const response = await this.api.post("/fm/request/new/", payload);

      return {
        success: true,
        pickupId: response.data.pickup_id,
        message: "Pickup request created successfully",
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      return {
        success: false,
        error: axiosError.response?.data || axiosError.message,
      };
    }
  }

  // ============================================================
  // STEP 5: TRACK SHIPMENT
  // ============================================================
  async trackShipment(waybill: string): Promise<TrackingResponse> {
    try {
      const response = await this.api.get("/api/v1/packages/json/", {
        params: {
          waybill: waybill,
          // verbose: 3
        },
      });

      const shipment = response.data.ShipmentData?.[0]?.Shipment;

      return {
        success: true,
        status: shipment?.Status?.Status,
        currentLocation: shipment?.Status?.StatusLocation,
        expectedDelivery: shipment?.ExpectedDeliveryDate,
        scans: shipment?.Scans,
        // data: response.data
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      return {
        success: false,
        error: axiosError.response?.data || axiosError.message,
      };
    }
  }

  // ============================================================
  // STEP 6: CANCEL SHIPMENT
  // ============================================================
  async cancelShipment(waybill: string): Promise<CancelResponse> {
    try {
      const response = await this.api.post(
        "/api/p/edit",
        `waybill=${waybill}&cancellation=true`,
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }
      );

      const logPayload = {
        message: "Delhivery Shipment Cancel Info",
        stack: response.data,
      };

      logger.error(logPayload);

      return {
        success: response.data.status,
        message: response.data.remark,
        data: response.data,
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      return {
        success: false,
        error: axiosError.response?.data || axiosError.message,
      };
    }
  }

  // ============================================================
  // STEP 7: CREATE RETURN SHIPMENT
  // ============================================================
  async createReturnShipment(
    customerAddress: Address,
    orderDetails: OrderInfo,
    actionType: "Return" | "Replacement"
  ): Promise<ReturnShipmentResponse> {
    try {
      const payload = buildShipmentPayload(
        actionType === "Return" ? "Pickup" : "REPL",
        customerAddress,
        {
          address: {
            name: this.sallerName,
            phone: this.warehousePhone,
            add: this.warehouseAddress,
            city: this.warehouseCity,
            state: this.warehouseState,
            pin: this.warehousePincode,
            country: this.warehouseCountry,
          },
          name: this.pickupLocation,
        },
        orderDetails
      );

      const response = await this.api.post(
        "/api/cmu/create.json",
        `format=json&data=${JSON.stringify(payload)}`,
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }
      );

      const logPayload = {
        message: "Delhivery Return Shipment Details",
        stack: response.data,
        payload
      };

      logger.error(logPayload);

      return {
        success: response.data.success,
        returnWaybill: response.data.packages?.[0]?.waybill,
        data: response.data,
        remarks: response.data.packages?.[0].remarks,
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      return {
        success: false,
        error: axiosError.response?.data || axiosError.message,
      };
    }
  }

  // ============================================================
  // BONUS: GET SHIPPING RATES
  // ============================================================
  async getShippingRates(rateData: RateData): Promise<RateResponse> {
    try {
      const {
        pickupPincode,
        deliveryPincode,
        weight,
        paymentMode = "Prepaid",
      } = rateData;

      const response = await this.api.get("/kinko/v1/invoice/charges/.json", {
        params: {
          md: paymentMode === "COD" ? "E" : "S",
          ss: "Delivered",
          d_pin: deliveryPincode,
          o_pin: pickupPincode,
          cgm: weight,
          pt: paymentMode === "COD" ? "COD" : "Pre-paid",
        },
      });

      return {
        success: true,
        charges: response.data[0],
        totalAmount: response.data[0]?.total_amount,
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      return {
        success: false,
        error: axiosError.response?.data || axiosError.message,
      };
    }
  }
}

// Export singleton instance
export default new DelhiveryService();

// Also export the class and types for flexibility
export { DelhiveryService };
export type {
  ServiceabilityData,
  ServiceabilityResponse,
  WarehouseData,
  WarehouseResponse,
  ShipmentData,
  ShipmentResponse,
  PickupData,
  PickupResponse,
  TrackingResponse,
  CancelResponse,
  ReturnShipmentData,
  ReturnShipmentResponse,
  RateData,
  RateResponse,
};
