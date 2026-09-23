import ExcelJS from "exceljs";
import { Request, Response } from "express";
import QueryStream from "pg-query-stream";
import { pool } from "..";
import { REPORTING_TIMEZONE } from "../constant";
import { buildOrderListFilter } from "../utils/buildOrderListFilter";
import { ErrorHandler } from "../utils/ErrorHandler";
import logger from "../utils/logger";

/**
 * Excel export of the CMS order list.
 *
 * Built to stay flat on memory however many orders the store has:
 *
 *  - Postgres hands rows over through a server-side cursor (pg-query-stream),
 *    BATCH_SIZE at a time, so the full result set never sits in node.
 *  - exceljs writes each row straight into the zip that is being piped to the
 *    response, with shared strings off, so nothing is kept once it is written.
 *  - When the response buffer is full (slow client) the loop waits for it to
 *    drain before pulling the next rows, which pauses the cursor too.
 *  - Only MAX_CONCURRENT_EXPORTS run at once per process: each one holds a pool
 *    connection for its whole run, and the storefront needs the rest.
 */

const BATCH_SIZE = 1000;

// Excel's hard limit is 1,048,576 rows per sheet; stay under it with the header.
const MAX_ROWS = 1_000_000;

const MAX_CONCURRENT_EXPORTS = 2;
let runningExports = 0;

const MONEY_FORMAT = "#,##0.00";

const COLUMNS: Partial<ExcelJS.Column>[] = [
  { header: "Order No", key: "order_number", width: 20 },
  { header: "Order Date (IST)", key: "order_date", width: 18 },
  { header: "Customer", key: "customer_name", width: 24 },
  { header: "Email", key: "email", width: 28 },
  { header: "Phone", key: "phone", width: 15 },
  { header: "Customer Type", key: "customer_type", width: 14 },
  { header: "City", key: "city", width: 16 },
  { header: "State", key: "state", width: 16 },
  { header: "Pincode", key: "pincode", width: 10 },
  { header: "Items", key: "items", width: 48 },
  { header: "Total Qty", key: "total_qty", width: 10 },
  { header: "Subtotal", key: "subtotal", width: 12, style: { numFmt: MONEY_FORMAT } },
  { header: "Coupon", key: "coupon_code", width: 14 },
  { header: "Discount", key: "discount", width: 12, style: { numFmt: MONEY_FORMAT } },
  { header: "Shipping", key: "shipping_charge", width: 12, style: { numFmt: MONEY_FORMAT } },
  { header: "Total Amount", key: "total_amount", width: 14, style: { numFmt: MONEY_FORMAT } },
  { header: "Payment Mode", key: "payment_method", width: 14 },
  { header: "Payment Status", key: "payment_status", width: 15 },
  { header: "Order Status", key: "order_status", width: 16 },
  { header: "Invoice No", key: "invoice_number", width: 18 },
  { header: "Courier", key: "courier_name", width: 18 },
  { header: "AWB / Waybill", key: "waybill", width: 20 },
  { header: "Delivered At (IST)", key: "delivered_at", width: 18 },
  { header: "Customer GSTIN", key: "gst_number", width: 18 },
];

const toNumber = (value: unknown) =>
  value === null || value === undefined ? 0 : Number(value);

const waitForDrain = (res: Response) =>
  new Promise<void>((resolve) => {
    const done = () => {
      res.off("drain", done);
      res.off("close", done);
      resolve();
    };
    res.on("drain", done);
    res.on("close", done);
  });

