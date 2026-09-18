import { doTransition } from "../../utils/doTransition";
import { ErrorHandler } from "../../utils/ErrorHandler";
import logger from "../../utils/logger";
import { deleteOrderDocument, uploadOrderDocument } from "./documentStorage";
import { getOrderDocumentData } from "./orderDocumentData";
import { renderPaymentSlipPdf } from "./renderOrderDocument";

/**
 * The payment slip, generated and kept.
 *
 * Unlike the invoice and the packing slip, nobody presses a button for this
 * one: it is rendered the moment an order's payment turns PAID, because that is
 * the moment there is something to give a receipt for. The stored file is then
 * what every download serves.
 *
 * An order that has not been paid has no stored slip at all — see
 * renderUnstoredPaymentSlip, which the download route falls back to.
 */

export interface IPaymentSlipResult {
  receiptNumber: string;
  storedUrl: string;
  /** false when a stored slip was already on file and was reused. */
  generated: boolean;
}

/**
 * Generates the slip for a paid order, or returns the one already stored.
 *
 * `force` re-renders and replaces the stored file — for an admin who has
 * corrected an address and wants the receipt to say so. The receipt number and
 * the receipt date survive a forced regenerate for the same reason the invoice
 * number does: a customer already holding PAY-100023 must not be handed a
 * second document under a different number.
 *
 * Returns null when the order is not paid, which is not an error — it is the
 * ordinary state of an order waiting on its customer or on a courier.
 */
export const generatePaymentSlip = async (
  orderId: number,
  { force = false }: { force?: boolean } = {},
): Promise<IPaymentSlipResult | null> => {
  let receiptNumber = "";
  let storedUrl = "";
  let generated = false;
  let supersededUrl: string | null = null;

  await doTransition(async (client) => {
    // FOR UPDATE, so the webhook and an admin pressing regenerate at the same
    // moment cannot draw two receipt numbers for one order.
    const existing = await client.query(
      `SELECT payment_status, receipt_number, payment_slip_url
         FROM orders
        WHERE order_id = $1
        FOR UPDATE`,
      [orderId],
    );

    if (existing.rowCount === 0)
      throw new ErrorHandler(404, "Order information not found!");

    const row = existing.rows[0];

    if (row.payment_status !== "PAID") return;

    // Already on file and nobody asked for a fresh one — the stored document is
    // the answer, and re-rendering it would only cost CPU and a new upload.
    if (row.payment_slip_url && row.receipt_number && !force) {
      receiptNumber = row.receipt_number;
      storedUrl = row.payment_slip_url;
      return;
    }

    supersededUrl = row.payment_slip_url ?? null;

    receiptNumber = row.receipt_number ?? "";

    if (!receiptNumber) {
      const allotted = await client.query(
        "SELECT 'PAY-' || nextval('receipt_number_seq') AS receipt_number",
      );
      receiptNumber = allotted.rows[0].receipt_number;

      // Written before the render so the number the document prints is the
      // number the row holds, even if the upload fails and the transaction
      // rolls back — in which case neither survives, which is the point.
      await client.query(
        `UPDATE orders
            SET receipt_number = $1,
                payment_slip_generated_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
          WHERE order_id = $2`,
        [receiptNumber, orderId],
      );
    }

    // Read back inside the same transaction, so the document prints the receipt
    // number just allotted rather than the null that was there a moment ago.
    const data = await getOrderDocumentData(orderId, client);
    const pdf = await renderPaymentSlipPdf(data);

    storedUrl = await uploadOrderDocument(
      pdf,
      `payment-slip-${receiptNumber}.pdf`,
    );

    await client.query(
      `UPDATE orders
          SET payment_slip_url = $1,
              updated_at = CURRENT_TIMESTAMP
        WHERE order_id = $2`,
      [storedUrl, orderId],
    );

    generated = true;
  });

  if (!storedUrl) return null;

  // Only once the new path is committed, and never in a way that can fail the
  // request — see deleteOrderDocument.
  if (supersededUrl && supersededUrl !== storedUrl)
    await deleteOrderDocument(supersededUrl);

  return { receiptNumber, storedUrl, generated };
};

/**
 * "This order was just paid — it needs a receipt."
 *
 * Fire and forget, like the order emails and for the same reason: a storage
 * server having a bad minute must not fail a gateway webhook or an admin's
 * status update, and the download route generates on demand anyway, so the
 * worst case here is a slip made a few seconds later than it could have been.
 *
 * Call it after the commit that set payment_status, never inside it.
 */
export const ensurePaymentSlip = async (orderId: number) => {
  try {
    await generatePaymentSlip(orderId);
  } catch (error) {
    logger.error({
      message: "Could not generate the payment slip for a paid order",
      order_id: orderId,
      stack: error,
    });
  }
};

/**
 * The slip for an order that has not been paid: rendered on the spot, never
 * stored, carrying no receipt number and no paid stamp.
 *
 * It exists because the payment slip route has always answered for every order
 * at any status — a customer who has just placed a COD order can still print
 * what they owe — and because nothing about an unpaid order is final enough to
 * be worth keeping a file for.
 */
export const renderUnstoredPaymentSlip = async (
  orderId: number,
): Promise<Buffer> => renderPaymentSlipPdf(await getOrderDocumentData(orderId));
