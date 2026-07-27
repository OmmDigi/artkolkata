"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Share2,
  ShoppingCart,
  Heart,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getRequest } from "@/lib/fetcher";
import { useCartStore } from "@/store/useCartStore";
import { useWishlistStore } from "@/store/useWishlistStore";
import {
  ProductCard,
  mapApiProduct,
  ApiProduct,
} from "@/Component1/ShopSection";

const ProductPage = () => {
  const [mainImage, setMainImage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [loadingWishlist, setLoadingWishlist] = useState(false);

  const [selectedOptions, setSelectedOptions] = useState<any>({});
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [localQuantity, setLocalQuantity] = useState(1);

  const [rating, setRating] = useState<number>(1);
  const [comment, setComment] = useState<string>("");
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [expandedTab, setExpandedTab] = useState<number | null>(null);
  const params = useParams<{ slug: string | undefined }>();
  const router = useRouter();

  const imageRef = useRef<HTMLDivElement | null>(null);

  const [showLens, setShowLens] = useState(false);
  const [lensPos, setLensPos] = useState({ x: 0, y: 0 });

  const [mobileImageIndex, setMobileImageIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    const images = selectedVariant?.images?.length
      ? selectedVariant.images
      : fullProduct?.images;
    if (!images) return;

    if (isLeftSwipe) {
      setMobileImageIndex((prev) => (prev + 1) % images.length);
    }
    if (isRightSwipe) {
      setMobileImageIndex((prev) =>
        prev === 0 ? images.length - 1 : prev - 1,
      );
    }
  };

  const LENS_SIZE = 200;
  const ZOOM = 2;
  const safeImageUrl = (url?: string) =>
    url ? encodeURI(url.replace(/\+/g, "%2B")) : "";
  const {
    addToCart,
    removeFromCart,
    updateQuantity,
    cart,
    isInCart,
    getItemQty,
  } = useCartStore();

  const { wishlist, toggleWishlist } = useWishlistStore();

  const {
    isLoading: isLoadingSingleProduct,
    isError: isErrorSingleProduct,
    data: product,
    error: errorSingleProduct,
    refetch,
  } = useQuery({
    queryKey: ["All-category", params?.slug],
    queryFn: () => getRequest(`/api/v1/products/${params?.slug}`),
  });

  useEffect(() => {
    const fullProduct = (product as any)?.data;
    if (fullProduct) {
      if (fullProduct.images?.length > 0) {
        setMainImage(fullProduct.images[0].image);
      }

      if (
        fullProduct.options?.length > 0 &&
        Object.keys(selectedOptions).length === 0
      ) {
        const defaultOptions: any = {};
        fullProduct.options.forEach((opt: any) => {
          if (opt.values?.length > 0) {
            defaultOptions[opt.name] = opt.values[0].value;
          }
        });
        setSelectedOptions(defaultOptions);
      }
    }
  }, [product]);

  // 🔥 Match Variant based on selected options
  useEffect(() => {
    if ((product as any)?.data?.variants) {
      const match = (product as any)?.data?.variants.find((v: any) =>
        v.combination.every((value: string) =>
          Object.values(selectedOptions).includes(value),
        ),
      );
      setSelectedVariant(match || null);
    }
  }, [selectedOptions]);

  const fullProduct = (product as any)?.data;

  const { data: relatedData } = useQuery({
    queryKey: ["Related-Products", fullProduct?.category_slug],
    queryFn: () =>
      getRequest<{ data: ApiProduct[] }>(
        `/api/v1/products?category=${fullProduct?.category_slug}`,
      ),
    enabled: !!fullProduct?.category_slug,
  });

  const relatedProducts = relatedData?.data || [];
  const relatedMapped = relatedProducts
    .filter((p: ApiProduct) => p.slug !== params?.slug)
    .slice(0, 4)
    .map(mapApiProduct);

  useEffect(() => {
    if (selectedVariant?.images?.length > 0) {
      setMainImage(selectedVariant?.images[0].image);
    } else if (fullProduct?.images?.length > 0) {
      setMainImage(fullProduct.images[0].image);
    }
  }, [selectedVariant, fullProduct]);

  if (!product) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-xl text-black">Loading...</p>
      </div>
    );
  }

  const allOptionsSelected = fullProduct?.options?.every(
    (opt: any) => selectedOptions[opt.name],
  );
  const variantId = selectedVariant?.id || null;
  const itemAlreadyInCart = isInCart(fullProduct?.id, variantId);
  const cartQuantity = getItemQty(fullProduct?.id, variantId);
  const inWishlist = wishlist.some((w: any) => w?.id === fullProduct?.id);

  const handleWishlistClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoadingWishlist(true);
    setTimeout(() => {
      toggleWishlist(fullProduct);
      setLoadingWishlist(false);
    }, 150);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageRef.current) return;

    const rect = imageRef.current.getBoundingClientRect();

    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;

    // Clamp inside image
    x = Math.max(LENS_SIZE / 2, Math.min(x, rect.width - LENS_SIZE / 2));
    y = Math.max(LENS_SIZE / 2, Math.min(y, rect.height - LENS_SIZE / 2));

    setLensPos({ x, y });
  };

  const getAvailableStock = () => {
    if (selectedVariant) return Number(selectedVariant.quantity);
    return Number(fullProduct.available_quantity || 1);
  };

  const handleSelectOption = (name: string, value: string) => {
    setSelectedOptions((prev: any) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAddToCart = () => {
    const variantId = selectedVariant?.id || null;

    // 🛑 Requires selecting all options when variants exist
    if (fullProduct.options?.length > 0 && !allOptionsSelected) {
      alert("Select all options first!");
      return;
    }

    // Check if item with same variant already exists
    const alreadyAdded = isInCart(fullProduct.id, variantId);

    if (alreadyAdded) {
      removeFromCart(fullProduct.id, variantId);
      return;
    }

    // 🔥 Build the final cart item with variant data
    const itemToAdd = {
      ...fullProduct,
      sku: selectedVariant?.sku,
      variant_id: variantId,
      price: selectedVariant?.price || fullProduct.price,
      compare_at_price:
        selectedVariant?.compareAtPrice || fullProduct.compare_at_price,
      stock: selectedVariant?.quantity || fullProduct.available_quantity,
      images:
        selectedVariant?.images?.length > 0
          ? selectedVariant.images
          : fullProduct.images,
      options: selectedOptions,
    };
    addToCart(itemToAdd, variantId, localQuantity);
  };

  const handleBuyNow = () => {
    if (fullProduct.options?.length > 0 && !allOptionsSelected) {
      alert("Select all options first!");
      return;
    }

    const variantId = selectedVariant?.id || null;
    const alreadyAdded = isInCart(fullProduct.id, variantId);

    if (!alreadyAdded) {
      const itemToAdd = {
        ...fullProduct,
        sku: selectedVariant?.sku,
        variant_id: variantId,
        price: selectedVariant?.price || fullProduct.price,
        compare_at_price:
          selectedVariant?.compareAtPrice || fullProduct.compare_at_price,
        stock: selectedVariant?.quantity || fullProduct.available_quantity,
        images:
          selectedVariant?.images?.length > 0
            ? selectedVariant.images
            : fullProduct.images,
        options: selectedOptions,
      };
      addToCart(itemToAdd, variantId, localQuantity);
    }
    router.push("/checkout");
  };

  const openModal = (img: string) => {
    setZoomImage(img);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setZoomImage(null);
    setIsModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-2 md:py-8">
        {/* Product Grid */}
        <div className=" gap-12 mb-12">
          {/* Images Section */}
          <div className=" md:flex md:gap-10">
            {/* LEFT - Images */}
            <div className="w-full md:w-1/2 md:px-20 md:sticky md:top-2 md:h-fit z-10">
              {/* Desktop View */}
              <div className="hidden md:flex gap-4 bg-white p-4 mb-4 sticky top-8 relative">
                {/* Thumbnails */}
                <div
                  className="flex flex-col gap-3 w-12 flex-shrink-0 overflow-y-auto [&::-webkit-scrollbar]:hidden"
                  style={{
                    maxHeight: "450px",
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                  }}
                >
                  {(selectedVariant?.images?.length
                    ? selectedVariant.images
                    : fullProduct?.images
                  )?.map((img: any, index: number) => (
                    <button
                      key={index}
                      onClick={() => setMainImage(img.image)}
                      className={`w-full aspect-square overflow-hidden border-2 transition-all ${
                        mainImage === img.image
                          ? "border-[#000000]"
                          : "border-gray-200 opacity-60 hover:opacity-100"
                      }`}
                    >
                      <img
                        src={img.image}
                        className="w-full h-full object-contain bg-white"
                        alt=""
                      />
                    </button>
                  ))}
                </div>

                {/* Main Image with Magnifier */}
                <div
                  ref={imageRef}
                  className="relative bg-gray-100 overflow-hidden cursor-none"
                  style={{ width: "450px", height: "450px" }}
                  onMouseEnter={() => setShowLens(true)}
                  onMouseLeave={() => setShowLens(false)}
                  onMouseMove={handleMouseMove}
                  onClick={() => openModal(mainImage)}
                >
                  {mainImage && (
                    <img
                      src={mainImage}
                      className="w-full h-full object-contain"
                      alt="Product"
                    />
                  )}

                  <button
                    onClick={handleWishlistClick}
                    className="absolute top-4 right-4 z-10 p-2 bg-white/70 hover:bg-white rounded-full shadow-md transition-all cursor-pointer flex items-center justify-center w-10 h-10"
                  >
                    {loadingWishlist ? (
                      <div className="w-5 h-5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Heart
                        size={24}
                        fill={inWishlist ? "red" : "none"}
                        color={inWishlist ? "red" : "currentColor"}
                      />
                    )}
                  </button>

                  {/* Magnifier Lens Selection Box */}
                  {showLens && imageRef.current && (
                    <div
                      className="absolute bg-white/30 border border-gray-400 pointer-events-none cursor-crosshair z-[100]"
                      style={{
                        width: LENS_SIZE,
                        height: LENS_SIZE,
                        top: lensPos.y - LENS_SIZE / 2,
                        left: lensPos.x - LENS_SIZE / 2,
                      }}
                    />
                  )}
                </div>

                {/* Magnifier Zoom Portal (Amazon Style) */}
                {showLens &&
                  imageRef.current &&
                  (() => {
                    const imgWidth = imageRef.current.offsetWidth;
                    const imgHeight = imageRef.current.offsetHeight;
                    const PORTAL_SIZE = 500;
                    const ZOOM_RATIO = PORTAL_SIZE / LENS_SIZE;

                    return (
                      <div
                        className="absolute top-0 shadow-2xl bg-white border border-gray-200 z-999 pointer-events-none overflow-hidden hidden md:block"
                        style={{
                          left: "100%",
                          marginLeft: "1rem", // gap between image and portal
                          width: PORTAL_SIZE,
                          height: PORTAL_SIZE,
                          backgroundImage: `url(${mainImage ? encodeURI(mainImage) : ""})`,
                          backgroundRepeat: "no-repeat",
                          backgroundSize: `${imgWidth * ZOOM_RATIO}px ${imgHeight * ZOOM_RATIO}px`,
                          backgroundPosition: `-${(lensPos.x - LENS_SIZE / 2) * ZOOM_RATIO}px -${(lensPos.y - LENS_SIZE / 2) * ZOOM_RATIO}px`,
                        }}
                      />
                    );
                  })()}
              </div>

              {/* Mobile Carousel View */}
              <div className="md:hidden w-full relative mb-6">
                <div
                  className="relative w-full overflow-hidden bg-gray-100"
                  style={{ aspectRatio: "1" }}
                  onTouchStart={onTouchStart}
                  onTouchMove={onTouchMove}
                  onTouchEnd={onTouchEnd}
                >
                  {(() => {
                    const images = selectedVariant?.images?.length
                      ? selectedVariant.images
                      : fullProduct?.images;
                    if (!images?.length) return null;
                    return (
                      <div className="w-full h-full relative overflow-hidden">
                        <div
                          className="flex h-full w-full transition-transform duration-300 ease-in-out"
                          style={{
                            transform: `translateX(-${mobileImageIndex * 100}%)`,
                          }}
                        >
                          {images.map((img: any, idx: number) => (
                            <div
                              key={idx}
                              className="w-full h-full flex-shrink-0"
                            >
                              <img
                                src={img.image}
                                className="w-full h-full object-contain bg-gray-100"
                                alt={`Product ${idx}`}
                                onClick={() => openModal(img.image)}
                              />
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={handleWishlistClick}
                          className="absolute top-4 right-4 z-10 p-2 bg-white/70 hover:bg-white rounded-full shadow-md transition-all cursor-pointer flex items-center justify-center w-10 h-10"
                        >
                          {loadingWishlist ? (
                            <div className="w-5 h-5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Heart
                              size={24}
                              fill={inWishlist ? "red" : "none"}
                              color={inWishlist ? "red" : "currentColor"}
                            />
                          )}
                        </button>
                        <button
                          className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/70 hover:bg-white text-gray-800 p-1 rounded-full shadow-md transition-all z-10"
                          onClick={() =>
                            setMobileImageIndex((prev) =>
                              prev === 0 ? images.length - 1 : prev - 1,
                            )
                          }
                        >
                          <ChevronLeft size={24} />
                        </button>
                        <button
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/70 hover:bg-white text-gray-800 p-1 rounded-full shadow-md transition-all z-10"
                          onClick={() =>
                            setMobileImageIndex(
                              (prev) => (prev + 1) % images.length,
                            )
                          }
                        >
                          <ChevronRight size={24} />
                        </button>
                      </div>
                    );
                  })()}
                </div>
                {/* Dots */}
                <div className="flex justify-center mt-4 gap-2 items-center h-4">
                  {(() => {
                    const images = selectedVariant?.images?.length
                      ? selectedVariant.images
                      : fullProduct?.images;
                    return images?.map((_: any, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => setMobileImageIndex(idx)}
                        className={`rounded-full transition-all ${
                          mobileImageIndex === idx
                            ? "bg-black w-3 h-3"
                            : "bg-gray-300 w-2 h-2"
                        }`}
                        aria-label={`Go to slide ${idx + 1}`}
                      />
                    ));
                  })()}
                </div>
              </div>
            </div>

            {/* RIGHT - Product Info */}
            <div className="md:w-1/2 space-y-6 text-gray-800 relative mt-4 md:mt-0">
              <button
                onClick={() => {
                  if (navigator.share) {
                    navigator
                      .share({
                        title: fullProduct?.name,
                        url: window.location.href,
                      })
                      .catch(() => {});
                  } else {
                    navigator.clipboard.writeText(window.location.href);
                    alert("Link copied to clipboard!");
                  }
                }}
                className="absolute top-0 right-0 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition z-10"
                aria-label="Share product"
              >
                <Share2 size={20} />
              </button>
              <h4 className="text-sm md:text-xl font-bold pr-12">
                {fullProduct?.name}
              </h4>

              {/* Price */}
              <div className="flex items-center gap-3">
                <span className="text-3xl font-bold text-[#000000]">
                  ₹{selectedVariant?.price || fullProduct?.price}
                </span>

                {fullProduct?.compare_at_price && (
                  <span className="line-through text-gray-400 text-lg">
                    ₹
                    {selectedVariant?.compareAtPrice ||
                      fullProduct?.compare_at_price}
                  </span>
                )}
                <div className="flex items-center gap-1">
                  <span className="text-amber-500">★</span>
                  <span className="text-sm text-gray-600">
                    {parseFloat(fullProduct?.rating ?? "0.0").toFixed(1)} (
                    {fullProduct?.total_ratings})
                  </span>
                </div>
              </div>

              {/* Variant Options */}
              {fullProduct?.options?.map((opt: any, index: number) => (
                <div key={opt.id}>
                  <h3 className="font-semibold mb-2 text-gray-800">
                    Select {opt.name}
                  </h3>

                  <div className="flex gap-4 flex-wrap">
                    {opt.values.map((val: any) => (
                      <button
                        key={val.id}
                        onClick={() => handleSelectOption(opt.name, val.value)}
                        className={`px-4 py-2 rounded-lg border font-semibold ${
                          selectedOptions[opt.name] === val.value
                            ? "border-[#000000] text-[#000000]"
                            : "border-gray-300"
                        }`}
                      >
                        {val.value}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="text-gray-800">
                <span className=" font-bold text-[#000000]">
                  {selectedVariant?.quantity && (
                    <div>Total Stock - {selectedVariant?.quantity}</div>
                  )}
                </span>
              </div>

              {/* Quantity + Add to Cart + Buy Now */}
              <div className="flex flex-col gap-4 mt-4">
                <div className="flex justify-between items-center w-full gap-4">
                  <div className="shrink-0">
                    <div className="flex items-center gap-4">
                      <button
                        className="px-3 py-2 border rounded-lg"
                        onClick={() => {
                          if (itemAlreadyInCart) {
                            if (cartQuantity > 1) {
                              updateQuantity(
                                fullProduct.id,
                                variantId,
                                cartQuantity - 1,
                              );
                            }
                          } else {
                            if (localQuantity > 1) {
                              setLocalQuantity(localQuantity - 1);
                            }
                          }
                        }}
                      >
                        -
                      </button>

                      <span className="text-xl font-bold w-6 text-center">
                        {itemAlreadyInCart ? cartQuantity : localQuantity}
                      </span>

                      <button
                        className="px-3 py-2 border rounded-lg"
                        onClick={() => {
                          const stock = getAvailableStock();
                          if (itemAlreadyInCart) {
                            if (cartQuantity < stock) {
                              updateQuantity(
                                fullProduct.id,
                                variantId,
                                cartQuantity + 1,
                              );
                            }
                          } else {
                            if (localQuantity < stock) {
                              setLocalQuantity(localQuantity + 1);
                            }
                          }
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  {!fullProduct?.quantity || selectedVariant?.quantity > 0 ? (
                    <button
                      disabled={!allOptionsSelected}
                      onClick={handleAddToCart}
                      className={`flex-grow py-3 rounded-lg text-white font-semibold transition-colors ${
                        !allOptionsSelected
                          ? "bg-gray-300"
                          : itemAlreadyInCart
                            ? "bg-gray-500 hover:bg-gray-600"
                            : "bg-orange-500 hover:bg-orange-600"
                      }`}
                    >
                      {itemAlreadyInCart
                        ? "Remove from Cart"
                        : !allOptionsSelected
                          ? "Select a variant"
                          : "Add to Cart"}
                    </button>
                  ) : (
                    <button
                      disabled={true}
                      className="flex-grow py-3 rounded-lg text-white font-semibold bg-gray-500"
                    >
                      {"No Product Available"}
                    </button>
                  )}
                </div>

                {/* BUY NOW Button */}
                {!fullProduct?.quantity || selectedVariant?.quantity > 0 ? (
                  <button
                    disabled={!allOptionsSelected}
                    onClick={handleBuyNow}
                    className={`w-full py-3 rounded-lg text-white font-semibold transition-colors ${
                      !allOptionsSelected
                        ? "bg-gray-300"
                        : "bg-green-600 hover:bg-green-700"
                    }`}
                  >
                    BUY NOW
                  </button>
                ) : null}
              </div>
              <div>
                <h1 className="text-2xl font-bold">Description</h1>
                <div
                  style={{ whiteSpace: "pre-wrap" }}
                  dangerouslySetInnerHTML={{ __html: fullProduct?.description }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Accordion Sections */}
      </div>

      {/* Related Products Section */}
      {relatedMapped.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 py-2">
          <h2 className="text-2xl font-bold text-black mb-6">
            Related Products
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {relatedMapped.map((prod) => (
              <ProductCard key={prod.id} product={prod} />
            ))}
          </div>
        </div>
      )}

      {/* Image Modal */}
      {isModalOpen && zoomImage && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={closeModal}
        >
          <div
            className="relative max-w-2xl w-[90%]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 bg-white p-2 rounded-full"
            >
              <X />
            </button>

            <img
              src={zoomImage}
              className="w-full object-contain max-h-[80vh]"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductPage;
