import { Address, OrderInfo, PaymentMode, WarehouseInfo } from "../types";

export function buildShipmentPayload(
  paymentMode: PaymentMode,
  customer: Address,
  warehouse: WarehouseInfo,
  order: OrderInfo
) {
  const isReturn = paymentMode === "Pickup"; // Reverse Pickup
  const isRepl = paymentMode === "REPL"; // Replacement

  return {
    shipments: [
      {
        // customer (ALWAYS shipment consignee)
        name: customer.name,
        add: customer.add,
        pin: customer.pin,
        city: customer.city,
        state: customer.state,
        country: customer.country,
        phone: customer.phone,

        // unique order id
        order: order.orderId,
        payment_mode: paymentMode,

        // Return location = warehouse (for return and replacement)
        return_pin: warehouse.address.pin,
        return_city: warehouse.address.city,
        return_phone: warehouse.address.phone,
        return_add: warehouse.address.add,
        return_state: warehouse.address.state,
        return_country: warehouse.address.country,

        // product details
        products_desc: order.productDescription,
        hsn_code: order.hsnCode || "",
        cod_amount: paymentMode === "COD" ? order.totalAmount : "",
        order_date: new Date().toISOString(),
        total_amount: order.totalAmount,
        seller_add: warehouse.address.add,
        seller_name: warehouse.address.name,
        seller_inv: "",
        quantity: order.quantity,
        waybill: order.waybill ?? "", // let Delhivery generate automatically
        // shipment_width: "20",
        // shipment_height: "10",
        shipment_width: "",
        shipment_height: "",
        // weight: order.weight.toString(),
        weight: "",
        shipping_mode: "Surface",
        address_type: "home",
      },
    ],

    // pickup_location: Warehouse name (must match EXACT)
    pickup_location: {
      name: warehouse.name,
    },
  };
}
