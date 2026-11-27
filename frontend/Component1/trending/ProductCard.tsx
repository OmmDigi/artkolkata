"use client";
import { useState } from "react";
import { ShoppingCart, Heart, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWishlistStore } from "@/store/useWishlistStore";
import { useCartStore } from "@/store/useCartStore";
import Image from "next/image";
import { processImageUrl } from "@/lib/utils";

const TAG_PILL_STYLES = [
  "bg-[#FFE46B] text-[#6B3F00]",
  "bg-[#BFE3FF] text-[#0B3C75]",
  "bg-[#FBC2EB] text-[#700B57]",
  "bg-[#BAFAC8] text-[#0B5D2B]",
];

export function extractFirstFourTags(product: any): string[] {
  if (Array.isArray(product?.tags)) {
    return product.tags.filter(Boolean).slice(0, 4);
  }
  if (product?.tags && typeof product.tags === "object") {
    return Object.entries(product.tags)
      .filter(([, enabled]) => Boolean(enabled))
      .map(([label]) => label)
      .slice(0, 4);
  }
  return product?.tag ? [product.tag] : [];
}

const ProductCard = ({
  product,
  ids,
  image,
  hoverImage,
  colors,
  name,
  price,
  comparePrice,
  slug,
}: any) => {
  const router = useRouter();
  const [loadingIcon, setLoadingIcon] = useState<"cart" | "wish" | null>(null);
  const resolvedImage =
    image || product?.images?.[0]?.image || product?.image1 || "";
  const resolvedHoverImage =
    hoverImage || product?.images?.[1]?.image || product?.image2 || "";
  const resolvedName = name ?? product?.name ?? "";
  const resolvedPrice = price ?? product?.selling_price ?? product?.price ?? 0;
  const resolvedSlug =
    slug ?? product?.slug ?? product?.href?.split("/product/")[1] ?? "";

  const [isHovered, setIsHovered] = useState(false);
  const { toggleWishlist, isInWishlist } = useWishlistStore();
  const { addToCart, removeFromCart, isInCart } = useCartStore();
  const productId = ids ?? product?.id;
  const firstVariant =
    product?.variants?.[0] || product?.product_variants?.[0] || null;
  const inCart = isInCart(productId, firstVariant?.id || null);
  const inWishlist = isInWishlist(productId);
  const displayTags = extractFirstFourTags(product);
  const numericPrice = Number(resolvedPrice ?? 0);
  const numericComparePrice = Number(
    comparePrice ??
      product?.compare_at_price ??
      product?.original_price ??
      product?.originalPrice ??
      firstVariant?.compareAtPrice ??
      0,
  );

  const cartProduct = product?.images
    ? product
    : {
        ...product,
        price: Number(resolvedPrice ?? 0),
        slug: resolvedSlug,
        images: [
          { image: resolvedImage },
          ...(resolvedHoverImage ? [{ image: resolvedHoverImage }] : []),
        ],
        product_variants: product?.product_variants || product?.variants || [],
      };

  const handleIconClick = (type: "cart" | "wish") => {
    setLoadingIcon(type);
    setTimeout(() => {
      setLoadingIcon(null);
      if (type === "wish") toggleWishlist(product);
      if (type === "cart") {
        if (inCart) {
          removeFromCart(productId, firstVariant?.id || null);
        } else {
          addToCart(cartProduct, firstVariant?.id || null, 1);
        }
      }
    }, 100);
  };

  return (
    <div
      className="group relative flex flex-col h-full border border-gray-300 p-1 sm:p-2 bg-white"
      onMouseEnter={() => {
        if (resolvedHoverImage && resolvedHoverImage !== resolvedImage) {
          setIsHovered(true);
        }
      }}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* IMAGE CONTAINER */}
      <div className="relative bg-gray-100 overflow-hidden h-auto">
        {displayTags.length > 0 && (
          <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 z-20 flex flex-col items-start gap-1 max-w-[calc(100%-0.75rem)] pointer-events-none">
            {displayTags.map((tagLabel, idx) => (
              <span
                key={tagLabel}
                className={`${TAG_PILL_STYLES[idx % TAG_PILL_STYLES.length]} px-2 py-0.5 sm:px-2.5 sm:py-0.5 text-[9px] sm:text-[11px] font-bold rounded-full shadow-sm leading-tight max-w-full truncate`}
              >
                {tagLabel}
              </span>
            ))}
          </div>
        )}

        <Link href={`/product/${resolvedSlug}`}>
          <div className="relative overflow-hidden rounded-lg bg-[#ececea] aspect-[4/4]">
            <div className="relative w-full h-full">
              <Image
                src={processImageUrl(
                  isHovered && resolvedHoverImage
                    ? resolvedHoverImage
                    : resolvedImage,
                )}
                alt={resolvedName}
                fill
                className="object-cover transition-opacity duration-300"
              />
            </div>
          </div>
        </Link>

        {/* COLOR VARIANTS (vertical, left side) */}
        {colors && (
          <div className="absolute top-6 left-4 flex flex-col gap-2 z-10">
            {colors.map((color: any, index: number) => (
              <button
                key={index}
                className="w-4 h-4 rounded-full border border-transparent hover:border-black transition-colors duration-200"
                style={{ backgroundColor: color }}
                aria-label="color variant"
              />
            ))}
          </div>
        )}

        {/* ICONS */}
        <div className="absolute bottom-1.5 left-1.5 right-1.5 sm:bottom-3 sm:left-3 sm:right-3 flex justify-between items-center opacity-100 transition-opacity duration-300 pointer-events-none">
          <button
            className={`w-6 h-6 sm:w-[38px] sm:h-[38px] rounded-full transition-colors pointer-events-auto shadow-md flex items-center justify-center ${
              inCart
                ? "bg-orange-500 text-white hover:bg-orange-600"
                : "bg-white text-black hover:bg-black hover:text-white"
            }`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleIconClick("cart");
            }}
            aria-label="Add to cart"
          >
            {loadingIcon === "cart" ? (
              <div className="w-3 h-3 sm:w-[18px] sm:h-[18px] border-2 border-[currentColor] border-t-transparent rounded-full animate-spin" />
            ) : (
              <ShoppingCart className="w-3 h-3 sm:w-[18px] sm:h-[18px]" />
            )}
          </button>
          <button
            className="w-6 h-6 sm:w-[38px] sm:h-[38px] rounded-full transition-colors pointer-events-auto shadow-md flex items-center justify-center bg-white text-black hover:bg-black hover:text-white"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleIconClick("wish");
            }}
            aria-label="Add to wishlist"
          >
            {loadingIcon === "wish" ? (
              <div className="w-3 h-3 sm:w-[18px] sm:h-[18px] border-2 border-[currentColor] border-t-transparent rounded-full animate-spin" />
            ) : (
              <Heart
                className="w-3.5 h-3.5 sm:w-5 sm:h-5"
                fill={inWishlist ? "red" : "none"}
                color={inWishlist ? "red" : "currentColor"}
              />
            )}
          </button>
        </div>
      </div>

      {/* PRODUCT INFO */}
      <Link
        href={`/product/${resolvedSlug}`}
        className="block mt-auto text-left"
      >
        <p className="text-[11px] sm:text-sm font-medium text-black mb-0.5 sm:mb-2 mt-1.5 sm:mt-2 group-hover:opacity-80 transition-opacity line-clamp-1 sm:line-clamp-2">
          {resolvedName?.length > 30
            ? `${resolvedName.slice(0, 30)}...`
            : resolvedName}
        </p>
        <div className="flex gap-1.5 sm:gap-2 items-center flex-wrap mb-1.5 sm:mb-3">
          <span className="text-[11px] sm:text-sm font-semibold text-black">
            ₹
            {Number.isFinite(numericPrice)
              ? numericPrice.toLocaleString("en-IN")
              : resolvedPrice}
          </span>
          {numericComparePrice > numericPrice && (
            <span className="text-[10px] sm:text-xs text-gray-500 line-through">
              ₹{numericComparePrice.toLocaleString("en-IN")}
            </span>
          )}
        </div>
      </Link>

      <div className="flex flex-col gap-1 sm:gap-2 mt-auto">
        <button
          className={`w-full py-1 sm:py-2 rounded-md font-medium text-[11px] sm:text-sm transition-colors flex items-center justify-center gap-1 sm:gap-2 ${
            inCart
              ? "bg-orange-500 text-white hover:bg-orange-600"
              : "border border-black text-black hover:bg-black hover:text-white"
          }`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleIconClick("cart");
          }}
        >
          {loadingIcon === "cart" ? (
            <div className="w-3 h-3 sm:w-[16px] sm:h-[16px] border-2 border-[currentColor] border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <ShoppingCart className="w-3 h-3 sm:w-4 sm:h-4" />
              {inCart ? "In Cart" : "Add to Cart"}
            </>
          )}
        </button>

        <button
          className="w-full py-1 gap-2 sm:py-2 rounded-md font-medium text-[11px] sm:text-sm bg-green-600 hover:bg-green-700 text-white transition-colors flex items-center justify-center"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!inCart) {
              addToCart(cartProduct, firstVariant?.id || null, 1);
            }
            router.push("/checkout");
          }}
        >
          <Zap size={15} className="fill-current" />
          BUY NOW
        </button>
      </div>
    </div>
  );
};

export default ProductCard;