/** Running totals for the Summary sheet, kept while the rows stream past. */
function createSummary() {
  const byOrderStatus = new Map<string, { count: number; amount: number }>();
  const byPaymentStatus = new Map<string, { count: number; amount: number }>();
  const byPaymentMode = new Map<string, { count: number; amount: number }>();
  let orders = 0;
  let grossAmount = 0;
  let discount = 0;
  let shipping = 0;
  let paidAmount = 0;

  const bump = (
    map: Map<string, { count: number; amount: number }>,
    key: string,
    amount: number,
  ) => {
    const entry = map.get(key) ?? { count: 0, amount: 0 };
    entry.count++;
    entry.amount += amount;
    map.set(key, entry);
  };

  return {
    add(row: any) {
      const total = toNumber(row.total_amount);
      orders++;
      grossAmount += total;
      discount += toNumber(row.discount);
      shipping += toNumber(row.shipping_charge);
      if (row.payment_status === "PAID") paidAmount += total;
      bump(byOrderStatus, row.order_status ?? "UNKNOWN", total);
      bump(byPaymentStatus, row.payment_status ?? "UNKNOWN", total);
      bump(byPaymentMode, row.payment_method ?? "UNKNOWN", total);
    },

    write(workbook: ExcelJS.stream.xlsx.WorkbookWriter, query: Request["query"], truncated: boolean) {
      const sheet = workbook.addWorksheet("Summary");
      sheet.columns = [
        { key: "a", width: 28 },
        { key: "b", width: 14 },
        { key: "c", width: 18, style: { numFmt: MONEY_FORMAT } },
      ];

      const heading = (text: string) => {
        const row = sheet.addRow([text]);
        row.font = { bold: true, size: 12 };
        row.commit();
      };
      const line = (values: (string | number)[], bold = false) => {
        const row = sheet.addRow(values);
        if (bold) row.font = { bold: true };
        row.commit();
      };

      heading("Order Summary");
      line([
        "Generated at",
        new Date().toLocaleString("en-IN", { timeZone: REPORTING_TIMEZONE }),
      ]);
      const filters = Object.entries(query)
        .filter(([key]) => key !== "page" && key !== "limit")
        .map(([key, value]) => `${key}=${value}`)
        .join(", ");
      line(["Filters", filters || "None"]);
      if (truncated) {
        line([`Truncated to the first ${MAX_ROWS.toLocaleString("en-IN")} orders — narrow the date range for the rest`]);
      }
      line([]);

      line(["Total orders", orders], true);
      line(["Gross order value", "", grossAmount], true);
      line(["Total discount", "", discount]);
      line(["Total shipping", "", shipping]);
      line(["Paid amount", "", paidAmount], true);
      line(["Average order value", "", orders ? grossAmount / orders : 0]);

      const breakdown = (
        title: string,
        map: Map<string, { count: number; amount: number }>,
      ) => {
        line([]);
        heading(title);
        line(["Value", "Orders", "Amount"], true);
        [...map.entries()]
          .sort((a, b) => b[1].count - a[1].count)
          .forEach(([key, { count, amount }]) => line([key, count, amount]));
      };

      breakdown("By Order Status", byOrderStatus);
      breakdown("By Payment Status", byPaymentStatus);
      breakdown("By Payment Mode", byPaymentMode);

      sheet.commit();
    },
  };
}

