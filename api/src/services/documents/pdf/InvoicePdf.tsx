import { Document, Page, Text, View } from "@react-pdf/renderer";
import { ICompanyInfo } from "../../../utils/companyInfo";
import { IOrderDocumentData } from "../orderDocumentData";
import {
  AddressBlock,
  BundleContents,
  formatDate,
  formatMoney,
  Letterhead,
  MetaRow,
  styles,
} from "./shared";

interface IProps {
  data: IOrderDocumentData;
  company: ICompanyInfo;
  invoiceNumber: string;
  invoiceDate: Date;
}

// GST is already inside every price, so the invoice reports it as part of the
// total instead of adding a line to it. Saying so on the total row is what
// keeps the arithmetic on the page honest.
const InvoicePdf = ({ data, company, invoiceNumber, invoiceDate }: IProps) => (
  <Document
    title={`Invoice ${invoiceNumber}`}
    author={company.name}
    subject={`Invoice for order ${data.orderNumber}`}
  >
    <Page size="A4" style={styles.page}>
      <Letterhead company={company} />

      <Text style={styles.title}>INVOICE</Text>

      <View style={styles.columns}>
        {/* Billed to and shipped to are the same address: checkout collects one.
            Both are printed because an invoice is read by people who expect to
            find both, and the day billing splits off only this block changes. */}
        <AddressBlock
          name={data.customerName}
          lines={data.addressLines}
          email={data.customerEmail}
          phone={data.customerPhone}
        />
        <AddressBlock
          heading="Ship To:"
          name={data.customerName}
          lines={data.addressLines}
          email={data.customerEmail}
          phone={data.customerPhone}
        />

        <View style={styles.metaColumn}>
          <MetaRow label="Invoice Number" value={invoiceNumber} />
          <MetaRow label="Invoice Date" value={formatDate(invoiceDate)} />
          <MetaRow label="Order Number" value={data.orderNumber} />
          <MetaRow label="Order Date" value={formatDate(data.orderDate)} />
          <MetaRow label="Payment Method" value={data.paymentMethodLabel} />
        </View>
      </View>

      <View style={styles.table}>
        <View style={styles.tableHead} fixed>
          <Text style={styles.cellProduct}>Product</Text>
          <Text style={styles.cellQuantity}>Quantity</Text>
          <Text style={styles.cellPrice}>Price</Text>
        </View>

        {data.items.map((item, index) => (
          <View
            key={`${item.sku ?? item.name}-${index}`}
            style={styles.tableRow}
            wrap={false}
          >
            {/* A combo's contents are listed but never priced: the combo is one
                charged line, and putting amounts next to what is inside it
                would read as a second set of charges. */}
            <View style={styles.cellProduct}>
              <Text>{item.name}</Text>
              <BundleContents
                items={item.bundleItems}
                lineQuantity={item.quantity}
              />
            </View>
            <Text style={styles.cellQuantity}>{item.quantity}</Text>
            <Text style={styles.cellPrice}>{formatMoney(item.price)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.totals}>
        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>Subtotal</Text>
          <Text style={styles.totalsValue}>{formatMoney(data.subtotal)}</Text>
        </View>

        {/* Discount rows are printed only when they fired — an invoice showing
            "Discount ₹0.00" makes the customer look for the one they missed. */}
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
          <Text style={styles.totalsLabel}>Shipping</Text>
          <Text style={styles.totalsValue}>
            {formatMoney(data.shipping)}
            <Text style={styles.totalsNote}> via {data.shippingMethod}</Text>
          </Text>
        </View>

        <View style={[styles.totalsRow, styles.totalsRowLast]}>
          <Text style={styles.totalsLabel}>Total</Text>
          <Text style={styles.totalsValue}>
            <Text style={{ fontWeight: 700 }}>{formatMoney(data.total)}</Text>
            <Text style={styles.totalsNote}>
              {" "}
              (includes {formatMoney(data.gstAmount)} GST)
            </Text>
          </Text>
        </View>
      </View>
    </Page>
  </Document>
);

export default InvoicePdf;
