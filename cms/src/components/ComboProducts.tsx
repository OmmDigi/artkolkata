import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDebounce } from "@/hooks/useDebounce";
import type { IProductBundleItem, IProducts, IResponse, Variant } from "@/types";
import { api } from "@/utils/api";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, X } from "lucide-react";
import { useState } from "react";

interface IProps {
  // the product being edited, so a combo cannot be made to contain itself
  currentProductId?: number;
  value: IProductBundleItem[];
  onChange: (items: IProductBundleItem[]) => void;
}

// Identity of a chosen item. A variant and its parent product are two different
// things to put in a box, so the variant id is part of the key when there is
// one.
const keyOf = (productId: number, variantId: number | null) =>
  `${productId}:${variantId ?? 0}`;

const variantLabel = (variant: Variant) =>
  (variant.combination ?? []).join(" / ");

/**
 * Picks the other products a combo ships with.
 *
 * The search runs on the server rather than filtering a catalogue held in
 * memory: this form is open for a long time and the product list only grows,
 * so pulling all of it just to type into a box is the wrong trade.
 *
 * A variant is chosen at the moment the product is added, not afterwards. The
 * search response is the only place the child's variants are known, so letting
 * the choice be changed later would mean refetching each child on load — for a
 * correction that is two clicks away as remove-and-add-again.
 */
