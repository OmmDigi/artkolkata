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
  Play,
  Star,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getRequest, postRequest } from "@/lib/fetcher";
import { useCartStore } from "@/store/useCartStore";
import { toast } from "react-toastify";
import { useIsLoggedIn } from "@/store/useUserStore";
import { useWishlistStore } from "@/store/useWishlistStore";
import {
  ProductCard,
  mapApiProduct,
  ApiProduct,
} from "@/Component1/ShopSection";

import { CollapsibleDescription } from "@/app/Component/CollapsibleDescription";
import EditorJsDescription from "@/app/Component/EditorJsDescription";
import ProductReviewSummary from "@/app/Component/ProductReviewSummary";
import CustomImage from "@/Component1/CustomImage";
import { processImageUrl } from "@/lib/utils";

const ProductPage = () => {
  const [mainImage, setMainImage] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [zoomMedia, setZoomMedia] = useState<any>(null);
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
  const isLoggedIn = useIsLoggedIn();

  const imageRef = useRef<HTMLDivElement | null>(null);
  const thumbnailRef = useRef<HTMLDivElement | null>(null);
  const reviewsRef = useRef<HTMLDivElement | null>(null);
  const relatedScrollRef = useRef<HTMLDivElement | null>(null);
  const mostPopularScrollRef = useRef<HTMLDivElement | null>(null);

  const scrollRelated = (direction: "left" | "right") => {
    if (relatedScrollRef.current) {
      const scrollAmount = 300;
      relatedScrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const scrollMostPopular = (direction: "left" | "right") => {
    if (mostPopularScrollRef.current) {
      const scrollAmount = 300;
      mostPopularScrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#reviews") {
      const timeoutId = setTimeout(() => {
        reviewsRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 500); // Wait for render
      return () => clearTimeout(timeoutId);
    }
  }, []);

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

  const { toggleWishlist, isInWishlist } = useWishlistStore();

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
        setMainImage(fullProduct.images[0]);
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

  //  Match Variant based on selected options
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
        `/api/v1/products?category=${fullProduct?.category_slug}&limit=-1`,
      ),
    enabled: !!fullProduct?.category_slug,
  });
  const { data: mostPopularData } = useQuery({
    queryKey: ["Most Popular Products"],
    queryFn: () =>
      getRequest<{ data: ApiProduct[] }>(
        `/api/v1/products?tag=${encodeURI("Best Seller")}&variants=true&limit=-1`,
      ),
  });

  const relatedProducts = relatedData?.data || [];
  const relatedMapped = relatedProducts
    .filter((p: ApiProduct) => p.slug !== params?.slug)
    .map(mapApiProduct);

  const mostPopularProducts = mostPopularData?.data || [];
  const mostPopularMapped = mostPopularProducts
    .filter((p: ApiProduct) => p.slug !== params?.slug)
    .map(mapApiProduct);

  const {
    data: productReviewData,
    isLoading: loadingProductReview,
    error: errorProductReview,
    refetch: mutateProductReview,
  } = useQuery({
    queryKey: ["Product-Reviews", fullProduct?.id],
    queryFn: () =>
      getRequest(`/api/v1/products/reviews?product_id=${fullProduct?.id}`),
    enabled: !!fullProduct?.id,
  });
  const productReview = productReviewData as any;

  let allReviews: any[] = [];
  if (productReview) {
    if (Array.isArray(productReview)) {
      allReviews = [...productReview];
    } else if (Array.isArray(productReview.data)) {
      allReviews = [...productReview.data];
    }
  }

  const ratingCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  allReviews.forEach((r) => {
    const starVal = Number(r.stars);
    if (starVal >= 1 && starVal <= 5) {
      ratingCounts[starVal as keyof typeof ratingCounts]++;
    }
  });

  const [showRatingPopover, setShowRatingPopover] = useState(false);
  const [isUpdatingQty, setIsUpdatingQty] = useState(false);

  const trimMessage = (message: string, wordCount: number) => {
    if (!message) return "";
    const words = message.split(" ");
    if (words.length <= wordCount) return message;
    return words.slice(0, wordCount).join(" ") + "...";
  };

  useEffect(() => {
    if (selectedVariant?.images?.length > 0) {
      setMainImage(selectedVariant?.images[0]);
    } else if (fullProduct?.images?.length > 0) {
      setMainImage(fullProduct.images[0]);
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
  const inWishlist = isInWishlist(fullProduct?.id);

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

  const openModal = (media: any) => {
    setZoomMedia(media);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setZoomMedia(null);
    setIsModalOpen(false);
  };

  const getThumbnail = (img: any) => {
    if (img?.type === "video") {
      const match = img.image.match(
        /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/,
      );
      const videoId = match ? match[1] : "";
      return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    }
    return img?.image;
  };

  const scrollThumbnails = (direction: "up" | "down") => {
    if (thumbnailRef.current) {
      const scrollAmount = 150;
      thumbnailRef.current.scrollBy({
        top: direction === "up" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const currentImages = [
    ...(selectedVariant?.images || []),
    ...(fullProduct?.images || []),
  ].filter(
    (img, index, self) =>
      index === self.findIndex((t) => t.image === img.image),
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-[1600px] mx-auto px-4 py-2 md:py-8">
        {/* Product Grid */}
        <div className=" gap-12 mb-12">
          {/* Images Section */}
          <div className=" md:flex md:gap-20">
            {/* LEFT - Images */}
            <div className="w-full md:w-1/2 md:px-2 md:sticky md:top-2 md:h-fit z-10">
              {/* Desktop View */}
              <div className="hidden md:flex gap-4 bg-white p-4 mb-4 sticky top-8 relative">
                {/* Thumbnails */}
                <div className="relative flex flex-col items-center w-14 flex-shrink-0">
                  {currentImages.length > 7 && (
                    <button
                      onClick={() => scrollThumbnails("up")}
                      className="mb-1 p-1 bg-gray-200 rounded-full hover:bg-gray-300 z-10"
                    >
                      <ChevronDown
                        className="rotate-180 text-gray-700"
                        size={16}
                      />
                    </button>
                  )}
                  <div
                    ref={thumbnailRef}
                    className="flex flex-col gap-1 w-full overflow-y-auto [&::-webkit-scrollbar]:hidden"
                    style={{
                      maxHeight: "450px",
                      scrollbarWidth: "none",
                      msOverflowStyle: "none",
                    }}
                  >
                    {currentImages.map((img: any, index: number) => (
                      <button
                        key={index}
                        onMouseEnter={() => setMainImage(img)}
                        className={`w-full aspect-square overflow-hidden border-2 transition-all relative ${
                          mainImage?.image === img.image
                            ? "border-[#000000]"
                            : "border-gray-200 opacity-100 hover:opacity-100"
                        }`}
                      >
                        <CustomImage
                          src={processImageUrl(getThumbnail(img))}
                          className="w-full h-full object-contain bg-white"
                          alt=""
                        />
                        {img.type === "video" && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                            <div className="w-6 h-6 bg-red-600 rounded-full flex items-center justify-center">
                              <div className="w-0 h-0 border-t-4 border-t-transparent border-l-6 border-l-white border-b-4 border-b-transparent ml-0.5"></div>
                            </div>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                  {currentImages.length > 8 && (
                    <button
                      onClick={() => scrollThumbnails("down")}
                      className="mt-1 p-1 bg-gray-200 rounded-full hover:bg-gray-300 z-10"
                    >
                      <ChevronDown className="text-gray-700" size={16} />
                    </button>
                  )}
                </div>

                {/* Main Image with Magnifier */}
                <div
                  ref={imageRef}
                  className={`relative bg-gray-100 overflow-hidden ${mainImage?.type === "video" ? "cursor-pointer" : "cursor-none"}`}
                  style={{ width: "450px", height: "450px" }}
                  onMouseEnter={() =>
                    mainImage?.type !== "video" && setShowLens(true)
                  }
                  onMouseLeave={() => setShowLens(false)}
                  onMouseMove={(e) =>
                    mainImage?.type !== "video" && handleMouseMove(e)
                  }
                  onClick={() => openModal(mainImage)}
                >
                  {mainImage && (
                    <>
                      <CustomImage
                        src={processImageUrl(getThumbnail(mainImage))}
                        className="w-full h-full object-contain"
                        alt="Product"
                      />
                      {mainImage.type === "video" && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                          <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center shadow-lg">
                            <div className="w-0 h-0 border-t-[12px] border-t-transparent border-l-[20px] border-l-white border-b-[12px] border-b-transparent ml-2"></div>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <button
                    onClick={handleWishlistClick}
                    className="absolute top-4 right-4 z-10 p-2 bg-white/70 hover:bg-white rounded-full shadow-md transition-all cursor-pointer flex items-center justify-center w-10 h-10"
                  >
                    {loadingWishlist ? (
                      <div className="w-5 h-5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Heart
                        className="text-gray-700"
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
                          backgroundImage: `url(${mainImage ? encodeURI(getThumbnail(mainImage)) : ""})`,
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
                    const images = currentImages;
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
                              className="w-full h-full flex-shrink-0 relative cursor-pointer"
                              onClick={() => openModal(img)}
                            >
                              <CustomImage
                                src={processImageUrl(getThumbnail(img))}
                                className="w-full h-full object-contain bg-gray-100"
                                alt={`Product ${idx}`}
                              />
                              {img.type === "video" && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/10 pointer-events-none">
                                  <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center shadow-lg">
                                    <div className="w-0 h-0 border-t-[8px] border-t-transparent border-l-[14px] border-l-white border-b-[8px] border-b-transparent ml-1"></div>
                                  </div>
                                </div>
                              )}
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
                              className="text-gray-700"
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
                    const images = currentImages;
                    return images?.map((img: any, idx: number) => {
                      if (img?.type === "video") {
                        return (
                          <button
                            key={idx}
                            onClick={() => setMobileImageIndex(idx)}
                            className={`flex items-center justify-center rounded-full transition-all ${
                              mobileImageIndex === idx
                                ? "bg-black text-white w-4 h-4"
                                : "bg-gray-300 text-gray-500 w-3 h-3"
                            }`}
                            aria-label={`Go to video ${idx + 1}`}
                          >
                            <Play size={10} fill="currentColor" />
                          </button>
                        );
                      }
                      return (
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
                      );
                    });
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
              <div className="flex flex-col gap-1">
                {(() => {
                  const currentPrice = Number(
                    selectedVariant?.price || fullProduct?.price || 0,
                  );
                  const comparePrice = Number(
                    selectedVariant?.compareAtPrice ||
                      fullProduct?.compare_at_price ||
                      0,
                  );
                  const discountPercentage =
                    comparePrice > currentPrice
                      ? Math.round(
                          ((comparePrice - currentPrice) / comparePrice) * 100,
                        )
                      : 0;

                  return (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-3">
                        {discountPercentage > 0 && (
                          <span className="text-3xl text-[#cc0c39] font-light">
                            -{discountPercentage}%
                          </span>
                        )}
                        <span className="text-3xl font-medium text-gray-900">
                          <span className="text-lg align-top relative top-1">
                            ₹
                          </span>
                          {currentPrice.toLocaleString("en-IN")}
                        </span>
                      </div>

                      {comparePrice > 0 && comparePrice > currentPrice && (
                        <div className="text-sm text-gray-500 font-medium mt-1">
                          M.R.P.:{" "}
                          <span className="line-through">
                            ₹{comparePrice.toLocaleString("en-IN")}
                          </span>
                        </div>
                      )}

                      <div className="text-sm text-gray-800 font-medium">
                        Inclusive of all taxes
                      </div>
                      <div className="text-sm text-green-700 font-semibold mt-1 bg-green-50 w-fit px-2 py-1 rounded">
                        5% additional discount for above 1 lakh
                      </div>
                    </div>
                  );
                })()}

                <div className="relative inline-block ">
                  <div className="flex items-center gap-1 cursor-pointer group">
                    <span className="text-sm font-medium text-gray-700">
                      {parseFloat(fullProduct?.rating ?? "0.0").toFixed(1)}
                    </span>
                    <div className="flex text-amber-500 gap-1 py-3 ">
                      <div className="flex text-amber-500">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            onClick={() =>
                              setShowRatingPopover(!showRatingPopover)
                            }
                            key={star}
                            size={16}
                            className={
                              star <=
                              Math.round(
                                Number(
                                  parseFloat(fullProduct?.rating ?? "0.0"),
                                ),
                              )
                                ? "fill-amber-500 text-amber-500"
                                : "text-amber-500"
                            }
                          />
                        ))}
                      </div>
                      <ChevronDown
                        onMouseEnter={() => setShowRatingPopover(true)}
                        onMouseLeave={() => setShowRatingPopover(false)}
                        size={22}
                        onClick={() => setShowRatingPopover(!showRatingPopover)}
                        className="text-gray-600  hover:text-red-500"
                      />
                      <span
                        onClick={() => {
                          router.push(window.location.pathname + "#reviews");
                          setTimeout(() => {
                            document
                              .getElementById("reviews")
                              ?.scrollIntoView({ behavior: "smooth" });
                          }, 100);
                        }}
                        className="text-sm text-blue-600 hover:text-red-500 hover:underline"
                      >
                        ( {fullProduct?.total_ratings || allReviews.length})
                      </span>
                    </div>
                  </div>

                  {showRatingPopover && (
                    <div
                      className="absolute top-full left-0 z-50 bg-white p-5 border border-gray-300 rounded shadow-2xl w-[320px] mt-[-10]"
                      onMouseEnter={() => setShowRatingPopover(true)}
                      onMouseLeave={() => setShowRatingPopover(false)}
                    >
                      {/* Arrow / pointer for the popover */}
                      <div className="absolute -top-[9px] left-8 w-4 h-4 bg-white border-t border-l border-gray-300 transform rotate-45"></div>

                      <div className="relative z-10">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="flex text-amber-500">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  size={22}
                                  className={
                                    star <=
                                    Math.round(
                                      Number(
                                        parseFloat(
                                          fullProduct?.rating ?? "0.0",
                                        ),
                                      ),
                                    )
                                      ? "fill-amber-500 text-amber-500"
                                      : "text-amber-500"
                                  }
                                />
                              ))}
                            </div>
                            <span className="font-bold text-lg text-gray-800">
                              {parseFloat(fullProduct?.rating ?? "0.0").toFixed(
                                1,
                              )}{" "}
                              out of 5
                            </span>
                          </div>
                          <button
                            onClick={() => setShowRatingPopover(false)}
                            className="text-gray-400 hover:text-gray-800 rounded p-1"
                          >
                            <X size={18} />
                          </button>
                        </div>

                        <div className="text-gray-500 text-[15px] mb-4">
                          {fullProduct?.total_ratings || allReviews.length}{" "}
                          global ratings
                        </div>

                        <div className="flex flex-col gap-3">
                          {[5, 4, 3, 2, 1].map((star) => {
                            const count =
                              ratingCounts[star as keyof typeof ratingCounts] ||
                              0;
                            const total = allReviews.length || 1;
                            const percentage = Math.round(
                              (count / total) * 100,
                            );
                            return (
                              <div
                                key={star}
                                className="flex items-center gap-3 text-sm text-blue-700 hover:text-red-600 hover:underline cursor-pointer font-medium group"
                              >
                                <div className="w-12 whitespace-nowrap">
                                  {star} star
                                </div>
                                <div className="flex-1 h-[16px] bg-gray-100 border border-gray-400 rounded-sm overflow-hidden flex shadow-inner group-hover:border-red-500">
                                  <div
                                    className="h-full bg-amber-500 transition-all duration-500 border-r border-gray-400"
                                    style={{ width: `${percentage}%` }}
                                  ></div>
                                </div>
                                <div className="w-10 text-right">
                                  {percentage}%
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="border-t border-gray-200 mt-5 pt-3 text-center">
                          <button
                            onClick={() => {
                              setShowRatingPopover(false);
                              router.push(
                                window.location.pathname + "#reviews",
                              );
                              setTimeout(() => {
                                document
                                  .getElementById("reviews")
                                  ?.scrollIntoView({ behavior: "smooth" });
                              }, 100);
                            }}
                            className="text-sm font-medium text-blue-700 hover:text-red-600 hover:underline inline-flex items-center gap-1"
                          >
                            See customer reviews <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Variant Options */}
              {fullProduct?.variants?.length > 1 &&
                fullProduct?.options?.map((opt: any, index: number) => (
                  <div key={opt.id}>
                    <h3 className="font-semibold mb-2 text-gray-800">
                      Select {opt.name}
                    </h3>

                    <div className="flex gap-4 flex-wrap">
                      {opt.values.map((val: any) => (
                        <button
                          key={val.id}
                          onClick={() =>
                            handleSelectOption(opt.name, val.value)
                          }
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
                        className="px-3 py-2 border rounded-lg disabled:opacity-50"
                        disabled={isUpdatingQty}
                        onClick={() => {
                          setIsUpdatingQty(true);
                          setTimeout(() => {
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
                            setIsUpdatingQty(false);
                          }, 400);
                        }}
                      >
                        -
                      </button>

                      <div className="w-8 flex items-center justify-center">
                        {isUpdatingQty ? (
                          <div className="w-5 h-5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <span className="text-xl font-bold text-center">
                            {itemAlreadyInCart ? cartQuantity : localQuantity}
                          </span>
                        )}
                      </div>

                      <button
                        className="px-3 py-2 border rounded-lg disabled:opacity-50"
                        disabled={isUpdatingQty}
                        onClick={() => {
                          setIsUpdatingQty(true);
                          setTimeout(() => {
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
                            setIsUpdatingQty(false);
                          }, 400);
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
                <h1 className="text-2xl font-bold mb-4">Description</h1>
                {fullProduct?.description_json ? (
                  <EditorJsDescription data={fullProduct.description_json} />
                ) : (
                  // <CollapsibleDescription
                  //   htmlContent={fullProduct?.description || ""}
                  // />
                  <p className="text-gray-500 text-sm">No description</p>
                )}
              </div>

              {/* Feature Icons */}
              <div className="flex overflow-x-auto gap-4 py-4 scrollbar-hide my-4 border-y border-gray-200">
                <div className="flex flex-shrink-0 items-start text-center w-[90px] flex-col gap-2">
                  <div className="h-[35px] flex items-center justify-center w-full">
                    <img
                      src="/icons/icon-cod.png"
                      className="h-[35px] w-[35px] object-contain mx-auto"
                      alt="Pay on Delivery"
                    />
                  </div>
                  <span className="text-xs text-blue-600 hover:text-red-500 hover:underline cursor-pointer leading-tight w-full">
                    Pay on Delivery
                  </span>
                </div>

                <div className="flex flex-shrink-0 items-start text-center w-[90px] flex-col gap-2">
                  <div className="h-[35px] flex items-center justify-center w-full">
                    <img
                      src="/icons/icon-free-shipping.png"
                      className="h-[35px] w-[35px] object-contain mx-auto"
                      alt="Free Delivery"
                    />
                  </div>
                  <span className="text-xs text-blue-600 hover:text-red-500 hover:underline cursor-pointer leading-tight w-full">
                    Free Delivery
                  </span>
                </div>

                <div className="flex flex-shrink-0 items-start text-center w-[90px] flex-col gap-2">
                  <div className="h-[35px] flex items-center justify-center w-full">
                    <img
                      src="/icons/icon-secure-payment.png"
                      className="h-[35px] w-[35px] object-contain mx-auto"
                      alt="Secure transaction"
                    />
                  </div>
                  <span className="text-xs text-blue-600 hover:text-red-500 hover:underline cursor-pointer leading-tight w-full">
                    Secure transaction
                  </span>
                </div>

                <div className="flex flex-shrink-0 items-start text-center w-[90px] flex-col gap-2">
                  <div className="h-[35px] flex items-center justify-center w-full">
                    <img
                      src="/icons/icon-top-brand._CB562506657_.png"
                      className="h-[35px] w-[35px] object-contain mx-auto"
                      alt="Top Brand"
                    />
                  </div>
                  <span className="text-xs text-blue-600 hover:text-red-500 hover:underline cursor-pointer leading-tight w-full">
                    Top Brand
                  </span>
                </div>

                <div className="flex flex-shrink-0 items-start text-center w-[90px] flex-col gap-2">
                  <div className="h-[35px] flex items-center justify-center w-full">
                    <img
                      src="/icons/icon-warranty._CB485935626_.png"
                      className="h-[35px] w-[35px] object-contain mx-auto"
                      alt="1 Year Warranty"
                    />
                  </div>
                  <span className="text-xs text-blue-600 hover:text-red-500 hover:underline cursor-pointer leading-tight w-full">
                    1 Year Warranty
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Accordion Sections */}
      </div>

      {/* Related Products Section */}
      {relatedMapped.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 py-2 relative">
          <h2 className="text-2xl font-bold text-black mb-6">
            Related Products
          </h2>
          <div className="relative group">
            <button
              onClick={() => scrollRelated("left")}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 bg-white shadow-lg border border-gray-200 rounded-full p-2 text-gray-700 hover:text-black hover:bg-gray-50 opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex items-center justify-center cursor-pointer"
            >
              <ChevronLeft size={24} />
            </button>
            <div
              ref={relatedScrollRef}
              className="flex overflow-x-auto gap-4 md:gap-6 pb-4 snap-x snap-mandatory scrollbar-hide"
            >
              {relatedMapped.map((prod) => (
                <div
                  key={prod.id}
                  className="min-w-[50vw] sm:min-w-[30vw] md:min-w-[25vw] lg:min-w-[20vw] snap-start flex-shrink-0"
                >
                  <ProductCard product={prod} />
                </div>
              ))}
            </div>
            <button
              onClick={() => scrollRelated("right")}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 bg-white shadow-lg border border-gray-200 rounded-full p-2 text-gray-700 hover:text-black hover:bg-gray-50 opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex items-center justify-center cursor-pointer"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        </div>
      )}

      {mostPopularMapped.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 py-2 relative">
          <h2 className="text-2xl font-bold text-black mb-6">
            Most Popular Products
          </h2>
          <div className="relative group">
            <button
              onClick={() => scrollMostPopular("left")}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 bg-white shadow-lg border border-gray-200 rounded-full p-2 text-gray-700 hover:text-black hover:bg-gray-50 opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex items-center justify-center cursor-pointer"
            >
              <ChevronLeft size={24} />
            </button>
            <div
              ref={mostPopularScrollRef}
              className="flex overflow-x-auto gap-4 md:gap-6 pb-4 snap-x snap-mandatory scrollbar-hide"
            >
              {mostPopularMapped.map((prod) => (
                <div
                  key={prod.id}
                  className="min-w-[50vw] sm:min-w-[30vw] md:min-w-[25vw] lg:min-w-[20vw] snap-start flex-shrink-0"
                >
                  <ProductCard product={prod} />
                </div>
              ))}
            </div>
            <button
              onClick={() => scrollMostPopular("right")}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 bg-white shadow-lg border border-gray-200 rounded-full p-2 text-gray-700 hover:text-black hover:bg-gray-50 opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex items-center justify-center cursor-pointer"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        </div>
      )}

      <div id="reviews">
        <ProductReviewSummary fullProduct={fullProduct} />
      </div>

      {/* Image Modal */}
      {isModalOpen && zoomMedia && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50"
          onClick={closeModal}
        >
          <div
            className="relative max-w-4xl w-[90%] md:w-[80vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeModal}
              className="absolute -top-12 right-0 md:-right-12 bg-white/20 hover:bg-white/40 p-2 rounded-full text-white transition"
            >
              <X size={24} />
            </button>

            {zoomMedia.type === "video" ? (
              <div className="w-full aspect-video">
                <iframe
                  className="w-full h-full"
                  src={`https://www.youtube.com/embed/${zoomMedia.image.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1]}?autoplay=1`}
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
            ) : (
              <CustomImage
                src={processImageUrl(zoomMedia.image)}
                className="w-full object-contain max-h-[85vh]"
                alt="Zoomed product"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductPage;
