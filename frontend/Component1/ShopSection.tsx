"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import ScrollingText from "./UI/ScrollingText";
import { useQuery } from "@tanstack/react-query";
import { getRequest } from "@/lib/fetcher";
import ProductCard, {
  extractFirstFourTags,
} from "@/Component1/trending/ProductCard";

export { ProductCard };

export interface Product {
  id: any;
  name: string;
  href: string;
  image1: string;
  image2: string;
  price: number;
  originalPrice: number;
  tag?: string;
  tags?: string[];
  product_variants: any[];
}

interface ApiCategory {
  id?: string | number;
  _id?: string;
  name?: string;
  slug?: string;
}

export interface ApiProduct {
  id?: string | number;
  _id?: string;
  slug?: string;
  name?: string;
  images?: Array<{ image?: string }>;
  price?: number | string;
  selling_price?: number | string;
  original_price?: number | string;
  originalPrice?: number | string;
  compare_at_price?: number | string;
  category?: any;
  category_slug?: string;
  category_id?: string | number;
  tag?: string;
  tags?: string[] | Record<string, boolean>;
  variants?: any[];
}

export const mapApiProduct = (item: ApiProduct): Product => {
  const image1 = item.images?.[0]?.image ?? "";
  const image2 = item.images?.[1]?.image ?? image1;
  const price = Number(item.selling_price ?? item.price ?? 0);
  const originalPrice = Number(
    item.original_price ??
      item.originalPrice ??
      item.compare_at_price ??
      item.price ??
      price,
  );
  const tags = extractFirstFourTags(item);

  return {
    id: item.id ?? item._id ?? item.slug ?? image1,
    name: item.name ?? "Featured product",
    href: item.slug ? `/product/${item.slug}` : "/shop",
    image1,
    image2,
    price,
    originalPrice,
    tag: item.tag || tags[0] || undefined,
    tags,
    product_variants: item.variants || [],
  };
};

