import { Document, Page, Text, View } from "@react-pdf/renderer";
import { ICompanyInfo } from "../../../utils/companyInfo";
import { IOrderDocumentData } from "../orderDocumentData";
import {
  AddressBlock,
  BundleContents,
  formatDate,
  Letterhead,
  MetaRow,
  styles,
} from "./shared";

interface IProps {
  data: IOrderDocumentData;
  company: ICompanyInfo;
}

// The document that goes in the box. It carries no prices at all: the person
// packing needs to know what to put in and where it goes, and the parcel should
// not tell whoever opens it what the buyer paid.
const PackingSlipPdf = ({ data, company }: IProps) => (
  <Document
    title={`Packing slip ${data.orderNumber}`}
    author={company.name}
    subject={`Packing slip for order ${data.orderNumber}`}
  >
    <Page size="A4" style={styles.page}>
      <Letterhead company={company} />

      <Text style={styles.title}>PACKING SLIP</Text>

      <View style={styles.columns}>
        {/* No email or phone: this is the delivery address, not a contact card. */}
        <AddressBlock name={data.customerName} lines={data.addressLines} />

        <View style={styles.metaColumn}>
          <MetaRow label="Order Number" value={data.orderNumber} />
          <MetaRow label="Order Date" value={formatDate(data.orderDate)} />
          <MetaRow label="Shipping Method" value={data.shippingMethod} />
        </View>
      </View>

      <View style={styles.table}>
        <View style={styles.tableHead} fixed>
          <Text style={styles.cellProduct}>Product</Text>
          <Text style={styles.cellQuantityRight}>Quantity</Text>
        </View>

        {data.items.map((item, index) => (
          <View
            key={`${item.sku ?? item.name}-${index}`}
            style={styles.tableRow}
            wrap={false}
          >
            {/* The combo and the things inside it stay in one cell, so a page
                break can never leave the contents stranded under the wrong
                product — the whole row moves or none of it does. */}
            <View style={styles.cellProduct}>
              <Text>{item.name}</Text>
              <BundleContents
                items={item.bundleItems}
                lineQuantity={item.quantity}
              />
            </View>
            <Text style={styles.cellQuantityRight}>{item.quantity}</Text>
          </View>
        ))}
      </View>
    </Page>
  </Document>
);

export default PackingSlipPdf;