export async function streamOrderExport(req: Request, res: Response) {
  if (runningExports >= MAX_CONCURRENT_EXPORTS) {
    throw new ErrorHandler(
      429,
      "Another export is already running. Please try again in a minute.",
    );
  }

  runningExports++;
  const client = await pool.connect().catch((error) => {
    runningExports--;
    throw error;
  });

  const { filter, filterValues } = buildOrderListFilter(req.query);

  const rowStream = client.query(
    new QueryStream(
      `
        SELECT
          o.order_number,
          TO_CHAR(
            o.created_at AT TIME ZONE 'UTC' AT TIME ZONE '${REPORTING_TIMEZONE}',
            'YYYY-MM-DD HH24:MI'
          ) AS order_date,
          COALESCE(o.shipping_address->>'name', u.name) AS customer_name,
          COALESCE(o.shipping_address->>'email', u.email) AS email,
          COALESCE(o.shipping_address->>'phone', u.phone_no) AS phone,
          COALESCE(o.is_guest_order, false) AS is_guest_order,
          o.shipping_address->>'city' AS city,
          o.shipping_address->>'state' AS state,
          o.shipping_address->>'pincode' AS pincode,
          items.items,
          items.total_qty,
          o.subtotal,
          o.coupon_code,
          o.discount,
          o.shipping_charge,
          o.total_amount,
          o.payment_method,
          o.payment_status,
          o.order_status,
          o.invoice_number,
          o.courier_name,
          o.waybill,
          TO_CHAR(
            o.delivered_at AT TIME ZONE 'UTC' AT TIME ZONE '${REPORTING_TIMEZONE}',
            'YYYY-MM-DD HH24:MI'
          ) AS delivered_at,
          o.gst_details->>'gst_number' AS gst_number
        FROM orders o
        LEFT JOIN users u ON u.id = o.user_id
        -- one index lookup per order on idx_order_items_order_id
        LEFT JOIN LATERAL (
          SELECT
            STRING_AGG(
              COALESCE(oi.variant_info->>'product_name', oi.product_info->>'name', 'Item')
                || ' x ' || oi.quantity,
              '; ' ORDER BY oi.order_item_id
            ) AS items,
            SUM(oi.quantity) AS total_qty
          FROM order_items oi
          WHERE oi.order_id = o.order_id
        ) items ON true
        ${filter}
        ORDER BY o.order_id DESC
        LIMIT ${MAX_ROWS + 1}
      `,
      filterValues,
      { batchSize: BATCH_SIZE },
    ),
  );

  // The admin closed the tab or cancelled the download: stop reading from
  // postgres straight away rather than streaming into a dead socket.
  let aborted = false;
  const onClose = () => {
    if (!res.writableFinished) {
      aborted = true;
      rowStream.destroy();
    }
  };
  res.on("close", onClose);

  const stamp = new Date()
    .toLocaleString("sv-SE", { timeZone: REPORTING_TIMEZONE })
    .replace(/[: ]/g, "-")
    .slice(0, 16);
  const draftTag = req.query.draft === "true" ? "drafts-" : "";

  res.status(200);
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="orders-${draftTag}${stamp}.xlsx"`,
  );
  res.setHeader("Cache-Control", "no-store");

  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream: res,
    useStyles: true,
    useSharedStrings: false,
  });
  workbook.creator = "CMS";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Orders", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = COLUMNS;
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF16A34A" },
  };
  header.commit();

  const summary = createSummary();
  let written = 0;
  let truncated = false;
  let failed = false;

  try {
    for await (const row of rowStream) {
      if (written >= MAX_ROWS) {
        truncated = true;
        break;
      }

      summary.add(row);
      sheet
        .addRow({
          ...row,
          customer_type: row.is_guest_order ? "Guest" : "Registered",
          total_qty: toNumber(row.total_qty),
          subtotal: toNumber(row.subtotal),
          discount: toNumber(row.discount),
          shipping_charge: toNumber(row.shipping_charge),
          total_amount: toNumber(row.total_amount),
        })
        .commit();
      written++;

      if (res.writableNeedDrain) await waitForDrain(res);
      if (aborted) break;
    }

    if (aborted) return;

    sheet.commit();
    summary.write(workbook, req.query, truncated);
    await workbook.commit();
  } catch (error) {
    // Headers and part of the zip are already out, so there is no clean error
    // response left to send: cut the connection so the browser reports a
    // failed download instead of saving a corrupt file.
    failed = true;
    logger.error(`Order export failed after ${written} rows: ${error}`);
    res.destroy();
  } finally {
    res.off("close", onClose);
    rowStream.destroy();
    // a cursor cut off mid-read can leave the connection in an unknown state,
    // so it is thrown away instead of going back to the pool
    client.release(aborted || failed || truncated);
    runningExports--;
  }
}
