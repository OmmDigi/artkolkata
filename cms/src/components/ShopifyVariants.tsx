import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp, Minus } from "lucide-react";
import { Button } from "./ui/button";
import LabelInput from "./LabelInput";
import type { ImageTypes, Option, Variant } from "@/types";
import { DEFAULT_PRODUCT_VARIANT_OPTIONS } from "@/constant";
import FilePicker from "./FilePicker";
import { Checkbox } from "./ui/checkbox";
import { useParams } from "react-router-dom";
// import { Switch } from "./ui/switch";
// import { useParams } from "react-router-dom";

interface IProps {
  varientOptionsValues: { options: Option[]; variants: Variant[] };
  originalPrice: string;
  defaultCompareAtPrice: string;
  productOptions?: Option[];
  productVariants?: Variant[];
}

export default function ShopifyVariants({
  varientOptionsValues,
  originalPrice,
  defaultCompareAtPrice,
  productOptions,
  productVariants,
}: IProps) {
  const params = useParams();
  const isNewProduct = params?.id == "new";

  const [options, setOptions] = useState<Option[]>(() => {
    if (varientOptionsValues.options.length !== 0)
      return varientOptionsValues.options;
    return DEFAULT_PRODUCT_VARIANT_OPTIONS;
  });

  const [variants, setVariants] = useState<Variant[]>(() => {
    if (varientOptionsValues.variants.length !== 0)
      return varientOptionsValues.variants;
    return [];
  });

  const [expandedVariant, setExpandedVariant] = useState<number | null>(null);
  const [expandedVariantIndex, setExpandedVariantIndex] = useState<number>(0);
  const [nextOptionId, setNextOptionId] = useState(2);
  const [nextValueId, setNextValueId] = useState(3);

  const skipNextGenerate = useRef(false);

  // Resync from fetched product data once it arrives (mount happens before fetch resolves)
  useEffect(() => {
    if (!productOptions) return;
    skipNextGenerate.current = true;
    setOptions(productOptions);
    setVariants(productVariants ?? []);
    varientOptionsValues.options = productOptions;
    varientOptionsValues.variants = productVariants ?? [];
  }, [productOptions, productVariants]);

  // Generate all variant combinations
  useEffect(() => {
    if (skipNextGenerate.current) {
      skipNextGenerate.current = false;
      return;
    }

    const generateVariants = () => {
      if (
        options.length === 0 ||
        options.some((opt) => opt.values.length === 0)
      ) {
        setVariants([]);
        return;
      }

      const combinations: string[][] = [];

      const generate = (index: number, current: string[]) => {
        if (index === options.length) {
          combinations.push([...current]);
          return;
        }

        options[index].values.forEach((val) => {
          generate(index + 1, [...current, val.value]);
        });
      };

      generate(0, []);

      setVariants((prevVariants) => {
        const newVariants = combinations.map((combo, idx) => {
          const existing = prevVariants.find(
            (v) =>
              v.combination.length === combo.length &&
              v.combination.every((val, i) => val === combo[i])
          );

          return (
            existing || {
              id: Date.now() + idx,
              combination: combo,
              isNew: true,
              price: originalPrice,
              compareAtPrice: defaultCompareAtPrice,
              quantity: "10",
              sku: combo.join(" / "),
              available: true,
              images: [],
            }
          );
        });

        varientOptionsValues.variants = newVariants;
        return newVariants;
      });
    };

    generateVariants();
  }, [options]);

  const addOption = () => {
    const optionsPayload = [
      ...options,
      {
        id: nextOptionId,
        name: `Option ${nextOptionId}`,
        values: [],
      },
    ];
    setOptions(optionsPayload);

    setNextOptionId(nextOptionId + 1);
  };

  useEffect(() => {
    varientOptionsValues.options = options;
    varientOptionsValues.variants = variants;
  }, [options, variants]);

  const removeOption = (optionId: number) => {
    setOptions(options.filter((opt) => opt.id !== optionId));
  };

  const updateOptionName = (optionId: number, name: string) => {
    setOptions(
      options.map((opt) => (opt.id === optionId ? { ...opt, name } : opt))
    );
  };

  const addValue = (optionId: number) => {
    setOptions(
      options.map((opt) => {
        if (opt.id === optionId) {
          return {
            ...opt,
            values: [...opt.values, { id: nextValueId, value: "" }],
          };
        }
        return opt;
      })
    );
    setNextValueId(nextValueId + 1);
  };

  const updateValue = (optionId: number, valueId: number, newValue: string) => {
    setOptions(
      options.map((opt) => {
        if (opt.id === optionId) {
          return {
            ...opt,
            values: opt.values.map((val) =>
              val.id === valueId ? { ...val, value: newValue } : val
            ),
          };
        }
        return opt;
      })
    );
  };

  const removeValue = (optionId: number, valueId: number) => {
    setOptions(
      options.map((opt) => {
        if (opt.id === optionId) {
          return {
            ...opt,
            values: opt.values.filter((val) => val.id !== valueId),
          };
        }
        return opt;
      })
    );
  };

  const updateVariant = (
    variantId: number,
    field: keyof Variant,
    value: string | boolean | ImageTypes[]
  ) => {
    setVariants(
      variants.map((v) => (v.id === variantId ? { ...v, [field]: value } : v))
    );
  };

  // const bulkUpdateVariants = (field: "price" | "quantity", value: string) => {
  //   setVariants(variants.map((v) => ({ ...v, [field]: value })));
  // };

  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (
    e: React.DragEvent<HTMLDivElement>,
    hoverIndex: number
  ) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === hoverIndex) return;

    if (expandedVariant !== null) {
      const updated = [...variants[expandedVariantIndex].images];
      const [moved] = updated.splice(dragIndex, 1);
      updated.splice(hoverIndex, 0, moved);
      setDragIndex(hoverIndex);

      setVariants((prev) => {
        prev[expandedVariantIndex].images = updated;
        return prev;
      });
    }
  };

  const handleDragEnd = () => {
    setDragIndex(null);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium text-gray-900">Variants Options</h2>

        {isNewProduct ? (
          <Button disabled={!isNewProduct} onClick={addOption} type="button">
            <Plus size={16} />
            Add Option
          </Button>
        ) : null}
      </div>

      <div className="space-y-4">
        {options.map((option) => (
          <div
            key={option.id}
            className="border border-gray-200 rounded-lg p-4"
          >
            <div className="flex items-center gap-3 mb-3">
              <LabelInput
                className="w-full font-semibold"
                type="text"
                value={option.name}
                onChange={(e) => updateOptionName(option.id, e.target.value)}
                placeholder="Option name (e.g., Size, Color)"
              />
              {/* <input
                type="text"
                value={option.name}
                onChange={(e) => updateOptionName(option.id, e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Option name (e.g., Size, Color)"
              /> */}
              <button
                type="button"
                onClick={() => removeOption(option.id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>

            <div className="space-y-2">
              {option.values.map((val) => (
                <div key={val.id} className="flex items-center gap-2 pl-5">
                  <LabelInput
                    value={val.value}
                    onChange={(e) =>
                      updateValue(option.id, val.id, e.target.value)
                    }
                    placeholder="Value (e.g., Small, Red)"
                  />
                  {/* <input
                    type="text"
                    value={val.value}
                    onChange={(e) =>
                      updateValue(option.id, val.id, e.target.value)
                    }
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Value (e.g., Small, Red)"
                  /> */}
                  <button
                    type="button"
                    onClick={() => removeValue(option.id, val.id)}
                    className="p-2 cursor-pointer text-red-600 rounded-lg transition-colors"
                  >
                    {/* <Trash2 size={16} /> */}
                    <Minus size={16} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addValue(option.id)}
                className="text-sm cursor-pointer text-blue-600 hover:text-blue-700 font-medium ml-5"
              >
                + Add another value
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Variants Section */}
      {variants.length > 0 && (
        <section className="space-y-2.5">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900">
                Variants ({variants.length})
              </h2>
              {/* <div className="flex gap-2">
              <input
                type="text"
                placeholder="Bulk edit price"
                className="px-3 py-2 w-32 text-sm border border-gray-300 rounded-lg"
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    bulkUpdateVariants(
                      "price",
                      (e.target as HTMLInputElement).value
                    );
                  }
                }}
              />
              <input
                type="text"
                placeholder="Bulk edit qty"
                className="px-3 py-2 w-32 text-sm border border-gray-300 rounded-lg"
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    bulkUpdateVariants(
                      "quantity",
                      (e.target as HTMLInputElement).value
                    );
                  }
                }}
              />
            </div> */}
            </div>

            <div className="space-y-2">
              {variants.map((variant, index) => (
                <div
                  key={variant.id}
                  className="border border-gray-200 rounded-lg overflow-hidden"
                >
                  <div
                    className="flex items-center justify-between p-4 hover:bg-gray-50 cursor-pointer"
                    onClick={() => {
                      setExpandedVariantIndex(index);
                      setExpandedVariant(
                        expandedVariant === variant.id ? null : variant.id
                      );
                    }}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <Checkbox
                        onClick={(e) => e.stopPropagation()}
                        checked={variant.available}
                        onCheckedChange={(checked) => {
                          updateVariant(variant.id, "available", checked);
                        }}
                        className="border-2 border-gray-700 cursor-pointer"
                      />
                      {/* <input
                        type="checkbox"
                        checked={variant.available}
                        onChange={(e) => {
                          e.stopPropagation();
                          updateVariant(
                            variant.id,
                            "available",
                            e.target.checked
                          );
                        }}
                        className="w-3 h-3 cursor-pointer text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      /> */}
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {variant.combination.join(" / ")}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-gray-600">₹ {variant.price}</span>
                        <span className="text-gray-600">
                          {variant.quantity} available
                        </span>
                      </div>
                    </div>
                    {expandedVariant === variant.id ? (
                      <ChevronUp size={20} />
                    ) : (
                      <ChevronDown size={20} />
                    )}
                  </div>

                  {expandedVariant === variant.id && (
                    <div>
                      <div className="p-4 bg-gray-50 border-t border-gray-200 grid grid-cols-2 gap-4">
                        <LabelInput
                          label="Price"
                          value={variant.price}
                          onChange={(e) =>
                            updateVariant(variant.id, "price", e.target.value)
                          }
                          placeholder="0.00"
                        />
                        {/* <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Price
                      </label>
                      <input
                        type="text"
                        value={variant.price}
                        onChange={(e) =>
                          updateVariant(variant.id, "price", e.target.value)
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="0.00"
                      />
                    </div> */}

                        <LabelInput
                          label="Compare at price"
                          value={variant.compareAtPrice}
                          onChange={(e) =>
                            updateVariant(
                              variant.id,
                              "compareAtPrice",
                              e.target.value
                            )
                          }
                          placeholder="0.00"
                        />
                        {/* <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Compare at price
                      </label>
                      <input
                        type="text"
                        value={variant.compareAtPrice}
                        onChange={(e) =>
                          updateVariant(
                            variant.id,
                            "compareAtPrice",
                            e.target.value
                          )
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="0.00"
                      />
                    </div> */}
                        <LabelInput
                          label="Quantity"
                          value={variant.quantity}
                          onChange={(e) =>
                            updateVariant(
                              variant.id,
                              "quantity",
                              e.target.value
                            )
                          }
                          placeholder="0.00"
                        />
                        {/* <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Quantity
                      </label>
                      <input
                        type="text"
                        value={variant.quantity}
                        onChange={(e) =>
                          updateVariant(variant.id, "quantity", e.target.value)
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="0"
                      />
                    </div> */}
                        {/* <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        SKU
                      </label>
                      <input
                        type="text"
                        value={variant.sku}
                        onChange={(e) =>
                          updateVariant(variant.id, "sku", e.target.value)
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="SKU"
                      />
                    </div> */}

                        <LabelInput
                          // disabled
                          label="SKU"
                          // value={variant.combination.join(" / ")}
                          value={variant.sku}
                          onChange={(e) =>
                            updateVariant(variant.id, "sku", e.target.value)
                          }
                          placeholder="SKU"
                        />
                      </div>

                      <div className="p-4 bg-gray-50 border-t border-gray-200 space-y-3.5">
                        <div className="flex items-center justify-between w-full">
                          <h2 className="font-semibold text-lg">Images</h2>
                          <Button
                            onClick={() => {
                              updateVariant(variant.id, "images", [
                                ...variant.images,
                                { image: "", alt_tag: null },
                              ]);
                            }}
                            type="button"
                          >
                            +
                          </Button>
                        </div>

                        {variant?.images?.length == 0 ? null : (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-y-2.5">
                            {variant.images.map(
                              (varientImage, varientImageIndex) => (
                                <div
                                  key={varientImageIndex}
                                  draggable
                                  onDragStart={() =>
                                    handleDragStart(varientImageIndex)
                                  }
                                  onDragOver={(e) =>
                                    handleDragOver(e, varientImageIndex)
                                  }
                                  onDragEnd={handleDragEnd}
                                  className={`flex items-center justify-center flex-col ${
                                    varientImageIndex == dragIndex
                                      ? "opacity-10"
                                      : ""
                                  }`}
                                >
                                  <FilePicker
                                    name={`image-${varientImageIndex + 1}`}
                                    className="w-36 !h-24 aspect-auto text-xs cursor-grab"
                                    fileLink={
                                      varientImage.image == ""
                                        ? undefined
                                        : varientImage.image
                                    }
                                    accept="image/*"
                                    onUploaded={(image) => {
                                      const currentVarientImages =
                                        variant.images;
                                      currentVarientImages[varientImageIndex] =
                                        {
                                          image: image?.downloadUrl ?? "",
                                          alt_tag: null,
                                        };
                                      updateVariant(
                                        variant.id,
                                        "images",
                                        currentVarientImages
                                      );
                                    }}
                                  />

                                  <button
                                    onClick={() => {
                                      updateVariant(
                                        variant.id,
                                        "images",
                                        variant.images.filter(
                                          (_, cIndex) =>
                                            cIndex !== varientImageIndex
                                        )
                                      );
                                    }}
                                    type="button"
                                    className="text-red-500 cursor-pointer underline text-sm"
                                  >
                                    Remove
                                  </button>
                                </div>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* <div className="pt-1.5 flex items-center justify-end">
            <Button onClick={handleDoneVarientOptionClick} type="button">Save</Button>
          </div> */}

          {/* <h2 className="text-sm text-center font-semibold">Total Available Quantity: {variants.reduce((prev, current) => 0 + 0).quantity}</h2> */}
        </section>
      )}
    </>
  );
}
