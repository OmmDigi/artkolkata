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
        product_info->>'id' AS product_id,
        -- what a combo line also puts in (or takes out of) the box. Read from
        -- the snapshot taken at checkout, never from the combo as it stands
        -- today: a cancellation has to give back exactly what the sale took,
        -- even if the combo has been edited since.
        COALESCE(variant_info->'bundle_items', product_info->'bundle_items', '[]'::jsonb) AS bundle_items
       FROM order_items WHERE ${
         orderid ? "order_id = $1" : "order_item_id = $1"
       }
      `,
    [orderid ?? orderitemid]
  );

  // Keyed and summed rather than collected into a list: the same product can
  // reach here several times — on its own line and inside two different combos
  // — and the UPDATE ... FROM (VALUES ...) below applies one row per id, so
  // duplicates would silently lose every copy but one.
  const productQuantityById = new Map<number, number>();
  const varientQuantityBySku = new Map<string, number>();
  const varientQuantityById = new Map<number, number>();

  const addTo = <K>(map: Map<K, number>, key: K, quantity: number) =>
    map.set(key, (map.get(key) ?? 0) + quantity);

  for (const item of rows) {
    const lineQuantity = Number(item.quantity);

    if (item.product_id != null) {
      addTo(productQuantityById, Number(item.product_id), lineQuantity);
    }

    if (item.variant_sku != null) {
      addTo(varientQuantityBySku, item.variant_sku as string, lineQuantity);
    }

    // one combo sold consumes `quantity` of each child, so the child moves by
    // its own quantity times however many combos the line was for
    for (const child of (item.bundle_items ?? []) as any[]) {
      const childQuantity = Number(child.quantity ?? 1) * lineQuantity;
      if (!Number.isFinite(childQuantity) || childQuantity <= 0) continue;

      if (child.variant_id != null) {
        // by id, not sku: a variant sku is optional, and the id is what the
        // combo was built against
        addTo(varientQuantityById, Number(child.variant_id), childQuantity);
        continue;
      }

      if (child.product_id != null) {
        addTo(productQuantityById, Number(child.product_id), childQuantity);
      }
    }
  }

  const sign = actiontype == "increase" ? "+" : "-";

  if (productQuantityById.size != 0) {
    const entries = [...productQuantityById.entries()];
    const valuesQuery = entries
      .map((_, i) => `($${i * 2 + 1}::int, $${i * 2 + 2}::int)`)
      .join(",");

    await pgClient.query(
      `
          UPDATE products AS p
            SET available_quantity = (p.available_quantity ${sign} v.available_quantity::int)
            FROM (
              VALUES
                ${valuesQuery}
            ) AS v(id, available_quantity)
          WHERE p.id = v.id::int;
          `,
      entries.flatMap(([id, quantity]) => [id, quantity])
    );
  }

  if (varientQuantityById.size != 0) {
    const entries = [...varientQuantityById.entries()];
    const valuesQuery = entries
      .map((_, i) => `($${i * 2 + 1}::int, $${i * 2 + 2}::int)`)
      .join(",");

    await pgClient.query(
      `
          UPDATE product_variants AS pv
            SET quantity = (pv.quantity ${sign} v.quantity::int)
            FROM (
              VALUES
                ${valuesQuery}
            ) AS v(id, quantity)
          WHERE pv.id = v.id::int;
          `,
      entries.flatMap(([id, quantity]) => [id, quantity])
    );
  }

  if (varientQuantityBySku.size != 0) {
    const entries = [...varientQuantityBySku.entries()];
    const valuesQuery = entries
      .map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2}::int)`)
      .join(",");

    await pgClient.query(
      `
          UPDATE product_variants AS pv
            SET quantity = (pv.quantity ${sign} v.quantity::int)
            FROM (
              VALUES
                ${valuesQuery}
            ) AS v(sku, quantity)
          WHERE pv.sku = v.sku;
          `,
      entries.flatMap(([sku, quantity]) => [sku, quantity])
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
