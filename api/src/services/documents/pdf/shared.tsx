import path from "path";
import { Font, StyleSheet, Text, View, Image } from "@react-pdf/renderer";
import { ICompanyInfo } from "../../../utils/companyInfo";
import { IOrderDocumentBundleItem } from "../orderDocumentData";

// The four PDF core fonts have no rupee sign — pdfkit's WinAnsi tables stop at
// the euro — so every amount would come out as a box. Roboto is bundled in
// public/fonts and registered once, at import time, for that one glyph as much
// as for the look.
const FONT_DIR = path.resolve(__dirname, "../../../../public/fonts");

Font.register({
  family: "Roboto",
  fonts: [
    { src: path.join(FONT_DIR, "Roboto-Regular.ttf"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "Roboto-Bold.ttf"), fontWeight: 700 },
  ],
});

// A product name is a name, not prose: breaking it across lines with a hyphen
// invents punctuation the customer never typed.
Font.registerHyphenationCallback((word) => [word]);

export const formatMoney = (value: number) =>
  `₹${(value ?? 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// "September 15, 2026", and in IST — the store, its orders and its accountant
// are all in one timezone, while the server need not be.
export const formatDate = (value: Date | string) =>
  new Date(value).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });

export const styles = StyleSheet.create({
  page: {
    fontFamily: "Roboto",
    fontSize: 9,
    color: "#1a1a1a",
    paddingTop: 32,
    paddingBottom: 56,
    paddingHorizontal: 56,
    lineHeight: 1.45,
  },

  /* ----------------------------- letterhead ----------------------------- */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  logo: {
    width: 220,
    height: 80,
    objectFit: "contain",
    objectPositionX: "left",
  },
  // stands in for the logo when none is configured
  logoFallback: {
    fontSize: 18,
    fontWeight: 700,
    maxWidth: 220,
  },
  companyBlock: {
    width: 200,
  },
  companyName: {
    fontWeight: 700,
  },

  /* ------------------------------- title -------------------------------- */
  title: {
    fontSize: 17,
    fontWeight: 700,
    marginTop: 30,
    marginBottom: 22,
    letterSpacing: 0.3,
  },

  /* ---------------------------- address / meta --------------------------- */
  columns: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  addressColumn: {
    width: 140,
    paddingRight: 12,
  },
  columnHeading: {
    fontWeight: 700,
    marginBottom: 2,
  },
  // the buyer's own GSTIN, set apart from the address it sits under: it is a
  // tax identifier, not another line of the postal address
  gstLine: {
    marginTop: 3,
    fontWeight: 700,
  },
  metaColumn: {
    marginLeft: "auto",
    width: 192,
  },
  metaRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  metaLabel: {
    width: 97,
  },
  metaValue: {
    flex: 1,
  },

  /* -------------------------------- table -------------------------------- */
  table: {
    marginTop: 38,
  },
  tableHead: {
    flexDirection: "row",
    backgroundColor: "#000000",
    color: "#ffffff",
    fontWeight: 700,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#d9d9d9",
    borderBottomStyle: "solid",
  },
  cellProduct: {
    flex: 1,
    paddingRight: 10,
  },
  cellQuantity: {
    width: 94,
  },
  cellPrice: {
    width: 93,
  },
  // the packing slip has no price column, so its quantity sits where the price
  // would have been on the invoice — the two documents line up when stacked
  cellQuantityRight: {
    width: 93,
  },

  /* --------------------------- combo contents --------------------------- */
  // Indented under the combo's own name, smaller and grey, so the eye reads
  // them as part of that line rather than as more things being charged for.
  bundleList: {
    marginTop: 3,
    paddingLeft: 9,
  },
  bundleItem: {
    fontSize: 8,
    color: "#5c5c5c",
  },

  /* ------------------------------- totals -------------------------------- */
  totals: {
    marginLeft: "auto",
    width: 192,
  },
  totalsRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#d9d9d9",
    borderBottomStyle: "solid",
  },
  totalsRowLast: {
    borderBottomWidth: 2,
    borderBottomColor: "#000000",
  },
  totalsLabel: {
    flex: 1,
    fontWeight: 700,
  },
  totalsValue: {
    width: 95,
  },
  // the "via Flat Rate" / "(includes ₹106.63 GST)" tail that rides along with
  // an amount in a lighter weight
  totalsNote: {
    fontSize: 8,
  },
});

/**
 * Logo (or company name) on the left, the registered address block on the
 * right. Identical on both documents, which is the point — they are the same
 * letterhead.
 */
export const Letterhead = ({ company }: { company: ICompanyInfo }) => (
  <View style={styles.header}>
    {company.logo ? (
      <Image style={styles.logo} src={company.logo} />
    ) : (
      <Text style={styles.logoFallback}>{company.name}</Text>
    )}

    <View style={styles.companyBlock}>
      <Text style={styles.companyName}>{company.name}</Text>
      {company.addressLines.map((line) => (
        <Text key={line}>{line}</Text>
      ))}
      {company.gst ? <Text>GST:{company.gst}</Text> : null}
      {company.phone ? <Text>{company.phone}</Text> : null}
      {company.email ? <Text>{company.email}</Text> : null}
    </View>
  </View>
);

/** One `Label: value` line of the block that sits opposite the address. */
export const MetaRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.metaRow}>
    <Text style={styles.metaLabel}>{label}:</Text>
    <Text style={styles.metaValue}>{value}</Text>
  </View>
);

/** The customer's name and address, optionally under a "Ship To:" heading. */
/**
 * An address block on a document.
 *
 * `businessName` and `gstNumber` are the buyer's own GST registration, given
 * at checkout by a customer purchasing as a business. When there is one, the
 * registered entity is named first and the individual second, because the
 * GSTIN belongs to the company and that is who the document bills — and the
 * GSTIN is printed, because an invoice without it cannot be claimed against.
 * Both are absent on most orders, and the block then reads exactly as before.
 */
export const AddressBlock = ({
  heading,
  name,
  lines,
  email,
  phone,
  businessName,
  gstNumber,
}: {
  heading?: string;
  name: string;
  lines: string[];
  email?: string | null;
  phone?: string | null;
  businessName?: string | null;
  gstNumber?: string | null;
}) => (
  <View style={styles.addressColumn}>
    {heading ? <Text style={styles.columnHeading}>{heading}</Text> : null}
    {businessName ? (
      <Text style={{ fontWeight: 700 }}>{businessName}</Text>
    ) : null}
    <Text>{name}</Text>
    {lines.map((line, index) => (
      <Text key={`${line}-${index}`}>{line}</Text>
    ))}
    {email ? <Text>{email}</Text> : null}
    {phone ? <Text>{phone}</Text> : null}
    {gstNumber ? <Text style={styles.gstLine}>GSTIN: {gstNumber}</Text> : null}
  </View>
);

/**
 * The contents of a combo, printed under the line that sold it.
 *
 * Quantities are shown as what is actually in the parcel — the combo's own
 * quantity already multiplied in — because the person reading this is either
 * packing the box or checking what arrived in it, and neither of them should
 * have to do the multiplication.
 *
 * Renders nothing at all for an ordinary product, so every table can call it
 * on every row without asking first.
 */
export const BundleContents = ({
  items,
  lineQuantity,
}: {
  items: IOrderDocumentBundleItem[];
  lineQuantity: number;
}) => {
  if (!items || items.length === 0) return null;

  return (
    <View style={styles.bundleList}>
      {items.map((item, index) => (
        <Text key={`${item.sku ?? item.name}-${index}`} style={styles.bundleItem}>
          {"\u2022 "}
          {item.name}
          {item.variantLabel ? ` (${item.variantLabel})` : ""}
          {" \u00d7 "}
          {item.quantity * lineQuantity}
        </Text>
      ))}
    </View>
  );
};
