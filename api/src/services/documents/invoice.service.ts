import { pool } from "../..";
import { doTransition } from "../../utils/doTransition";
import { ErrorHandler } from "../../utils/ErrorHandler";
import {
  deleteOrderDocument,
  fetchOrderDocument,
  uploadOrderDocument,
} from "./documentStorage";
import { getOrderDocumentData } from "./orderDocumentData";
import { renderInvoicePdf } from "./renderOrderDocument";

export interface IOrderInvoiceFile {
  content: Buffer;
  filename: string;
  contentType: string;
}

/**
 * The order's invoice as bytes, plus the order details an invoice is described
 * by. `file` is null when the order has no invoice of either kind.
 *
 * An invoice an admin uploaded by hand wins over a generated one: the admin
 * uploaded it knowing a generated one was a click away, so it is the one they
 * mean the customer to have. An order with neither has no invoice at all; what
 * it has is a payment slip, served by downloadPaymentSlip.
 *
 * Shared by the download route and the email-it-to-the-customer route so the
 * two can never disagree about which document is *the* invoice.
 */
export const loadOrderInvoice = async (orderId: number | string) => {
  const order = await pool.query(
    `SELECT
       o.order_number,
       o.invoice_number,
       o.invoice_document,
       o.invoice_pdf_url,
       o.total_amount,
       TO_CHAR(o.created_at, 'DD Mon YYYY') AS order_date,
       COALESCE(o.shipping_address, '{}'::jsonb) AS shipping_details,
       u.name AS account_name,
       u.email AS account_email
     FROM orders o
     LEFT JOIN users u ON u.id = o.user_id
     WHERE o.order_id = $1`,
    [orderId],
  );

  if (order.rowCount == 0)
    throw new ErrorHandler(404, "Order information not found!");

  const row = order.rows[0];
  const { order_number, invoice_number, invoice_document, invoice_pdf_url } =
    row;

  let file: IOrderInvoiceFile | null = null;

  if (invoice_document) {
    const [header, base64] = (invoice_document as string).split(",");
    const mime = header.match(/^data:([^;]+);base64$/)?.[1];

    if (!base64 || !mime) {
      throw new ErrorHandler(
        500,
        "The uploaded invoice for this order is unreadable",
      );
    }

    const extension = mime === "application/pdf" ? "pdf" : "jpg";

    file = {
      content: Buffer.from(base64, "base64"),
      filename: `invoice-${order_number}.${extension}`,
      contentType: mime,
    };
  } else if (invoice_pdf_url) {
    // the file itself is private on the upload server, so it is read with the
    // api's token and streamed on rather than linked to
    file = {
      content: await fetchOrderDocument(invoice_pdf_url),
      filename: `invoice-${invoice_number ?? order_number}.pdf`,
      contentType: "application/pdf",
    };
  }

  return { order: row, file };
};

/**
 * Renders the order's invoice, stores it and links it from the order. Always a
 * fresh render, so an admin who fixed an address gets a document that says so;
 * the invoice number and date are allotted once and then kept.
 *
 * Returns the rendered bytes as well, so a caller that needs the pdf (the bulk
 * download) does not have to read back what it has just uploaded.
 */
export const generateInvoiceForOrder = async (orderId: number) => {
  let invoiceNumber = "";
  let supersededUrl: string | null = null;
  let storedUrl = "";
  let pdf: Buffer = Buffer.alloc(0);

  await doTransition(async (client) => {
    // FOR UPDATE, so two admins pressing the button at the same moment cannot
    // draw two invoice numbers for one order.
    const existing = await client.query(
      `SELECT invoice_number, invoice_generated_at, invoice_pdf_url
       FROM orders WHERE order_id = $1 FOR UPDATE`,
      [orderId],
    );

    if (existing.rowCount === 0)
      throw new ErrorHandler(404, "Order information not found!");

    const row = existing.rows[0];
    supersededUrl = row.invoice_pdf_url ?? null;

    // The number and the date are allotted once and then kept. A customer
    // holding INV-100023 dated the 4th must not be sent a corrected document
    // that calls itself something else, or claims to have been issued later.
    if (row.invoice_number) {
      invoiceNumber = row.invoice_number;
    } else {
      const allotted = await client.query(
        "SELECT 'INV-' || nextval('invoice_number_seq') AS invoice_number",
      );
      invoiceNumber = allotted.rows[0].invoice_number;
    }

    const invoiceDate = row.invoice_generated_at
      ? new Date(row.invoice_generated_at)
      : new Date();

    const data = await getOrderDocumentData(orderId, client);
    pdf = await renderInvoicePdf(data, invoiceNumber, invoiceDate);

    storedUrl = await uploadOrderDocument(pdf, `invoice-${invoiceNumber}.pdf`);

    await client.query(
      `UPDATE orders
       SET invoice_number = $1,
           invoice_pdf_url = $2,
           invoice_generated_at = COALESCE(invoice_generated_at, $3),
           updated_at = CURRENT_TIMESTAMP
       WHERE order_id = $4`,
      [invoiceNumber, storedUrl, invoiceDate, orderId],
    );
  });

  // Only once the new path is committed, and never in a way that can fail the
  // request — see deleteOrderDocument.
  if (supersededUrl && supersededUrl !== storedUrl)
    await deleteOrderDocument(supersededUrl);

  return { invoiceNumber, storedUrl, pdf };
};
