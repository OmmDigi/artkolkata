import { PoolClient } from "pg";
import { pool } from "..";
import {
  ORDER_CANCELLED,
  ORDER_CONFIRMED,
  ORDER_DELIVERED,
  ORDER_PACKED,
  ORDER_PENDING,
  ORDER_RETURNED,
  ORDER_SHIPPED,
} from "../constant";
import { sendEmail } from "./sendEmail";
import DelhiveryService, { ShipmentData } from "../services/delhiveryService";
import { ErrorHandler } from "./ErrorHandler";
import logger from "./logger";

interface IProps {
  orderid?: number;
  order_status: string;
  client: PoolClient;
  orderitemid?: number;
}

interface IManageQuantityProps {
  orderid?: number;
  orderitemid?: number;
  actiontype: "decrease" | "increase";
  client: PoolClient;
}

const manageQuantity = async ({
  actiontype,
  orderid,
  client,
  orderitemid,
}: IManageQuantityProps) => {
  if (!orderid && !orderitemid)
    throw new Error("need order id or order item id to manage stock");

  const pgClient = client;
  const { rows } = await pgClient.query(
    `
       SELECT
        quantity,
        variant_info->>'id' AS variant_id,
        product_info->>'id' AS product_id
       FROM order_items WHERE ${
         orderid ? "order_id = $1" : "order_item_id = $1"
       }
      `,
    [orderid ?? orderitemid]
  );

  const productIdAndQuantity: { id: number; quantity: number }[] = [];
  const varientIdAndQuantity: { id: number; quantity: number }[] = [];
  for (const item of rows) {
    if (item.product_id != null) {
      productIdAndQuantity.push({
        id: item.product_id,
        quantity: item.quantity,
      });
    }
    if (item.variant_id != null) {
      varientIdAndQuantity.push({
        id: item.variant_id,
        quantity: item.quantity,
      });
    }
  }

  if (productIdAndQuantity.length != 0) {
    const valuesQuery = productIdAndQuantity
      .map((_, i) => `($${i * 2 + 1}::int, $${i * 2 + 2}::int)`)
      .join(",");

    await pgClient.query(
      `
          UPDATE products AS p
            SET available_quantity = (p.available_quantity ${
              actiontype == "increase" ? "+" : "-"
            } v.available_quantity::int)
            FROM (
              VALUES
                ${valuesQuery}
            ) AS v(id, available_quantity)
          WHERE p.id = v.id::int;
          `,
      productIdAndQuantity.flatMap((item) => [item.id, item.quantity])
    );
  }

  if (varientIdAndQuantity.length != 0) {
    const valuesQuery = varientIdAndQuantity
      .map((_, i) => `($${i * 2 + 1}::int, $${i * 2 + 2}::int)`)
      .join(",");

    await pgClient.query(
      `
          UPDATE product_variants AS pv
            SET quantity = (pv.quantity ${
              actiontype == "increase" ? "+" : "-"
            } v.quantity::int)
            FROM (
              VALUES
                ${valuesQuery}
            ) AS v(id, quantity)
          WHERE pv.id = v.id::int;
          `,
      varientIdAndQuantity.flatMap((item) => [item.id, item.quantity])
    );
  }

  if (orderid) {
    await pgClient.query(
      "UPDATE orders SET stock_decreased = $1 WHERE order_id = $2",
      [actiontype === "increase" ? "false" : "true", orderid]
    );

    await pgClient.query(
      "UPDATE order_items SET stock_decreased = $1 WHERE order_id = $2",
      [actiontype === "increase" ? "false" : "true", orderid]
    );
  } else {
    await pgClient.query(
      "UPDATE order_items SET stock_decreased = $1 WHERE order_item_id = $2",
      [actiontype === "increase" ? "false" : "true", orderitemid]
    );
  }
};

