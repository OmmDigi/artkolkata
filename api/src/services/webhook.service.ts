import { pool } from "..";
import {
  COURIER_PROTECTED_STATUSES,
  ORDER_DELIVERED,
  SHIPMENT_MAPING,
} from "../constant";
import { doTransition } from "../utils/doTransition";
import { manageStock } from "../utils/manageStock";
import { notifyOrderStatus } from "../utils/orderEmails";
import { eventTimestamp } from "./orderTracking.service";
import { getShippingPartner, isShippingEnabled } from "./shipping";
import { CACHE_TAGS, invalidateCache } from "./cache.service";

export interface IProps {
  Shipment: {
    Status: {
      Status: string;
      StatusDateTime: string;
      StatusType: string;
      StatusLocation: string;
      Instructions: string;
    };
    PickUpDate: string;
    NSLCode: string;
    Sortcode: string;
    ReferenceNo: string;
    AWB: string;
  };
}

export const processDelhiveryStatus = async (props: IProps) => {
  // Same reason as the Shiprocket handler below: a webhook that outlives the
  // integration must not move an order nobody booked.
  if (!isShippingEnabled()) {
    console.error("Delhivery webhook ignored — no shipping partner configured");
    return;
  }

  // some how store it first

  if (!props?.Shipment?.AWB) {
    console.error("No data to process delhivery webhook");
    return;
  }

  try {
    await pool.query(
      `
       INSERT INTO webhook_data (waybill, source, order_status, event_at, payload)
       VALUES ($1, 'courier', $2, $3, $4)
      `,
      [
        props.Shipment.AWB,
        // Mapped once, here. NULL for a scan nothing maps : the row is still
        // worth keeping, it just has no step on the tracking page.
        SHIPMENT_MAPING[
          `${props.Shipment.Status.StatusType}_${props.Shipment.Status.Status}`
        ] ?? null,
        eventTimestamp(props.Shipment.Status.StatusDateTime),
        props,
      ]
    );
  } catch (error) {
    console.error("Unable to insert webhook data in the database : ", error);
    return;
  }

  // now update the status of the order
  const STATUS =
    SHIPMENT_MAPING[
      `${props.Shipment.Status.StatusType}_${props.Shipment.Status.Status}`
    ];

  // Set inside the transaction, read after it commits: the customer's email is
  // sent from out here so a slow mail server cannot hold the transaction open,
  // and so nothing is sent for a scan the transaction then rolled back.
  let movedOrderId: number | null = null;

  try {
    await doTransition(async (client) => {
      // get the order id or order item id using the aws or waybill number
      const { rows, rowCount } = await client.query(
        `
         SELECT
          o.order_id,
          o.order_status
         FROM orders o

         LEFT JOIN order_returns AS ors
         ON ors.order_id = o.order_id

         WHERE o.waybill = $1
            OR ors.waybill = $1
            OR ors.replacement_waybill = $1
        `,
        [props.Shipment.AWB]
      )

      if (rowCount == 0) {
        throw new Error(
          `404 Not found the waybill number in order_items table "${props.Shipment.AWB}"`
        );
      }

      const orderid = rows[0].order_id;

      // A cancelled or returned order is not moved by a courier scan — see
      // COURIER_PROTECTED_STATUSES.
      if (COURIER_PROTECTED_STATUSES.includes(rows[0].order_status)) return;

      movedOrderId = orderid;

      await manageStock({
        order_status: STATUS,
        orderid: orderid,
        client
      });

      await client.query(
        `
         UPDATE orders
         SET order_status = $1::varchar,
             delivered_at = CASE
               WHEN $1::varchar = '${ORDER_DELIVERED}' AND delivered_at IS NULL
               THEN CURRENT_TIMESTAMP
               ELSE delivered_at
             END,
             updated_at = CURRENT_TIMESTAMP
         WHERE order_id = $2
        `,
        [STATUS, orderid]
      );

      await client.query(
        "UPDATE order_items SET status = $1 WHERE order_id = $2",
        [STATUS, orderid]
      );
    });

    // stock changed with the status, so the cached product responses that
    // carry variant quantities have to go. After the commit, never inside it.
    await invalidateCache(CACHE_TAGS.PRODUCTS);

    // Shiprocket and Delhivery both re-push their whole scan history, so this
    // runs on every repeat of the same status. order_email_log is what makes
    // the customer see one email rather than one per push.
    if (movedOrderId) await notifyOrderStatus(movedOrderId, STATUS);

  } catch (error) {
    console.error("Unable to process the webhook request");
  }
};

