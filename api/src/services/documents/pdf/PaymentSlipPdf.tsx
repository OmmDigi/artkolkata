import fs from "fs";
import path from "path";
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { ICompanyInfo } from "../../../utils/companyInfo";
import { amountInWords } from "../../../utils/amountInWords";
import { IOrderDocumentData } from "../orderDocumentData";
import { BundleContents, formatDate, formatMoney } from "./shared";

// Importing shared registers Roboto and the hyphenation callback; this document
// needs both for the same reasons the other two do — the rupee glyph, and
// product names that must not be broken with an invented hyphen.

/* -------------------------------------------------------------------------- */

// The stamp, read once at import. It ships in the api's own public folder
// rather than coming from the upload server: it is part of the document's
// design, not something the store owner configures, and a receipt must not
// depend on a network call to say it was paid.
const STAMP_PATH = path.resolve(
  __dirname,
  "../../../../public/images/paid-stamp.png",
);

const paidStamp = ((): { data: Buffer; format: "png" } | null => {
  try {
    return { data: fs.readFileSync(STAMP_PATH), format: "png" };
  } catch {
    // A missing asset costs the stamp, never the receipt.
    return null;
  }
})();

// The one accent on the page. Everything else is black on white, the way the
// invoice and the packing slip are, so the three documents still look related.
const ACCENT = "#e2532c";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Roboto",
    fontSize: 9,
    color: "#1a1a1a",
    paddingTop: 24,
    // deep enough to clear the fixed footer, which is painted over the page
    // rather than flowed into it
    paddingBottom: 62,
    paddingHorizontal: 44,
    lineHeight: 1.45,
  },
  // the rule across the top, which is what makes a receipt recognisable as one
  // from across a desk
  rule: {
    height: 3,
    backgroundColor: ACCENT,
    marginBottom: 16,
  },

  /* ----------------------------- letterhead ----------------------------- */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logo: {
    width: 150,
    height: 52,
    objectFit: "contain",
    objectPositionX: "left",
  },
  logoFallback: {
    fontSize: 15,
    fontWeight: 700,
    maxWidth: 200,
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: 0.4,
  },

  companyBlock: {
    marginTop: 12,
  },
  companyName: {
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 5,
  },
  companyGst: {
    fontWeight: 700,
    marginBottom: 2,
  },

  /* ------------------------------- meta grid ----------------------------- */
  // The facts that identify the payment, boxed together because they are read
  // as a set: which receipt, when, whether it went through, and how.
  metaPanel: {
    marginTop: 10,
    backgroundColor: "#f4f4f4",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  metaRow: {
    flexDirection: "row",
  },
  metaCell: {
    flex: 1,
    paddingRight: 10,
  },
  metaLabel: {
    fontSize: 7,
    color: "#6b6b6b",
    letterSpacing: 0.4,
  },
  metaValue: {
    fontWeight: 700,
  },

  /* ------------------------------ amount box ----------------------------- */
  amountBox: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: ACCENT,
    backgroundColor: "#fdf3f0",
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  amountLeft: {
    flex: 1,
  },
  amountLabel: {
    fontSize: 7,
    color: ACCENT,
    letterSpacing: 0.4,
  },
  amountValue: {
    fontSize: 19,
    fontWeight: 700,
    color: ACCENT,
  },
  // the payment's own identifiers, right aligned against the figure they belong
  // to
  amountRight: {
    width: 210,
    textAlign: "right",
    fontSize: 8,
    color: "#4a4a4a",
  },

  words: {
    marginTop: 10,
    flexDirection: "row",
  },
  wordsLabel: {
    fontWeight: 700,
    marginRight: 6,
  },
  wordsValue: {
    flex: 1,
  },

  /* ------------------------------- sections ------------------------------ */
  sectionHeading: {
    fontSize: 11,
    fontWeight: 700,
    marginTop: 14,
    marginBottom: 4,
  },
  sectionNote: {
    fontSize: 8,
    color: "#6b6b6b",
    marginBottom: 6,
  },

  itemRow: {
    flexDirection: "row",
    paddingVertical: 2,
  },
  itemIndex: {
    width: 16,
  },
  itemName: {
    flex: 1,
    paddingRight: 10,
  },
  itemQuantity: {
    width: 52,
  },
  itemAmount: {
    width: 76,
    textAlign: "right",
  },

  /* --------------------------- summary two-up ---------------------------- */
  // Who paid on the left, what they paid on the right. Stacking them instead
  // would leave half the page empty beside the totals and push the closing line
  // onto a second sheet.
  summaryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 4,
  },
  summaryLeft: {
    flex: 1,
    paddingRight: 20,
  },

  /* -------------------------------- totals ------------------------------- */
  totals: {
    width: 230,
    marginTop: 6,
  },
  totalsRow: {
    flexDirection: "row",
    paddingVertical: 4,
  },
  totalsRowLast: {
    borderTopWidth: 1,
    borderTopColor: "#1a1a1a",
    borderTopStyle: "solid",
    marginTop: 3,
    paddingTop: 6,
  },
  totalsLabel: {
    flex: 1,
  },
  totalsValue: {
    width: 90,
    textAlign: "right",
  },
  totalsNote: {
    fontSize: 8,
    color: "#6b6b6b",
  },

  /* --------------------------- customer + stamp -------------------------- */
  closingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
  },
  customerName: {
    fontWeight: 700,
  },
  stamp: {
    width: 84,
    height: 84,
    objectFit: "contain",
  },

  /* ---------------------------- closing + footer -------------------------- */
  confirmation: {
    flex: 1,
    borderLeftWidth: 2,
    borderLeftColor: "#d9d9d9",
    borderLeftStyle: "solid",
    paddingLeft: 10,
    fontSize: 8,
    color: "#4a4a4a",
  },
  footer: {
    position: "absolute",
    bottom: 26,
    left: 44,
    right: 44,
    borderTopWidth: 1,
    borderTopColor: "#d9d9d9",
    borderTopStyle: "solid",
    paddingTop: 8,
    display : "flex",
    alignItems : "center"
  },
  footerName: {
    fontWeight: 700,
  },
  footerNote: {
    fontSize: 8,
    color: "#6b6b6b",
  },
});

