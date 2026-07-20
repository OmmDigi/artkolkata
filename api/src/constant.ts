export const COOKIE_KEY = "refreshToken";

export const GST_PERCENTAGE = 3;
export const SHIPPING_CHARGE_STATIC = 0;

export const RETURN_INITIATED = "RETURN INITIATED";
export const ORDER_PENDING = "PENDING";
export const ORDER_CONFIRMED = "CONFIRMED";
export const ORDER_PACKED = "PACKED";
export const ORDER_SHIPPED = "SHIPPED";
export const ORDER_DELIVERED = "DELIVERED";
export const ORDER_CANCELLED = "CANCELLED";
export const ORDER_RETURNED = "RETURNED";
export const ORDER_RETURN_INITIATED = RETURN_INITIATED;
// export const ORDER_RETURN_CANCELLED = "RETURN CANCELLED";
export const OUT_FOR_DELIVERY = "OUT FOR DELIVERY";
export const REPLACE_INITIATED = "REPLACE INITIATED";
export const REPLACED = "REPLACED";

export const REVIEW_STATUS_NOT_APPROVED = 1;
export const REVIEW_STATUS_APPROVED = 2;

export const ONLINE_PAYMENT = "ONLINE";
export const COD_PAYMENT = "COD";

// const statusMap = {
//   // Forward Shipment (UD)
//   "UD_Manifested": "order_placed",
//   "UD_Not Picked": "packed",
//   "UD_In Transit": "shipped",
//   "UD_Pending": "shipped",
//   "UD_Dispatched": "out_for_delivery",
//   "DL_Delivered": "delivered",

//   // Return Shipment (RT)
//   "RT_In Transit": "return_in_transit",
//   "RT_Pending": "return_in_transit",
//   "RT_Dispatched": "return_in_transit",
//   "DL_RTO": "returned_to_origin",

//   // Reverse Shipment (PP, PU)
//   "PP_Open": "return_initiated",
//   "PP_Scheduled": "return_initiated",
//   "PP_Dispatched": "return_in_transit",
//   "PU_In Transit": "return_in_transit",
//   "PU_Pending": "return_in_transit",
//   "PU_Dispatched": "return_in_transit",
//   "DL_DTO": "delivered",

//   // Cancelled
//   "CN_Canceled": "cancelled",
//   "CN_Closed": "cancelled",
// };

export const SHIPMENT_MAPING : Record<string, string> = {
  // Forward Shipment (UD)
  UD_Manifested: ORDER_CONFIRMED,
  "UD_Not Picked": ORDER_CONFIRMED,
  "UD_In Transit": ORDER_SHIPPED,
  UD_Pending: ORDER_SHIPPED,
  UD_Dispatched: OUT_FOR_DELIVERY,
  DL_Delivered: ORDER_DELIVERED,

  // Return Shipment (RT)
  "RT_In Transit": ORDER_CANCELLED,
  RT_Pending: ORDER_CANCELLED,
  RT_Dispatched: ORDER_CANCELLED,
  DL_RTO: ORDER_CANCELLED,

  // return maping
  PP_Open: ORDER_RETURN_INITIATED,
  PP_Scheduled: ORDER_RETURN_INITIATED,
  PP_Dispatched: ORDER_RETURN_INITIATED,
  "PU_In Transit": ORDER_RETURN_INITIATED,
  PU_Pending: ORDER_RETURN_INITIATED,
  PU_Dispatched: ORDER_RETURN_INITIATED,
  DL_DTO: ORDER_RETURNED,
  
  CN_Canceled: ORDER_CANCELLED,
  CN_Closed: ORDER_RETURNED,
};

// export const SHIPMENT_MAPING : Record<string, string> = {
//   UD_Manifested: ORDER_CONFIRMED,
//   "UD_Not Picked": ORDER_CONFIRMED,
//   "UD_In Transit": ORDER_SHIPPED,
//   UD_Pending: ORDER_SHIPPED,
//   UD_Dispatched: OUT_FOR_DELIVERY,
//   DL_Delivered: ORDER_DELIVERED,

//   // cancel maping
//   "RT_In Transit": ORDER_CANCELLED,
//   RT_Pending: ORDER_CANCELLED,
//   RT_Dispatched: ORDER_CANCELLED,
//   DL_RTO: ORDER_CANCELLED,

//   // return maping
//   PP_Open: ORDER_RETURN_INITIATED,
//   PP_Scheduled: ORDER_RETURN_INITIATED,
//   PP_Dispatched: ORDER_RETURN_INITIATED,
//   "PU_In Transit": ORDER_RETURN_INITIATED,
//   PU_Pending: ORDER_RETURN_INITIATED,
//   PU_Dispatched: ORDER_RETURN_INITIATED,
//   DL_DTO: ORDER_RETURN_INITIATED,
  
//   CN_Canceled: ORDER_CANCELLED,
//   CN_Closed: ORDER_RETURNED,
// };
