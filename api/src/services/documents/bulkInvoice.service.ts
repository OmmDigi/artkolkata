import { PDFDocument } from "pdf-lib";
import { pool } from "../..";
import { ErrorHandler } from "../../utils/ErrorHandler";
import logger from "../../utils/logger";
import { generateInvoiceForOrder, loadOrderInvoice } from "./invoice.service";

/**
 * Many orders' invoices as one multi-page pdf, for printing a day's dispatch in
 * one go.
 *
 * Each order contributes the same document the single download serves: the
 * uploaded invoice if an admin put one there, else the generated one. An order
 * with neither has its invoice generated on the spot — number allotted, file
 * stored, order updated — exactly as the Generate button would.
 *
 * Kept within bounds so it scales with the store rather than against it:
 *
 *  - MAX_BULK_INVOICES per request (see constant.ts).
 *  - WORKER_CONCURRENCY orders are fetched or rendered at once. Rendering is
 *    cpu on the event loop and generating holds a pool connection, so a
 *    hundred at once would stall every other request.
 *  - MAX_CONCURRENT_JOBS bulk requests per process.
 *  - Pages are merged in the order the admin selected, and each order's bytes
 *    are dropped as soon as they have been copied in.
 */

const WORKER_CONCURRENCY = 4;
const MAX_CONCURRENT_JOBS = 2;
let runningJobs = 0;

// A4 in pdf points, for invoices that were uploaded as a photo.
const A4 = { width: 595.28, height: 841.89 };
const IMAGE_MARGIN = 24;

type TInvoiceResult =
  | { ok: true; content: Buffer; contentType: string }
  | { ok: false; reason: string };

export interface IBulkInvoiceResult {
  pdf: Uint8Array;
  included: string[];
  failed: { order_number: string; reason: string }[];
}

/** Runs at most `concurrency` tasks at a time; the rest wait their turn. */
const createLimiter = (concurrency: number) => {
  let active = 0;
  const queue: (() => void)[] = [];

  const next = () => {
    active--;
    queue.shift()?.();
  };

  return <T>(task: () => Promise<T>) =>
    new Promise<T>((resolve, reject) => {
      const run = () => {
        active++;
        task().then(resolve, reject).finally(next);
      };
      if (active < concurrency) run();
      else queue.push(run);
    });
};

/**
 * One order's invoice bytes. Never rejects — a failure is reported against the
 * order so one bad invoice does not cost the admin the other ninety-nine.
 */
const invoiceFor = async (
  orderId: number,
  hasInvoice: boolean,
): Promise<TInvoiceResult> => {
  try {
    if (hasInvoice) {
      try {
        const { file } = await loadOrderInvoice(orderId);
        if (file) {
          return { ok: true, content: file.content, contentType: file.contentType };
        }
      } catch (error: any) {
        // The generated file went missing from storage: render it again rather
        // than leave a hole in the print run. Anything else is a real failure.
        if (error?.statusCode !== 404) throw error;
      }
    }

    const { pdf } = await generateInvoiceForOrder(orderId);
    return { ok: true, content: pdf, contentType: "application/pdf" };
  } catch (error: any) {
    logger.warn("Bulk invoice: order skipped", { orderId, error: error?.message });
    return { ok: false, reason: error?.message ?? "Could not produce the invoice" };
  }
};

const appendToMerged = async (
  merged: PDFDocument,
  content: Buffer,
  contentType: string,
) => {
  if (contentType === "application/pdf") {
    const source = await PDFDocument.load(content, { ignoreEncryption: true });
    const pages = await merged.copyPages(source, source.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
    return;
  }

  // An uploaded photo of an invoice: one A4 page, image scaled to fit.
  const image =
    contentType === "image/png"
      ? await merged.embedPng(content)
      : await merged.embedJpg(content);
  const page = merged.addPage([A4.width, A4.height]);
  const scaled = image.scaleToFit(
    A4.width - IMAGE_MARGIN * 2,
    A4.height - IMAGE_MARGIN * 2,
  );
  page.drawImage(image, {
    x: (A4.width - scaled.width) / 2,
    y: (A4.height - scaled.height) / 2,
    width: scaled.width,
    height: scaled.height,
  });
};

export const buildBulkInvoicePdf = async (
  orderIds: number[],
): Promise<IBulkInvoiceResult> => {
  if (runningJobs >= MAX_CONCURRENT_JOBS) {
    throw new ErrorHandler(
      429,
      "Another bulk invoice download is already running. Please try again in a minute.",
    );
  }

  runningJobs++;
  try {
    const { rows } = await pool.query<{
      order_id: number;
      order_number: string;
      has_invoice: boolean;
    }>(
      `SELECT
         order_id,
         order_number,
         (
           (invoice_document IS NOT NULL AND invoice_document <> '')
           OR (invoice_pdf_url IS NOT NULL AND invoice_pdf_url <> '')
         ) AS has_invoice
       FROM orders
       WHERE order_id = ANY($1::int[])`,
      [orderIds],
    );

    const byId = new Map(rows.map((row) => [row.order_id, row]));
    const failed: IBulkInvoiceResult["failed"] = [];
    const included: string[] = [];

    // keep the admin's order, drop ids that matched nothing
    const orders = orderIds.flatMap((id) => {
      const row = byId.get(id);
      if (!row) failed.push({ order_number: `#${id}`, reason: "Order not found" });
      return row ? [row] : [];
    });

    const limit = createLimiter(WORKER_CONCURRENCY);
    // Started now, awaited in order below: the workers run ahead while the
    // merge keeps to the selected sequence.
    const pending: (Promise<TInvoiceResult> | null)[] = orders.map((order) =>
      limit(() => invoiceFor(order.order_id, order.has_invoice)),
    );

    const merged = await PDFDocument.create();
    merged.setTitle(`Invoices (${orders.length})`);

    for (let i = 0; i < orders.length; i++) {
      const result = await pending[i]!;
      pending[i] = null;

      if (!result.ok) {
        failed.push({ order_number: orders[i].order_number, reason: result.reason });
        continue;
      }

      try {
        await appendToMerged(merged, result.content, result.contentType);
        included.push(orders[i].order_number);
      } catch (error: any) {
        failed.push({
          order_number: orders[i].order_number,
          reason: "The stored invoice file is not a readable PDF or image",
        });
        logger.warn("Bulk invoice: unreadable file", {
          orderId: orders[i].order_id,
          error: error?.message,
        });
      }
    }

    if (included.length === 0) {
      throw new ErrorHandler(
        422,
        `None of the selected invoices could be produced${
          failed[0] ? `: ${failed[0].reason}` : ""
        }`,
      );
    }

    return { pdf: await merged.save(), included, failed };
  } finally {
    runningJobs--;
  }
};