export default function ComboProducts({
  currentProductId,
  value,
  onChange,
}: IProps) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);

  // which search result has its variant list open
  const [expandedProductId, setExpandedProductId] = useState<number | null>(
    null,
  );

  const { data, isFetching } = useQuery<IResponse<IProducts[]>>({
    queryKey: ["combo-product-search", debouncedSearch],
    queryFn: async () =>
      (
        await api.get(
          `/api/v1/products?variants=true&limit=20&search=${encodeURIComponent(
            debouncedSearch,
          )}`,
        )
      ).data,
    enabled: debouncedSearch.trim().length > 0,
  });

  const chosenKeys = new Set(
    value.map((item) => keyOf(item.product_id, item.variant_id)),
  );

  const results = (data?.data ?? []).filter(
    (product) => product.id !== currentProductId,
  );

  const addItem = (product: IProducts, variant: Variant | null) => {
    const key = keyOf(product.id, variant?.id ?? null);
    if (chosenKeys.has(key)) return;

    onChange([
      ...value,
      {
        product_id: product.id,
        variant_id: variant?.id ?? null,
        quantity: 1,
        name: product.name,
        slug: product.slug,
        sku: variant?.sku ?? product.sku_id ?? null,
        variant_label: variant ? variantLabel(variant) : null,
        price: variant?.price ?? product.price ?? null,
        available_quantity: variant
          ? Number(variant.quantity)
          : product.available_quantity,
        image: product.images?.find((img) => img.type === "image")?.image ?? null,
      },
    ]);

    setExpandedProductId(null);
    setSearch("");
  };

  const removeItem = (index: number) =>
    onChange(value.filter((_, i) => i !== index));

  const setQuantity = (index: number, quantity: number) =>
    onChange(
      value.map((item, i) =>
        i === index ? { ...item, quantity: Math.max(1, quantity) } : item,
      ),
    );

  // min-w-0 runs through every wrapper below. The rows truncate long product
  // names, and truncate is white-space: nowrap — which, in a grid or flex
  // parent whose minimum size is auto, makes the full untruncated name the
  // minimum width and pushes the whole page sideways instead of clipping.
  return (
    <div className="grid gap-3 min-w-0">
      <div className="min-w-0">
        <Label className="font-semibold">Combo products</Label>
        <p className="text-xs text-gray-500 mt-1">
          The products that physically go inside this one. Leave empty for a
          normal product. Selling this will also reduce the stock of everything
          listed here, and the invoice, packing slip and payment slip will print
          the contents under this product's line.
        </p>
      </div>

      <div className="relative">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <Input
          value={search}
          placeholder="Search a product to add"
          className="pl-9"
          onChange={(e) => setSearch(e.currentTarget.value)}
          // the product form wraps this input, so Enter here would submit the
          // whole product instead of searching
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
        />
      </div>

      {search.trim() !== "" && (
        <div className="border border-gray-200 rounded-lg max-h-72 overflow-y-auto overflow-x-hidden divide-y divide-gray-100 min-w-0">
          {isFetching && (
            <p className="text-sm text-gray-500 px-3 py-2.5">Searching…</p>
          )}

          {!isFetching && results.length === 0 && (
            <p className="text-sm text-gray-500 px-3 py-2.5 break-words">
              No product matches "{search}"
            </p>
          )}

          {!isFetching &&
            results.map((product) => {
              const variants = product.variants ?? [];
              const isExpanded = expandedProductId === product.id;
              const image = product.images?.find(
                (img) => img.type === "image",
              )?.image;

              return (
                <div key={product.id} className="min-w-0">
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left cursor-pointer hover:bg-gray-50"
                    onClick={() => {
                      // a product with variants has to say which one goes in
                      // the box before it can be added
                      if (variants.length === 0) {
                        addItem(product, null);
                        return;
                      }
                      setExpandedProductId(isExpanded ? null : product.id);
                    }}
                  >
                    {image ? (
                      <img
                        src={image}
                        alt=""
                        className="aspect-square w-9 object-cover rounded-md border border-gray-200"
                      />
                    ) : (
                      <div className="aspect-square w-9 rounded-md bg-gray-100" />
                    )}

                    <span className="flex-1 min-w-0">
                      <span className="block text-sm truncate">
                        {product.name}
                      </span>
                      <span className="block text-xs text-gray-500 truncate">
                        {product.sku_id ? `${product.sku_id} · ` : ""}
                        {variants.length > 0
                          ? `${variants.length} variants`
                          : `${product.available_quantity ?? 0} in stock`}
                      </span>
                    </span>

                    <Plus size={15} className="text-gray-400 shrink-0" />
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-2.5 pl-[60px] flex flex-wrap gap-1.5">
                      {variants.map((variant) => {
                        const isChosen = chosenKeys.has(
                          keyOf(product.id, variant.id),
                        );
                        return (
                          <button
                            key={variant.id}
                            type="button"
                            disabled={isChosen}
                            onClick={() => addItem(product, variant)}
                            className="rounded-full border border-gray-300 px-3 py-1 text-xs cursor-pointer hover:border-green-600 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {variantLabel(variant) || variant.sku}
                            <span className="text-gray-400">
                              {" "}
                              ({variant.quantity})
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {value.length > 0 && (
        <ul className="grid gap-2 min-w-0">
          {value.map((item, index) => (
            <li
              key={keyOf(item.product_id, item.variant_id)}
              className="flex items-start gap-3 border border-gray-200 rounded-lg px-3 py-2.5 min-w-0"
            >
              {item.image ? (
                <img
                  src={item.image}
                  alt=""
                  className="aspect-square w-9 object-cover rounded-md border border-gray-200"
                />
              ) : (
                <div className="aspect-square w-9 rounded-md bg-gray-100" />
              )}

              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">
                  {item.name}
                  {item.variant_label ? (
                    <span className="text-gray-500">
                      {" "}
                      ({item.variant_label})
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {item.sku ? `${item.sku} · ` : ""}
                  {item.available_quantity} in stock
                </p>

                {/* Under the name rather than off to the right: this column is
                    narrow, and a field sharing the row with the name left both
                    of them squeezed. */}
                <div className="flex items-center gap-1.5 mt-2">
                  <Label className="text-xs text-gray-500">Qty</Label>
                  <Input
                    type="number"
                    min={1}
                    value={item.quantity}
                    className="w-16 h-8"
                    onChange={(e) =>
                      setQuantity(index, parseInt(e.currentTarget.value) || 1)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.preventDefault();
                    }}
                  />
                </div>
              </div>

              <button
                type="button"
                title="Remove from this combo"
                onClick={() => removeItem(index)}
                className="cursor-pointer text-gray-400 hover:text-red-600 shrink-0"
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
