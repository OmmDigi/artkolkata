import { renderToBuffer } from "@react-pdf/renderer";
import { getCompanyInfo } from "../../utils/companyInfo";
import { IOrderDocumentData } from "./orderDocumentData";
import InvoicePdf from "./pdf/InvoicePdf";
import PackingSlipPdf from "./pdf/PackingSlipPdf";
import PaymentSlipPdf from "./pdf/PaymentSlipPdf";

// Rendering is CPU work on the event loop, which is why it happens once, when
// an admin asks for it, and the result is stored — not on every download.
export const renderInvoicePdf = async (
  data: IOrderDocumentData,
  invoiceNumber: string,
  invoiceDate: Date,
): Promise<Buffer> =>
  renderToBuffer(
    <InvoicePdf
      data={data}
      company={await getCompanyInfo()}
      invoiceNumber={invoiceNumber}
      invoiceDate={invoiceDate}
    />,
  );

export const renderPackingSlipPdf = async (
  data: IOrderDocumentData,
): Promise<Buffer> =>
  renderToBuffer(<PackingSlipPdf data={data} company={await getCompanyInfo()} />);

// Unlike the other two this one is also rendered without an admin asking —
// generatePaymentSlip calls it the moment a payment turns PAID.
export const renderPaymentSlipPdf = async (
  data: IOrderDocumentData,
): Promise<Buffer> =>
  renderToBuffer(<PaymentSlipPdf data={data} company={await getCompanyInfo()} />);
