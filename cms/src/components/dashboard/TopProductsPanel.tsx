import type { IAnalyticsTopProduct } from "@/types";
import { formatCount, formatMoney } from "@/utils/formatAnalytics";
import HorizontalBars, { type IBarDatum } from "./HorizontalBars";

interface IProps {
  products: IAnalyticsTopProduct[];
}

export default function TopProductsPanel({ products }: IProps) {
  const data: IBarDatum[] = products.map((product, index) => ({
    // product_id is null for a legacy order line whose snapshot carried no id,
    // and two of those would collide on a shared key.
    key: product.product_id ? `product-${product.product_id}` : `row-${index}`,
    label: product.product_name,
    value: product.units_sold,
    valueLabel: `${formatCount(product.units_sold)} sold`,
    sublabel: `${formatMoney(product.revenue)} · ${formatCount(product.order_count)} ${
      product.order_count === 1 ? "order" : "orders"
    }`,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-gray-900">Top products</h3>
        <p className="text-xs text-gray-500">
          By units sold. Variants are counted under their parent product, and the
          name is the one recorded when the order was placed.
        </p>
      </div>

      <HorizontalBars data={data} emptyMessage="No products sold in this period" />
    </div>
  );
}
