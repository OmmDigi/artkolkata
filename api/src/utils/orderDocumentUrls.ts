// Every order carries two downloadable documents, and they are not the same
// thing: the invoice is a file an admin uploaded from the CMS, so it only
// exists once someone put it there, while the payment slip is the one the app
// renders itself from the order record and is always available.
export interface IOrderDocumentUrls {
  invoice_url: string | null;
  payment_slip_url: string;
}

export const buildOrderDocumentUrls = (
  orderId: number | string,
  hasUploadedInvoice: boolean,
): IOrderDocumentUrls => {
  const base = `${process.env.API_BASE_URL}/api/v1/orders`;

  return {
    invoice_url: hasUploadedInvoice ? `${base}/invoice/${orderId}` : null,
    payment_slip_url: `${base}/payment-slip/${orderId}`,
  };
};

// Attaches the two URLs to every row of an order listing. `invoice_avilable`
// is what the row already carries to say whether an upload exists.
export const withOrderDocumentUrls = <T extends { order_id: number; invoice_avilable: boolean }>(
  rows: T[],
): (T & IOrderDocumentUrls)[] =>
  rows.map((row) => ({
    ...row,
    ...buildOrderDocumentUrls(row.order_id, row.invoice_avilable),
  }));