/* -------------------------------------------------------------------------- */

/** One `LABEL` over its value, which is the whole of the meta panel's grid. */
const MetaCell = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.metaCell}>
    <Text style={styles.metaLabel}>{label}</Text>
    <Text style={styles.metaValue}>{value}</Text>
  </View>
);

/**
 * What the status line says, in the words a customer reading a receipt would
 * use. COD is called out separately from an unpaid online order because they
 * are not the same situation: one is waiting on the courier, the other on the
 * customer.
 */
const statusText = (data: IOrderDocumentData): string => {
  if (data.paymentStatus === "PAID") return "Payment Received Successfully";
  if (data.paymentStatus === "REFUNDED") return "Payment Refunded";
  if (data.paymentStatus === "FAILED") return "Payment Failed";
  return data.paymentMethod === "COD" ? "Payable on Delivery" : "Payment Pending";
};

const closingText = (data: IOrderDocumentData, company: string): string => {
  if (data.paymentStatus === "PAID")
    return `This receipt confirms that the above payment has been received by ${company} and applied towards order ${data.orderNumber}.`;

  if (data.paymentStatus === "REFUNDED")
    return `The payment against order ${data.orderNumber} has been refunded by ${company}. This slip is a record of that order's charges, not a receipt.`;

  if (data.paymentMethod === "COD")
    return `This slip records what is payable on order ${data.orderNumber}, to be collected on delivery. It is not a receipt — no payment has been received yet.`;

  return `This slip records what is payable on order ${data.orderNumber}. It is not a receipt — no payment has been received yet.`;
};

interface IProps {
  data: IOrderDocumentData;
  company: ICompanyInfo;
}

/**
 * The receipt for money received against an order.
 *
 * It is not an invoice and does not pretend to be one: it carries no invoice
 * number, and it prints whatever the payment actually is right now. Only a PAID
 * order gets the stamp, the word "receipt" in its title and a receipt number —
 * everything else is a slip stating what is owed, which is what the route has
 * always served for an order at any status.
 *
 * There is no signature block. A payment slip is a statement of fact from the
 * gateway's record, and nobody signs it.
 */