function CategoryProductRow({
  category,
  gridColsClass,
  onEmpty,
}: {
  category: ApiCategory;
  gridColsClass: string;
  onEmpty: () => void;
}) {
  const reportedEmptyRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef({
    isDown: false,
    startX: 0,
    scrollLeft: 0,
    moved: false,
  });
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const categorySlug =
    category.slug || category.name?.toLowerCase().replace(/\s+/g, "-") || "";

  const { data, isLoading, isError } = useQuery({
    queryKey: ["shop-section-category-products", categorySlug],
    queryFn: () =>
      getRequest<{ data: ApiProduct[] }>(
        `/api/v1/products?category=${encodeURIComponent(categorySlug)}&limit=-1&variants=true`,
      ),
    enabled: Boolean(categorySlug),
  });

  const products = data?.data ?? [];

  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
  }, []);

  useEffect(() => {
    updateScrollButtons();
    window.addEventListener("resize", updateScrollButtons);
    return () => window.removeEventListener("resize", updateScrollButtons);
  }, [products.length, gridColsClass, updateScrollButtons]);

  useEffect(() => {
    if (!isLoading && (isError || products.length === 0)) {
      if (!reportedEmptyRef.current) {
        reportedEmptyRef.current = true;
        onEmpty();
      }
    }
  }, [isLoading, isError, products.length, onEmpty]);

  const handleSlide = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const step = Math.max(el.clientWidth * 0.75, 240);
    el.scrollBy({
      left: direction === "left" ? -step : step,
      behavior: "smooth",
    });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el) return;
    dragState.current = {
      isDown: true,
      startX: e.pageX - el.offsetLeft,
      scrollLeft: el.scrollLeft,
      moved: false,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el || !dragState.current.isDown) return;
    const x = e.pageX - el.offsetLeft;
    const delta = x - dragState.current.startX;
    if (Math.abs(delta) > 5) {
      dragState.current.moved = true;
    }
    if (dragState.current.moved) {
      e.preventDefault();
      el.scrollLeft = dragState.current.scrollLeft - delta;
    }
  };

  const stopDragging = () => {
    dragState.current.isDown = false;
  };

  const handleClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragState.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      dragState.current.moved = false;
    }
  };

  if (!isLoading && (isError || products.length === 0)) {
    return null;
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="inline-flex items-center gap-2 bg-white">
          {/* <Star size={16} className="fill-black" /> */}
          <span className="text-sm font-medium text-black">
            <ScrollingText
              text={`${category.name}`}
              className="text-base md:text-lg font-semibold"
            />
          </span>
        </div>

        {products.length > 5 && (
          <Link
            href={`/product?category=${encodeURIComponent(categorySlug)}`}
            className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full border border-black text-xs md:text-sm font-medium text-black hover:bg-black hover:text-white transition-colors shrink-0"
          >
            <span>View All</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      {isLoading ? (
        <div className="flex overflow-x-auto gap-2 sm:gap-4 md:gap-6 lg:gap-8 pb-4 scrollbar-hide">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div
              key={idx}
              className={`w-[35vw] min-w-[35vw] sm:w-auto sm:min-w-[31vw] md:min-w-[28vw] ${gridColsClass} flex-shrink-0 border border-gray-200 p-1 sm:p-2 rounded-lg animate-pulse`}
            >
              <div className="aspect-[4/4] bg-gray-200 rounded-lg mb-4" />
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-3" />
              <div className="h-9 bg-gray-200 rounded mb-2" />
              <div className="h-9 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="relative">
          {/* Left Arrow */}
          <button
            type="button"
            onClick={() => handleSlide("left")}
            disabled={!canScrollLeft}
            aria-label={`Scroll ${category.name} products left`}
            className={`flex items-center justify-center absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 md:w-10 md:h-10 rounded-full bg-white/95 border border-gray-300 shadow-lg text-black transition ${
              canScrollLeft
                ? "hover:bg-black hover:text-white cursor-pointer opacity-100"
                : "opacity-35 cursor-not-allowed"
            }`}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Product Track */}
          <div
            ref={scrollRef}
            onScroll={updateScrollButtons}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={stopDragging}
            onMouseLeave={stopDragging}
            onClickCapture={handleClickCapture}
            className="flex overflow-x-auto gap-2 sm:gap-4 md:gap-6 lg:gap-8 pb-4 scrollbar-hide select-none cursor-grab active:cursor-grabbing"
          >
            {products.map((item) => (
              <div
                key={item.id ?? item._id ?? item.slug}
                className={`w-[35vw] min-w-[35vw] sm:w-auto sm:min-w-[31vw] md:min-w-[28vw] ${gridColsClass} flex-shrink-0`}
              >
                <ProductCard
                  product={item}
                  ids={item.id}
                  image={item.images?.[0]?.image}
                  hoverImage={item.images?.[1]?.image}
                  colors={(item as any).colors}
                  name={item.name}
                  price={item.selling_price ?? item.price}
                  slug={item.slug}
                />
              </div>
            ))}
          </div>

          {/* Right Arrow */}
          <button
            type="button"
            onClick={() => handleSlide("right")}
            disabled={!canScrollRight}
            aria-label={`Scroll ${category.name} products right`}
            className={`flex items-center justify-center absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 md:w-10 md:h-10 rounded-full bg-white/95 border border-gray-300 shadow-lg text-black transition ${
              canScrollRight
                ? "hover:bg-black hover:text-white cursor-pointer opacity-100"
                : "opacity-35 cursor-not-allowed"
            }`}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function ShopSection() {
  const [gridCols, setGridCols] = useState(5);
  const [visibleCount, setVisibleCount] = useState(1);
  const loaderRef = useRef<HTMLDivElement>(null);

  const {
    data: categoryData,
    isLoading: isLoadingCategories,
    isError: isErrorCategories,
  } = useQuery({
    queryKey: ["categories"],
    queryFn: () =>
      getRequest<{ data: ApiCategory[] }>(`/api/v1/products/category?limit=-1`),
  });

  const categories = categoryData?.data || [];
  const visibleCategories = categories.slice(0, visibleCount);
  const hasMoreCategories = visibleCount < categories.length;

  useEffect(() => {
    const sentinel = loaderRef.current;
    if (!sentinel || !hasMoreCategories) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + 1, categories.length));
        }
      },
      { threshold: 0.1, rootMargin: "150px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreCategories, visibleCount, categories.length]);

  const handleEmptyCategory = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + 1, categories.length));
  }, [categories.length]);

  const isLoading = isLoadingCategories;
  const isError = isErrorCategories;

  const getGridColsClass = () => {
    if (gridCols === 3) return "lg:min-w-[31%]";
    if (gridCols === 4) return "lg:min-w-[23%]";
    if (gridCols === 5) return "lg:min-w-[18%]";
    return "lg:min-w-[23%]";
  };

  return (
    <section className="w-full bg-white py-3 md:py-10 px-2 md:px-12">
      <div className="max-w-full mx-auto">
        {/* Component Heading */}
        <div className="text-center mb-1">
          <p className="text-2xl font-bold text-black">Shop by Category</p>
          <p className="text-sm md:text-md  text-black/70 mt-2">
            Discover the latest products in each category
          </p>
        </div>

        <div className="mb-1 ">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 ">
            <div></div>

            <div className="hidden mt-[-50] lg:flex items-center gap-3 ml-auto">
              {[3, 4, 5].map((cols) => (
                <button
                  key={cols}
                  onClick={() => setGridCols(cols)}
                  className={`px-4 py-2 rounded-full font-medium text-sm transition-all ${
                    gridCols === cols
                      ? "bg-black text-white"
                      : "bg-black/5 text-black hover:bg-black/10"
                  }`}
                >
                  <ScrollingText
                    text={`${cols} Cols`}
                    className="text-sm font-semibold"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="col-span-full rounded-2xl border border-dashed border-black/20 p-12 text-center text-black/70">
            Loading categories and products...
          </div>
        )}

        {isError && (
          <div className="col-span-full rounded-2xl border border-dashed border-red-200 p-4 text-center text-red-700">
            Unable to load categories or products. Please try again later.
          </div>
        )}

        {!isLoading && !isError && (
          <div>
            {visibleCategories.map((category, idx) => (
              <CategoryProductRow
                key={category.id ?? category._id ?? category.slug ?? idx}
                category={category}
                gridColsClass={getGridColsClass()}
                onEmpty={handleEmptyCategory}
              />
            ))}

            {hasMoreCategories && (
              <div
                ref={loaderRef}
                className="py-6 text-center text-sm text-black/60"
              >
                Loading more categories...
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