// ============================================================
// SHIPROCKET TRACKING WEBHOOK
//
// Shiprocket pushes the whole scan history on every status change, not just
// the new scan, so the AWB's rows are replaced wholesale rather than appended
// to — a redelivered webhook would otherwise duplicate every earlier event.
// The events are already translated into the Delhivery shape by the service,
// so everything downstream (webhook_data, SHIPMENT_MAPING, the trackOrder
// query) works unchanged.
// ============================================================
export const processShiprocketStatus = async (payload: any) => {
  // The webhook URL stays registered at Shiprocket after SHIPPING_PARTNER is
  // switched to none, so a late push can still land here. Nothing this side
  // booked the parcel, so nothing this side should move an order because of it.
  if (!isShippingEnabled()) {
    console.error("Shiprocket webhook ignored — no shipping partner configured");
    return;
  }

  const awb = String(payload?.awb ?? "");

  if (!awb) {
    console.error("No AWB in the Shiprocket webhook payload");
    return;
  }

  const events = getShippingPartner().normalizeWebhookEvents(payload);

  if (events.length === 0) {
    console.error(`No usable scan in the Shiprocket webhook for AWB "${awb}"`);
    return;
  }

  try {
    // Courier rows only : the scans written from this order's own status
    // changes are not Shiprocket's to replace — see
    // services/orderTracking.service.
    await pool.query(
      "DELETE FROM webhook_data WHERE waybill = $1 AND source = 'courier'",
      [awb],
    );

    for (const event of events) {
      await pool.query(
        `
         INSERT INTO webhook_data (waybill, source, order_status, event_at, payload)
         VALUES ($1, 'courier', $2, $3, $4)
        `,
        [
          awb,
          SHIPMENT_MAPING[
            `${event.Shipment.Status.StatusType}_${event.Shipment.Status.Status}`
          ] ?? null,
          eventTimestamp(event.Shipment.Status.StatusDateTime),
          event,
        ],
      );
    }
  } catch (error) {
    console.error("Unable to insert webhook data in the database : ", error);
    return;
  }

  // The newest event drives the order's actual status.
  const latest = events[events.length - 1];
  const STATUS =
    SHIPMENT_MAPING[
      `${latest.Shipment.Status.StatusType}_${latest.Shipment.Status.Status}`
    ];

  // A status we do not map — a courier-specific scan, say — is still worth
  // storing for the tracking page, it just does not move the order along.
  if (!STATUS) return;

  // Same as above: captured inside the transaction, emailed after it commits.
  let movedOrderId: number | null = null;

  try {
    await doTransition(async (client) => {
      const { rows, rowCount } = await client.query(
        `
         SELECT
          o.order_id,
          o.order_status
         FROM orders o

         LEFT JOIN order_returns AS ors
         ON ors.order_id = o.order_id

         WHERE o.waybill = $1
            OR ors.waybill = $1
            OR ors.replacement_waybill = $1
        `,
        [awb],
      );

      if (rowCount == 0) {
        throw new Error(
          `404 Not found the waybill number in the orders table "${awb}"`,
        );
      }

      const orderid = rows[0].order_id;

      // A cancelled or returned order is not moved by a courier scan — see
      // COURIER_PROTECTED_STATUSES.
      if (COURIER_PROTECTED_STATUSES.includes(rows[0].order_status)) return;

      movedOrderId = orderid;

      await manageStock({ order_status: STATUS, orderid, client });

      await client.query(
        `
         UPDATE orders
         SET order_status = $1::varchar,
             delivered_at = CASE
               WHEN $1::varchar = '${ORDER_DELIVERED}' AND delivered_at IS NULL
               THEN CURRENT_TIMESTAMP
               ELSE delivered_at
             END,
             updated_at = CURRENT_TIMESTAMP
         WHERE order_id = $2
        `,
        [STATUS, orderid],
      );

      await client.query(
        "UPDATE order_items SET status = $1 WHERE order_id = $2",
        [STATUS, orderid],
      );
    });

    // see above : same reason, same ordering
    await invalidateCache(CACHE_TAGS.PRODUCTS);

    if (movedOrderId) await notifyOrderStatus(movedOrderId, STATUS);
  } catch (error) {
    console.error("Unable to process the Shiprocket webhook request : ", error);
  }
};
