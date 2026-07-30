import Editor from "@/components/Editor";
import FilePicker from "@/components/FilePicker";
import LabelInput from "@/components/LabelInput";
import LabelTextArea from "@/components/LabelTextArea";
import Section from "@/components/Section";
import SelectInput from "@/components/SelectInput";
import ShopifyVariants from "@/components/ShopifyVariants";
import { Button } from "@/components/ui/button";
import { ButtonLoading } from "@/components/ui/button-loading";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_PRODUCT_VARIANT_OPTIONS,
  PREDEFINED_PRODUCT_TAGS,
} from "@/constant";
import { useCategory } from "@/hooks/useCategory";
import { useProduct } from "@/hooks/useProduct";
import { cn } from "@/lib/utils";
import LoadingHandler from "@/middleware/LoadingHandler";
import type { ImageTypes, ISubCategory, Option, Variant } from "@/types";
import { createSlug } from "@/utils/createSlug";
import type { OutputData } from "@editorjs/editorjs";
import { MoveLeft, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

export default function SingleProduct() {
  const params = useParams();
  const isNewProduct = params?.id == "new";
  const navigate = useNavigate();

  const [productImages, setProductImages] = useState<ImageTypes[]>([
    { image: "", alt_tag: null },
  ]);

  const [hasVarient, setHasVarient] = useState(true);

  const [productPrice, setProductPrice] = useState({
    originalPrice: "0.00",
    compairAtPrice: "0.00",
  });

  const editorData = useRef<OutputData | undefined>(undefined);

  // const [searchParams, setSearchParams] = useSearchParams();
  const [subCategoryList, setSubCategoryList] = useState<ISubCategory[]>([]);
  const [productSlug, setProductSlug] = useState<string | null>(null);
  const [productTags, setProductTags] = useState<string[]>([]);

  const { categoryData, isCategoryFetching } = useCategory();

  const {
    mutateProduct,
    isMuting,
    productData,
    isProductFetching,
    productError,
    refetchProduct,
    dataUpdatedAt,
  } = useProduct({
    enabledFetching: !isNewProduct,
    filter: {
      productId: params?.id as any,
    },
    depandencyArray: [isNewProduct, params?.id],
  });

  const varientOptionsValues = useRef<{
    options: Option[];
    variants: Variant[];
  }>({
    options: DEFAULT_PRODUCT_VARIANT_OPTIONS,
    variants: [],
  });
  const anyImageUploading = useRef<boolean>(false);

  useEffect(() => {
    if (categoryData?.[0]?.sub_categories) {
      setSubCategoryList(categoryData[0].sub_categories);
    }
  }, [isCategoryFetching, dataUpdatedAt]);

  useEffect(() => {
    const product = productData[0];

    if (!product) return;

    // console.log("product?.options", product?.options)
    // console.log("product?.variants", product?.variants)

    varientOptionsValues.current.options =
      product?.options ?? DEFAULT_PRODUCT_VARIANT_OPTIONS;
    varientOptionsValues.current.variants = product?.variants ?? [];

    editorData.current = product?.description_json ?? undefined;

    // console.log("varientOptionsValues.current", varientOptionsValues.current)

    setProductImages(
      product?.images?.length
        ? product.images.map((item) => ({
            image: item.image,
            alt_tag: item.alt_tag,
          }))
        : [{ image: "", alt_tag: null }],
    );
    setHasVarient(product.available_quantity <= 0);
    setProductSlug(product.slug ?? null);
    setProductTags(Object.keys(product.tags ?? {}));
  }, [dataUpdatedAt, isProductFetching, ]);

  const handleFormSubmit = (formData: FormData) => {
    let payload: Record<string, any> = {};
    for (const [key, value] of formData) {
      if (key.includes("image")) continue;
      if (value.toString() == "") continue;
      payload[key] = value;
    }

    if (
      hasVarient &&
      (varientOptionsValues.current.options.length == 0 ||
        varientOptionsValues.current.variants.length == 0)
    ) {
      return alert("Please fillup Variants Options options");
    }

    const imagesToAdd = productImages
      .filter((item) => item.image != "")
      .map((item, index) => ({
        image: item.image,
        alt_tag: item.alt_tag,
        position: index,
      }));
    if (imagesToAdd.length === 0) {
      return alert("Please choose at lest one product image");
    }

    payload["images"] = imagesToAdd;

    if (hasVarient) {
      payload["options"] = varientOptionsValues.current.options;
      payload["variants"] = varientOptionsValues.current.variants.map(
        (item) => ({
          ...item,
          images: item.images.map((image, index) => ({
            ...image,
            position: index,
          })),
        }),
      );
    }

    payload["tags"] = productTags;
    payload["description_json"] = editorData.current;

    if (isNewProduct) {
      mutateProduct({
        data: payload,
        type: "add",
        onSuccess() {
          navigate("/products");
        },
      });
      return;
    }

    mutateProduct({
      data: {
        id: params?.id,
        ...payload,
      },
      type: "update",
      onSuccess() {
        refetchProduct();
      },
    });
  };

  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (
    e: React.DragEvent<HTMLDivElement>,
    hoverIndex: number,
  ) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === hoverIndex) return;

    setProductImages((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(dragIndex, 1);
      updated.splice(hoverIndex, 0, moved);
      setDragIndex(hoverIndex);
      return updated;
    });
  };

  const handleDragEnd = () => {
    setDragIndex(null);
  };

  return (
    <LoadingHandler
      loading={isProductFetching}
      error={productError}
      length={isNewProduct ? 1 : productData.length}
    >
      <main className="space-y-2.5">
        <Link
          to={"/products"}
          className="font-semibold text-2xl inline-flex items-center gap-3.5 cursor-pointer hover:underline"
        >
          <MoveLeft className="mt-1" />
          <span>Add product</span>
        </Link>
        <form
          key={dataUpdatedAt}
          onSubmit={(e) => {
            e.preventDefault();
            handleFormSubmit(new FormData(e.currentTarget));
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            <div className="col-span-2 space-y-7">
              <Section>
                <SelectInput
                  name="product_for"
                  label="Product For"
                  options={[
                    {
                      text: "B2C",
                      value: "b2c",
                    },
                    {
                      text: "B2B",
                      value: "b2b",
                    },
                    {
                      text: "Both",
                      value: "both",
                    },
                  ]}
                  defaultValue={productData[0]?.product_for ?? "b2c"}
                />
                <LabelInput
                  name="sku_id"
                  label="Product ID *"
                  placeholder="TC-KZ-JH-Bird-BK"
                  defaultValue={productData[0]?.sku_id}
                />
                <LabelInput
                  required
                  name="name"
                  label="Name"
                  placeholder="Product name *"
                  defaultValue={productData[0]?.name}
                  onChange={(e) => {
                    setProductSlug(createSlug(e.currentTarget.value));
                  }}
                />
                <LabelInput
                  required
                  name="slug"
                  label="Slug"
                  placeholder="Product Slug *"
                  defaultValue={productSlug ?? ""}
                />
                {/* <MyEditor
                  // name="description"
                  onChange={(data) => {
                    // console.log(data);
                    productDescription.current = data;
                  }}
                  initialData={productData[0]?.description}
                  label="Description *"
                /> */}
                <Editor
                  label="Description *"
                  onSave={(data) => {
                    editorData.current = data;
                  }}
                  initData={productData[0]?.description_json ?? undefined}
                />
                {/* <LabelTextArea
                  required
                  name="description"
                  rows={20}
                  label="Description"
                  placeholder="Product description"
                  defaultValue={productData[0]?.description}
                /> */}

                {/* Choose Multiple Product Images Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-xl">Product Image</h2>
                    <Button
                      type="button"
                      onClick={() => {
                        setProductImages((prev) => [
                          ...prev,
                          { image: "", alt_tag: null },
                        ]);
                      }}
                    >
                      <Plus />
                      Add More Image
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
                    {productImages.map((item, index) => (
                      <div
                        draggable
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                        key={index}
                        className={`flex items-center justify-center flex-col ${
                          index == dragIndex ? "opacity-5" : ""
                        }`}
                      >
                        <FilePicker
                          name={`image-${index + 1}`}
                          className="w-36 h-24! aspect-auto text-xs cursor-grab!"
                          fileLink={item.image == "" ? undefined : item.image}
                          accept="image/*"
                          onUploadStart={() => {
                            anyImageUploading.current = true;
                          }}
                          onUploaded={(image) => {
                            anyImageUploading.current = false;
                            setProductImages((prev) => {
                              prev[index].image = image?.downloadUrl ?? "";
                              // add alt tag if you want to add
                              return prev;
                            });
                          }}
                          onRemoved={() => {
                            setProductImages((prev) => {
                              prev[index].image = "";
                              // add alt tag if you want to add
                              return prev;
                            });
                          }}
                        />

                        <button
                          disabled={index === 0}
                          onClick={() => {
                            setProductImages((prev) =>
                              prev.filter((_, cIndex) => cIndex !== index),
                            );
                          }}
                          type="button"
                          className={cn(
                            index === 0
                              ? "opacity-30"
                              : "opacity-100 cursor-pointer",
                            "text-red-500 underline text-sm",
                          )}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {isCategoryFetching ? (
                  <Label>Category Fetching..</Label>
                ) : (
                  <SelectInput
                    name="category_id"
                    label="Category *"
                    onValueChange={(value) => {
                      setSubCategoryList(
                        categoryData.find((item) => item.id == parseInt(value))
                          ?.sub_categories ?? [],
                      );
                    }}
                    options={[
                      { text: "Select Category", value: "Choose Category" },
                      ...categoryData.map((category) => ({
                        text: category.name,
                        value: category.id.toString(),
                      })),
                    ]}
                    defaultValue={
                      productData[0]?.category_id.toString() ??
                      "Choose Category"
                    }
                  />
                )}

                {subCategoryList.length === 0 ? null : (
                  <SelectInput
                    name="sub_category_id"
                    label="Sub Category"
                    options={[
                      {
                        text: "Select Sub Category",
                        value: "Choose Sub Category",
                      },
                      ...subCategoryList.map((item) => ({
                        text: item.name,
                        value: item.id.toString(),
                      })),
                    ]}
                    defaultValue={
                      productData[0]?.sub_category_id?.toString() ??
                      "Choose Sub Category"
                    }
                  />
                )}
              </Section>

              <Section>
                <LabelInput
                  required
                  name="price"
                  label="Price"
                  placeholder="₹10000"
                  type="number"
                  defaultValue={productData[0]?.price}
                  onChange={(e) => {
                    const value = e.currentTarget.value;

                    setProductPrice((prev) => ({
                      compairAtPrice: prev.compairAtPrice,
                      originalPrice: value,
                    }));
                  }}
                />
                <LabelInput
                  required
                  name="compare_at_price"
                  label="Original Price"
                  placeholder="₹20000"
                  type="number"
                  defaultValue={productData[0]?.compare_at_price}
                  onChange={(e) => {
                    const value = e.currentTarget.value;

                    setProductPrice((prev) => ({
                      compairAtPrice: value,
                      originalPrice: prev.originalPrice,
                    }));
                  }}
                />

                {/* <SelectInput
                  label="Has Variants"
                  options={[
                    {
                      text: "Yes",
                      value: `true`,
                    },
                    // {
                    //   text: "No",
                    //   value: `false`,
                    // },
                  ]}
                  defaultValue={
                    // productData[0]?.available_quantity == 0
                    //   ? "true"
                    //   : `${hasVarient}`
                    `${hasVarient}`
                  }
                  onValueChange={(value) => {
                    setHasVarient(value == "true");
                  }}
                /> */}

                {hasVarient ? null : (
                  <LabelInput
                    required
                    name="available_quantity"
                    type="number"
                    label="Available Quantity"
                    placeholder="20"
                    defaultValue={productData[0]?.available_quantity}
                  />
                )}
              </Section>

              {hasVarient ? (
                <Section>
                  <ShopifyVariants
                    varientOptionsValues={varientOptionsValues.current}
                    originalPrice={productPrice.originalPrice}
                    defaultCompareAtPrice={productPrice.compairAtPrice}
                    productOptions={productData[0]?.options}
                    productVariants={productData[0]?.variants}
                  />
                </Section>
              ) : null}

              <Section>
                <LabelInput
                  name="meta_title"
                  label="Meta Title"
                  defaultValue={productData[0]?.meta_title ?? ""}
                />
                <LabelTextArea
                  name="meta_description"
                  label="Meta Description"
                  defaultValue={productData[0]?.meta_description ?? ""}
                />
              </Section>
            </div>

            <div className="sticky top-0 h-fit space-y-7">
              <Section>
                <SelectInput
                  required
                  label="Status"
                  name="status"
                  options={[
                    {
                      text: "Public",
                      value: "1",
                    },
                    {
                      text: "Private",
                      value: "2",
                    },
                  ]}
                  defaultValue={productData[0]?.status.toString() ?? "1"}
                />

                <div className="grid gap-3">
                  <Label className="font-semibold">Tags</Label>
                  <div className="flex flex-wrap gap-2">
                    {PREDEFINED_PRODUCT_TAGS.map((tag) => {
                      const isSelected = productTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() =>
                            setProductTags((prev) =>
                              isSelected
                                ? prev.filter((t) => t !== tag)
                                : [...prev, tag],
                            )
                          }
                          className={cn(
                            "px-3 py-1 rounded-full text-sm border transition-colors cursor-pointer",
                            isSelected
                              ? "bg-green-600 text-white border-green-600"
                              : "bg-white text-gray-700 border-gray-300 hover:border-green-600",
                          )}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                  {productTags.length > 0 && (
                    <p className="text-xs text-gray-500">
                      Selected: {productTags.join(", ")}
                    </p>
                  )}
                </div>
                <LabelInput
                  name="position"
                  label="Position"
                  type="number"
                  placeholder="0"
                  defaultValue={productData[0]?.position ?? 0}
                />
              </Section>

              {/* <Section>
                <LabelInput
                  name="shipment_height"
                  label="Shipment Height (CM) *"
                  placeholder="100"
                  type="number"
                />
                <LabelInput
                  name="shipment_width"
                  label="Shipment Width (CM) *"
                  placeholder="100"
                  type="number"
                />
                <LabelInput
                  name="weight"
                  label="Weight (GMS)"
                  placeholder="10"
                  type="number"
                />
              </Section> */}
            </div>
          </div>

          <div className="flex items-center justify-end">
            <ButtonLoading loading={isMuting}>Save</ButtonLoading>
          </div>
        </form>
      </main>
    </LoadingHandler>
  );
}
