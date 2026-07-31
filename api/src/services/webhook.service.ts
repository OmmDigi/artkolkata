import { pool } from "..";
import { SHIPMENT_MAPING } from "../constant";
import { doTransition } from "../utils/doTransition";
import { manageStock } from "../utils/manageStock";

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
  // some how store it first

  if (!props?.Shipment?.AWB) {
    console.error("No data to process delhivery webhook");
    return;
  }

  try {
    await pool.query(
      "INSERT INTO webhook_data (waybill, payload) VALUES ($1, $2)",
      [props.Shipment.AWB, props]
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

  try {
    await doTransition(async (client) => {
      // get the order id or order item id using the aws or waybill number
      const { rows, rowCount } = await client.query(
        `
         SELECT
          order_id
         FROM orders o

         LEFT JOIN order_returns AS ors
         ON ors.order_id = o.order_id

         WHERE o.waybill = $1 OR ors.waybill = $1
        `,
        [props.Shipment.AWB]
      )

      if (rowCount == 0) {
        throw new Error(
          `404 Not found the waybill number in order_items table "${props.Shipment.AWB}"`
        );
      }

      const orderid = rows[0].order_id;

      await manageStock({
        order_status: STATUS,
        orderid: orderid,
        client
      });

      await client.query(
        "UPDATE orders SET order_status = $1, updated_at = CURRENT_TIMESTAMP WHERE order_id = $2",
        [STATUS, orderid]
      );

      await client.query(
        "UPDATE order_items SET status = $1 WHERE order_id = $2",
        [STATUS, orderid]
      );
    });

  } catch (error) {
    console.error("Unable to process the webhook request");
  }
};
