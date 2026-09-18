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
        variant_info->>'sku' AS variant_sku,
        product_info->>'id' AS product_id
       FROM order_items WHERE ${
         orderid ? "order_id = $1" : "order_item_id = $1"
       }
      `,
    [orderid ?? orderitemid]
  );

  const productIdAndQuantity: { id: number; quantity: number }[] = [];
  // const varientIdAndQuantity: { id: number; quantity: number }[] = [];
  const varientSkuAndQuantity : {sku : string, quantity: number}[] = [];

  for (const item of rows) {
    if (item.product_id != null) {
      productIdAndQuantity.push({
        id: item.product_id,
        quantity: item.quantity,
      });
    }
    // if (item.variant_id != null) {
    //   varientIdAndQuantity.push({
    //     id: item.variant_id,
    //     quantity: item.quantity,
    //   });
    // }

    if (item.variant_sku != null) {
      varientSkuAndQuantity.push({
        sku : item.variant_sku,
        quantity : item.quantity
      })
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

  // if (varientIdAndQuantity.length != 0) {
  //   const valuesQuery = varientIdAndQuantity
  //     .map((_, i) => `($${i * 2 + 1}::int, $${i * 2 + 2}::int)`)
  //     .join(",");

  //   await pgClient.query(
  //     `
  //         UPDATE product_variants AS pv
  //           SET quantity = (pv.quantity ${
  //             actiontype == "increase" ? "+" : "-"
  //           } v.quantity::int)
  //           FROM (
  //             VALUES
  //               ${valuesQuery}
  //           ) AS v(id, quantity)
  //         WHERE pv.id = v.id::int;
  //         `,
  //     varientIdAndQuantity.flatMap((item) => [item.id, item.quantity])
  //   );
  // }

  if (varientSkuAndQuantity.length != 0) {
    const valuesQuery = varientSkuAndQuantity
      .map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2}::int)`)
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
            ) AS v(sku, quantity)
          WHERE pv.sku = v.sku;
          `,
      varientSkuAndQuantity.flatMap((item) => [item.sku, item.quantity])
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

    // The customer's "order confirmed" email used to be assembled and sent from
    // right here, which tied it to the stock decrease: it only went out on the
    // transition that first reduced stock. Shipped, out for delivery and
    // delivered have no such moment, so all four now go through
    // notifyOrderStatus, called after the commit by whoever wrote the status,
    // and order_email_log — not a stock flag — is what keeps each to one send.
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
