import ComboProducts from "@/components/ComboProducts";
import Editor from "@/components/Editor";
import LabelInput from "@/components/LabelInput";
import LabelTextArea from "@/components/LabelTextArea";
import MediaManager from "@/components/MediaManager";
import Section from "@/components/Section";
import SelectInput from "@/components/SelectInput";
import ShopifyVariants from "@/components/ShopifyVariants";
import { ButtonLoading } from "@/components/ui/button-loading";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { DEFAULT_PRODUCT_VARIANT_OPTIONS } from "@/constant";
import { useCategory } from "@/hooks/useCategory";
import { useDoMutation } from "@/hooks/useDoMutation";
import { useProduct } from "@/hooks/useProduct";
import { useProductTags } from "@/hooks/useProductTags";
import { cn } from "@/lib/utils";
import LoadingHandler from "@/middleware/LoadingHandler";
import type {
  ImageTypes,
  IProductBundleItem,
  IProductTag,
  ISubCategory,
  Option,
  Variant,
} from "@/types";
import { createSlug } from "@/utils/createSlug";
import type { OutputData } from "@editorjs/editorjs";
import { MoveLeft, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

export default function SingleProduct() {
  const params = useParams();
  const isNewProduct = params?.id == "new";
  const navigate = useNavigate();

  const [productImages, setProductImages] = useState<ImageTypes[]>([
    { image: "", alt_tag: null, type: "image" },
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
  const [newTag, setNewTag] = useState("");
  // the other products this one contains, when it is a combo
  const [bundleItems, setBundleItems] = useState<IProductBundleItem[]>([]);

  const { categoryData, isCategoryFetching } = useCategory({ limit: -1 });

  // the tag list lives in the database, so a tag created here is available to
  // every other product and to the website filters
  const { productTagData, refetchProductTags } = useProductTags();
  const { mutate: mutateTag, isLoading: isTagMutating } = useDoMutation();

  const handleAddTag = () => {
    const name = newTag.trim();

    if (name === "") return;

    const existing = productTagData.find(
      (tag) => tag.name.toLowerCase() === name.toLowerCase(),
    );

    // already in the catalogue, nothing to create, just select it
    if (existing) {
      setProductTags((prev) =>
        prev.includes(existing.name) ? prev : [...prev, existing.name],
      );
      setNewTag("");
      return;
    }

    mutateTag({
      apiPath: "/api/v1/products/tags",
      method: "post",
      formData: { name },
      onSuccess(data) {
        const created = data.data as IProductTag | null;
        const createdName = created?.name ?? name;

        setProductTags((prev) =>
          prev.includes(createdName) ? prev : [...prev, createdName],
        );
        setNewTag("");
        refetchProductTags();
      },
    });
  };

  const handleDeleteTag = (tag: IProductTag) => {
    if (
      !confirm(
        `Delete the tag "${tag.name}"? It will also be removed from every product using it.`,
      )
    )
      return;

    mutateTag({
      apiPath: "/api/v1/products/tags",
      method: "delete",
      id: tag.id,
      onSuccess() {
        setProductTags((prev) => prev.filter((t) => t !== tag.name));
        refetchProductTags();
      },
    });
  };

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
            type: item.type ?? "image",
          }))
        : [{ image: "", alt_tag: null, type: "image" }],
    );
    setHasVarient(product.available_quantity <= 0);
    setProductSlug(product.slug ?? null);
    setProductTags(Object.keys(product.tags ?? {}));
    setBundleItems(product.bundle_items ?? []);
  }, [dataUpdatedAt, isProductFetching]);

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
      .filter((item) => item.image.trim() != "")
      .map((item, index) => ({
        image: item.image.trim(),
        alt_tag: item.alt_tag,
        position: index,
        type: item.type,
      }));
    if (imagesToAdd.some((item) => item.type === "image") === false) {
      return alert("Please choose at lest one product image");
    }

    payload["images"] = imagesToAdd;

    if (hasVarient) {
      payload["options"] = varientOptionsValues.current.options;
      payload["variants"] = varientOptionsValues.current.variants.map(
        (item) => ({
          ...item,
          images: (item.images ?? [])
            .filter((image) => image.image.trim() != "")
            .map((image, index) => ({
              ...image,
              image: image.image.trim(),
              type: image.type ?? "image",
              position: index,
            })),
        }),
      );
    }

    payload["tags"] = productTags;
    // only the three columns the API stores; the rest of each row is display
    // data it looked up for the picker
    payload["bundle_items"] = bundleItems.map((item) => ({
      product_id: item.product_id,
      variant_id: item.variant_id,
      quantity: item.quantity,
    }));
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
            <div className="col-span-2 min-w-0 space-y-7">
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

                {/* Choose Multiple Product Images / Video Links Section */}
                <MediaManager
                  title="Product Media"
                  items={productImages}
                  onChange={setProductImages}
                  lockFirstItem
                  onUploadStart={() => {
                    anyImageUploading.current = true;
                  }}
                  onUploaded={() => {
                    anyImageUploading.current = false;
                  }}
                />

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
                    isAlreadyOrdered={productData[0]?.isAlreadyOrdered ?? false}
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

            <div className="sticky top-0 h-fit min-w-0 space-y-7">
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
                    {productTagData.map((tag) => {
                      const isSelected = productTags.includes(tag.name);
                      return (
                        <div
                          key={tag.id}
                          className={cn(
                            "group flex items-center rounded-full border text-sm transition-colors",
                            isSelected
                              ? "bg-green-600 text-white border-green-600"
                              : "bg-white text-gray-700 border-gray-300 hover:border-green-600",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setProductTags((prev) =>
                                isSelected
                                  ? prev.filter((t) => t !== tag.name)
                                  : [...prev, tag.name],
                              )
                            }
                            className="px-3 py-1 cursor-pointer"
                          >
                            {tag.name}
                          </button>
                          <button
                            type="button"
                            title="Delete this tag everywhere"
                            disabled={isTagMutating}
                            onClick={() => handleDeleteTag(tag)}
                            className="pr-2 opacity-0 group-hover:opacity-70 hover:opacity-100 cursor-pointer disabled:cursor-not-allowed"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-2">
                    <Input
                      value={newTag}
                      maxLength={50}
                      placeholder="Create a new tag"
                      onChange={(e) => setNewTag(e.currentTarget.value)}
                      // the product form wraps this input, so Enter here would
                      // save the whole product instead of adding the tag
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        handleAddTag();
                      }}
                    />
                    <button
                      type="button"
                      disabled={isTagMutating || newTag.trim() === ""}
                      onClick={handleAddTag}
                      className="flex items-center gap-1 rounded-md border border-gray-300 px-3 h-9 text-sm cursor-pointer hover:border-green-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Plus size={14} />
                      Add
                    </button>
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

              <Section>
                <ComboProducts
                  currentProductId={
                    isNewProduct ? undefined : Number(params?.id)
                  }
                  value={bundleItems}
                  onChange={setBundleItems}
                />
              </Section>

              <Section>
                <LabelInput
                  required
                  name="weight_kg"
                  label="Weight (KG) *"
                  placeholder="0.5"
                  type="number"
                  step="0.001"
                  defaultValue={productData[0]?.weight_kg ?? "0.5"}
                />
                <LabelInput
                  required
                  name="length_cm"
                  label="Length (CM) *"
                  placeholder="10"
                  type="number"
                  defaultValue={productData[0]?.length_cm ?? "10"}
                />
                <LabelInput
                  required
                  name="breadth_cm"
                  label="Breadth (CM) *"
                  placeholder="10"
                  type="number"
                  defaultValue={productData[0]?.breadth_cm ?? "10"}
                />
                <LabelInput
                  required
                  name="height_cm"
                  label="Height (CM) *"
                  placeholder="10"
                  type="number"
                  defaultValue={productData[0]?.height_cm ?? "10"}
                />
              </Section>
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