const PaymentSlipPdf = ({ data, company }: IProps) => {
  const isPaid = data.paymentStatus === "PAID";
  const documentName = isPaid ? "PAYMENT RECEIPT" : "PAYMENT SLIP";

  return (
    <Document
      title={`${documentName} ${data.receiptNumber ?? data.orderNumber}`}
      author={company.name}
      subject={`Payment slip for order ${data.orderNumber}`}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.rule} fixed />

        <View style={styles.header}>
          {company.logo ? (
            <Image style={styles.logo} src={company.logo} />
          ) : (
            <Text style={styles.logoFallback}>{company.name}</Text>
          )}
          <Text style={styles.title}>{documentName}</Text>
        </View>

        <View style={styles.companyBlock}>
          <Text style={styles.companyName}>{company.name}</Text>
          {company.gst ? (
            <Text style={styles.companyGst}>GSTIN: {company.gst}</Text>
          ) : null}
          {company.addressLines.map((line) => (
            <Text key={line}>{line}</Text>
          ))}
          {company.phone || company.email ? (
            <Text>
              {[
                company.phone ? `Mobile: ${company.phone}` : "",
                company.email ? `Email: ${company.email}` : "",
              ]
                .filter(Boolean)
                .join(" | ")}
            </Text>
          ) : null}
        </View>

        <View style={styles.metaPanel}>
          <View style={styles.metaRow}>
            {/* An unpaid slip has no receipt number to print: one is drawn only
                when the money arrives, so it cannot be quoted before then. */}
            <MetaCell
              label="RECEIPT NO."
              value={data.receiptNumber ?? "Not issued"}
            />
            <MetaCell
              label="RECEIPT DATE"
              value={data.paidAt ? formatDate(data.paidAt) : "—"}
            />
            <MetaCell label="ORDER NO." value={data.orderNumber} />
          </View>

          <View style={[styles.metaRow, { marginTop: 8 }]}>
            <MetaCell label="PAYMENT STATUS" value={statusText(data)} />
            <MetaCell
              label="PAYMENT METHOD"
              value={data.instrumentLabel ?? data.paymentMethodLabel}
            />
            <MetaCell label="ORDER DATE" value={formatDate(data.orderDate)} />
          </View>
        </View>

        <View style={styles.amountBox}>
          <View style={styles.amountLeft}>
            <Text style={styles.amountLabel}>
              {isPaid ? "AMOUNT RECEIVED" : "AMOUNT PAYABLE"}
            </Text>
            <Text style={styles.amountValue}>{formatMoney(data.total)}</Text>
          </View>

          <View style={styles.amountRight}>
            <Text>Payment Method: {data.paymentMethodLabel}</Text>
            {/* The gateway's payment id is what support and the bank both quote,
                so it is printed whenever there is one. */}
            {data.providerPaymentId ? (
              <Text>Transaction Reference: {data.providerPaymentId}</Text>
            ) : null}
            <Text>Includes {formatMoney(data.gstAmount)} GST</Text>
          </View>
        </View>

        <View style={styles.words}>
          <Text style={styles.wordsLabel}>Amount in Words:</Text>
          <Text style={styles.wordsValue}>{amountInWords(data.total)}</Text>
        </View>

        <Text style={styles.sectionHeading}>PAYMENT AGAINST</Text>
        <Text style={styles.sectionNote}>
          {isPaid
            ? `The payment has been applied towards order ${data.orderNumber}, for the following items.`
            : `Order ${data.orderNumber}, for the following items.`}
        </Text>

        {data.items.map((item, index) => (
          <View
            key={`${item.sku ?? item.name}-${index}`}
            style={styles.itemRow}
            wrap={false}
          >
            <Text style={styles.itemIndex}>{index + 1}.</Text>
            <View style={styles.itemName}>
              <Text>{item.name}</Text>
              {/* A combo lists what was in it but never prices it — the combo is
                  the one thing that was charged for. */}
              <BundleContents
                items={item.bundleItems}
                lineQuantity={item.quantity}
              />
            </View>
            <Text style={styles.itemQuantity}>Qty {item.quantity}</Text>
            <Text style={styles.itemAmount}>{formatMoney(item.lineTotal)}</Text>
          </View>
        ))}

        <View style={styles.summaryRow}>
          <View style={styles.summaryLeft}>
            <Text style={styles.sectionHeading}>CUSTOMER DETAILS</Text>
            <Text style={styles.customerName}>{data.customerName}</Text>
            {data.customerPhone ? (
              <Text>Mobile: {data.customerPhone}</Text>
            ) : null}
            {data.customerEmail ? <Text>{data.customerEmail}</Text> : null}
            {data.addressLines.length > 0 ? (
              <Text style={{ marginTop: 4 }}>Billing Address:</Text>
            ) : null}
            {data.addressLines.map((line, index) => (
              <Text key={`${line}-${index}`}>{line}</Text>
            ))}
          </View>

          <View style={styles.totals}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Subtotal</Text>
              <Text style={styles.totalsValue}>{formatMoney(data.subtotal)}</Text>
            </View>

            {/* Discount rows appear only when they fired, for the same reason the
                invoice leaves them out: a zero here sends the customer looking
                for a discount they never had. */}
            {data.couponDiscount > 0 ? (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>
                  Discount
                  {data.couponCode ? (
                    <Text style={styles.totalsNote}> ({data.couponCode})</Text>
                  ) : null}
                </Text>
                <Text style={styles.totalsValue}>
                  -{formatMoney(data.couponDiscount)}
                </Text>
              </View>
            ) : null}

            {data.autoDiscount > 0 ? (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>
                  {data.autoDiscountTitle ?? "Offer Discount"}
                </Text>
                <Text style={styles.totalsValue}>
                  -{formatMoney(data.autoDiscount)}
                </Text>
              </View>
            ) : null}

            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>
                Shipping
                <Text style={styles.totalsNote}> via {data.shippingMethod}</Text>
              </Text>
              <Text style={styles.totalsValue}>{formatMoney(data.shipping)}</Text>
            </View>

            <View style={[styles.totalsRow, styles.totalsRowLast]}>
              <Text style={[styles.totalsLabel, { fontWeight: 700 }]}>
                {isPaid ? "Total Paid" : "Total"}
              </Text>
              <Text style={[styles.totalsValue, { fontWeight: 700 }]}>
                {formatMoney(data.total)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.closingRow}>
          <Text style={styles.confirmation}>
            {closingText(data, company.name)}
          </Text>

          {/* The stamp is the one thing on the page that only a paid order
              earns, which is the whole point of stamping it. */}
          {isPaid && paidStamp ? (
            <Image style={styles.stamp} src={paidStamp} />
          ) : null}
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerName}>{company.name}</Text>
          <Text style={styles.footerNote}>
            {isPaid
              ? "Thank you for your payment."
              : "This is a computer generated document and needs no signature."}
          </Text>
        </View>
      </Page>
    </Document>
  );
};

export default PaymentSlipPdf;
