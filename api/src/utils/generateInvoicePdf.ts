import PDFDocument from "pdfkit";

export interface IInvoiceItem {
  name: string;
  quantity: number;
  price: number;
}

export interface IInvoiceInput {
  orderNumber: string;
  orderDate: Date | string;
  paymentMethod: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  pincode?: string;
  items: IInvoiceItem[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
}

// Bigship only accepts an invoice as a PDF or JPEG base64 data URI, and only
// on the B2B route — where it is mandatory. The customer-facing invoice is an
// EJS page rendered in the browser, so there is nothing to attach; this draws
// the same numbers straight to a PDF in memory instead of standing up a
// headless browser to print that page.
//
// pdfkit only ships WinAnsi core fonts, so the rupee sign renders as garbage.
// Amounts go out as "Rs." for that reason.
const rupees = (value: number) => `Rs. ${(value ?? 0).toFixed(2)}`;

export const generateInvoicePdf = (invoice: IInvoiceInput): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const orderDate = new Date(invoice.orderDate);

      doc.fontSize(20).text("Art Kolkata", { align: "center" });
      doc.fontSize(12).text("TAX INVOICE", { align: "center" });
      doc.moveDown(1.5);

      doc.fontSize(10);
      doc.text(`Invoice No: ${invoice.orderNumber}`);
      doc.text(`Date: ${orderDate.toLocaleDateString("en-IN")}`);
      doc.text(`Payment: ${invoice.paymentMethod}`);
      doc.moveDown(1);

      doc.fontSize(12).text("Bill To", { underline: true });
      doc.fontSize(10);
      doc.text(invoice.customerName);
      if (invoice.addressLine1) doc.text(invoice.addressLine1);

      const locality = [invoice.city, invoice.state, invoice.pincode]
        .filter(Boolean)
        .join(", ");
      if (locality) doc.text(locality);
      if (invoice.customerPhone) doc.text(`Phone: ${invoice.customerPhone}`);
      if (invoice.customerEmail) doc.text(`Email: ${invoice.customerEmail}`);
      doc.moveDown(1.5);

      // Simple fixed-column table — the item name gets whatever is left after
      // the three numeric columns on the right.
      const left = doc.page.margins.left;
      const right = doc.page.width - doc.page.margins.right;
      const qtyX = right - 210;
      const rateX = right - 150;
      const amountX = right - 80;

      const row = (
        label: string,
        qty: string,
        rate: string,
        amount: string,
        y: number,
      ) => {
        doc.text(label, left, y, { width: qtyX - left - 10 });
        doc.text(qty, qtyX, y, { width: 50, align: "right" });
        doc.text(rate, rateX, y, { width: 60, align: "right" });
        doc.text(amount, amountX, y, { width: 80, align: "right" });
      };

      const line = (y: number) =>
        doc.moveTo(left, y).lineTo(right, y).lineWidth(0.5).stroke();

      doc.font("Helvetica-Bold");
      row("Item", "Qty", "Rate", "Amount", doc.y);
      doc.font("Helvetica");
      doc.moveDown(0.5);
      line(doc.y);
      doc.moveDown(0.5);

      for (const item of invoice.items) {
        const y = doc.y;
        row(
          item.name,
          String(item.quantity),
          rupees(item.price),
          rupees(item.price * item.quantity),
          y,
        );
        // The name can wrap onto a second line while the numbers do not, so
        // step down by whichever is taller before drawing the next row.
        doc.y = Math.max(
          doc.y,
          y + doc.heightOfString(item.name, { width: qtyX - left - 10 }),
        );
        doc.moveDown(0.4);
      }

      line(doc.y);
      doc.moveDown(0.6);

      const total = (label: string, value: string, bold = false) => {
        doc.font(bold ? "Helvetica-Bold" : "Helvetica");
        const y = doc.y;
        doc.text(label, rateX - 60, y, { width: 130, align: "right" });
        doc.text(value, amountX, y, { width: 80, align: "right" });
        doc.font("Helvetica");
        doc.moveDown(0.3);
      };

      total("Subtotal", rupees(invoice.subtotal));
      if (invoice.discount > 0) total("Discount", `- ${rupees(invoice.discount)}`);
      total("Shipping", invoice.shipping > 0 ? rupees(invoice.shipping) : "FREE");
      doc.moveDown(0.2);
      total("TOTAL", rupees(invoice.total), true);

      doc.moveDown(2);
      // The totals block left the cursor inside a narrow right-hand column, so
      // the footer is placed back at the left margin across the full width.
      doc
        .fontSize(8)
        .text(
          "This is a computer generated invoice and needs no signature.",
          left,
          doc.y,
          { width: right - left, align: "center" },
        );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });

// Bigship reads the document out of a Data URI, not a bare base64 payload.
export const generateInvoiceDataUri = async (
  invoice: IInvoiceInput,
): Promise<string> => {
  const pdf = await generateInvoicePdf(invoice);
  return `data:application/pdf;base64,${pdf.toString("base64")}`;
};