export const manageStock = async ({
  order_status,
  orderid,
  client,
  orderitemid,
}: IProps) => {
  const pgClient = client ?? pool;

  let isStockeDecreased: boolean | undefined = undefined;

  if (orderid) {
    const orderinfo = await pgClient.query(
      "SELECT stock_decreased FROM orders WHERE order_id = $1",
      [orderid]
    );

    isStockeDecreased = orderinfo.rows[0].stock_decreased as boolean;
  } else if (orderitemid) {
    const orderiteminfo = await pgClient.query(
      "SELECT stock_decreased FROM order_items WHERE order_item_id = $1",
      [orderitemid]
    );

    isStockeDecreased = orderiteminfo.rows[0].stock_decreased as boolean;
  }

  if (isStockeDecreased == undefined)
    throw new Error("Unable to get stock_decreased status");

  // if status is confirmed or packed  or shipped or delivered and the stock_decreased == false than minius the quantity
  // else if stock_decreased = true only than stock will increase
  if (
    (order_status == ORDER_CONFIRMED ||
      order_status == ORDER_PACKED ||
      order_status == ORDER_SHIPPED ||
      order_status == ORDER_DELIVERED) &&
    isStockeDecreased == false
  ) {
    await manageQuantity({
      actiontype: "decrease",
      orderid: orderid,
      client,
      orderitemid,
    });

    if (order_status == ORDER_CONFIRMED) {
      const { rows, rowCount } = await pgClient.query(
        `
          SELECT
           u.name,
           o.order_number,
           TO_CHAR(o.created_at, 'DD Mon YYYY') AS order_date,
           u.email,
           o.total_amount,
           o.payment_method,
           STRING_AGG(
            CASE
             WHEN oi.variant_info IS NOT NULL
             THEN oi.variant_info->>'product_name'
             ELSE oi.product_info->>'name'
            END,
            ', '
           ) AS items,
           JSON_BUILD_OBJECT(
            'name', a.name,
            'address_line1', a.address_line1,
            'pincode', a.pincode,
            'city', a.city,
            'state', a.state,
            'phone', a.phone,
            'email', a.email
           ) AS shipping_details
          FROM orders o

          LEFT JOIN users u
          ON u.id = o.user_id

          LEFT JOIN order_items oi
          ON oi.order_id = o.order_id

          LEFT JOIN addresses a
          ON a.address_id = o.shipping_address_id

          WHERE ${
            orderid
              ? "o.order_id = $1 AND o.waybill IS NULL"
              : "oi.order_item_id = $1 AND oi.waybill IS NULL"
          }
 
          GROUP BY u.id, o.order_id, a.address_id
        `,
        [orderid ?? orderitemid]
      );

      if (rowCount != 0) {
        // do the shipment craction process
        const value = rows[0];
        if (!value.shipping_details.name) {
          throw new ErrorHandler(500, "Unable to fetch shipment address details");
        }

        // const orderData: ShipmentData = {
        //   customerName: value.shipping_details[0].name,
        //   customerAddress: value.shipping_details[0].address_line1,
        //   customerPincode: value.shipping_details[0].pincode,
        //   customerCity: value.shipping_details[0].city,
        //   customerState: value.shipping_details[0].state,
        //   customerPhone: value.shipping_details[0].phone,
        //   customerEmail: value.shipping_details[0].email,

        //   orderID: value.order_number,
        //   productDescription: value.items,
        //   quantity: value.items.split(",").length,

        //   paymentMode: value.payment_method == "ONLINE" ? "Prepaid" : "COD", // or "Prepaid"
        //   totalAmount: value.total_amount,

        //   // weight: 0.2, // kg
        //   // length: 20,
        //   // breadth: 15,
        //   // height: 5,
        // };

        // if (value.payment_method != "ONLINE") {
        //   orderData.codAmount = value.total_amount;
        // }

        // # THIS IS FOR DELHIVERY PATNER
        // const shipment = await DelhiveryService.createShipment(
        //   {
        //     name: value.shipping_details[0].name,
        //     add: value.shipping_details[0].address_line1,
        //     city: value.shipping_details[0].city,
        //     country: "India",
        //     phone: value.shipping_details[0].phone,
        //     pin: value.shipping_details[0].pincode,
        //     state: value.shipping_details[0].state,
        //   },
        //   {
        //     orderId: value.order_number,
        //     productDescription: value.items,
        //     quantity: value.items.split(",").length,
        //     totalAmount: value.total_amount,
        //     weight: 0.2,
        //   },
        //   value.payment_method
        // );
        
        // if (!shipment.success) {
        //   throw new ErrorHandler(
        //     500,
        //     "Unable to process shipment creation please try again"
        //   );
        // }

        // if (orderitemid) {
        //   await pgClient.query(
        //     "UPDATE order_items SET waybill = $1 WHERE order_item_id = $2",
        //     [shipment.waybill, orderitemid]
        //   );
        // } else {
        //   await pgClient.query(
        //     "UPDATE orders SET waybill = $1 WHERE order_id = $2",
        //     [shipment.waybill, orderid]
        //   );
        //   await pgClient.query(
        //     "UPDATE order_items SET waybill = $1 WHERE order_id = $2",
        //     [shipment.waybill, orderid]
        //   );
        // }

        sendEmail(value.shipping_details.email, "ORDER_CONFIRMED_EMAIL", {
          customerName: value.shipping_details.name,
          orderId: rows[0].order_number,
          orderDate: rows[0].order_date,
          customerEmail: value.shipping_details.email,
          totalAmount: rows[0].total_amount,
          items: rows[0].items,
          orderLink: `${process.env.FRONTEND_HOST_URL}/myaccount/orders`,
        });
      }
    }
  } else if (
    (order_status == ORDER_CANCELLED ||
      order_status == ORDER_RETURNED ||
      order_status == ORDER_PENDING) &&
    isStockeDecreased == true
  ) {
    await manageQuantity({
      actiontype: "increase",
      orderid: orderid,
      client,
      orderitemid,
    });
  }
};
