// Every order carries three downloadable documents and they are not the same
// thing:
//
//   invoice_url      the invoice — either one an admin uploaded from the CMS or
//                    one the CMS generated as a PDF, whichever is on file. Null
//                    until someone does one of the two.
//   payment_slip_url the html page the app renders from the order record. Always
//                    available, at any status, and never an invoice.
//   packing_slip_url the generated packing slip PDF. Admin-only, and null until
//                    it is generated.
export interface IOrderDocumentUrls {
  invoice_url: string | null;
  payment_slip_url: string;
  packing_slip_url: string | null;
}

export const buildOrderDocumentUrls = (
  orderId: number | string,
  hasInvoice: boolean,
  hasPackingSlip = false,
): IOrderDocumentUrls => {
  const base = `${process.env.API_BASE_URL}/api/v1/orders`;

  return {
    invoice_url: hasInvoice ? `${base}/invoice/${orderId}` : null,
    payment_slip_url: `${base}/payment-slip/${orderId}`,
    packing_slip_url: hasPackingSlip ? `${base}/${orderId}/packing-slip` : null,
  };
};

// Attaches the urls to every row of an order listing. `invoice_avilable` is what
// the row already carries to say whether an invoice of either kind exists;
// `packing_slip_available` is optional because the customer-facing listing does
// not select it — a packing slip is for the warehouse, not the buyer.
export const withOrderDocumentUrls = <
  T extends {
    order_id: number;
    invoice_avilable: boolean;
    packing_slip_available?: boolean;
  },
>(
  rows: T[],
): (T & IOrderDocumentUrls)[] =>
  rows.map((row) => ({
    ...row,
    ...buildOrderDocumentUrls(
      row.order_id,
      row.invoice_avilable,
      row.packing_slip_available ?? false,
    ),
  }));
