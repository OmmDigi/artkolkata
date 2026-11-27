"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getRequest } from "@/lib/fetcher";
import CustomImage from "@/Component1/CustomImage";
import { processImageUrl } from "@/lib/utils";

interface ApiCategory {
  id?: string | number;
  name?: string;
  slug?: string;
  image?: string;
  alt_tag?: string;
}

export default function CategoryBar() {
  const pathname = usePathname() ?? "/";
  const normalizedPath =
    pathname === "/" ? "/" : pathname.replace(/\/+$/, "");
  const shouldShow = normalizedPath === "/" || normalizedPath === "/product";

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef({
    isDown: false,
    startX: 0,
    scrollLeft: 0,
    moved: false,
  });

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const {
    data: categoryData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["all-categories"],
    queryFn: () =>
      getRequest<{ data: ApiCategory[] }>("/api/v1/products/category?limit=-1"),
    enabled: shouldShow,
  });

  const categories = categoryData?.data?.filter(Boolean) ?? [];

  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
  }, []);

  useEffect(() => {
    if (!shouldShow) return;
    updateScrollButtons();
    window.addEventListener("resize", updateScrollButtons);
    return () => window.removeEventListener("resize", updateScrollButtons);
  }, [shouldShow, categories.length, updateScrollButtons]);

  const handleSlide = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const step = Math.max(el.clientWidth * 0.65, 200);
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

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (dragState.current.moved) {
      e.preventDefault();
      dragState.current.moved = false;
    }
  };

  if (!shouldShow || isError || (!isLoading && categories.length === 0)) {
    return null;
  }

  return (
    <section
      aria-label="Browse categories"
      className="w-full bg-white border-b border-gray-200 relative z-30"
    >
      <div className="max-w-9xl mx-auto px-9 sm:px-11 lg:px-14 py-2.5 md:py-3 relative">
        {/* Left Arrow */}
        <button
          type="button"
          onClick={() => handleSlide("left")}
          disabled={!canScrollLeft}
          aria-label="Scroll categories left"
          className={`flex items-center justify-center absolute left-1.5 sm:left-3 top-[38px] sm:top-[44px] md:top-[47px] -translate-y-1/2 z-10 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white border border-gray-200 shadow-md text-gray-700 transition ${
            canScrollLeft
              ? "hover:bg-gray-50 hover:text-black cursor-pointer opacity-100"
              : "opacity-35 cursor-not-allowed"
          }`}
        >
          <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* Scrollable Circular Categories */}
        <div
          ref={scrollRef}
          onScroll={updateScrollButtons}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={stopDragging}
          onMouseLeave={stopDragging}
          className="flex items-start gap-4 sm:gap-6 md:gap-7 overflow-x-auto scrollbar-hide select-none cursor-grab active:cursor-grabbing"
        >
          {isLoading
            ? Array.from({ length: 10 }).map((_, idx) => (
                <div
                  key={idx}
                  className="flex flex-col items-center shrink-0 w-20 sm:w-24 md:w-28 animate-pulse"
                >
                  <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-[70px] md:h-[70px] rounded-full bg-gray-200" />
                  <div className="mt-2 h-3 w-16 rounded bg-gray-200" />
                </div>
              ))
            : categories.map((category) => {
                const categoryName = category.name || "Category";
                const categorySlug =
                  category.slug ||
                  category.name?.toLowerCase().replace(/\s+/g, "-") ||
                  "all";

                return (
                  <Link
                    key={category.id ?? categorySlug}
                    href={`/product?category=${encodeURIComponent(categorySlug)}`}
                    onClick={handleLinkClick}
                    draggable={false}
                    className="group flex flex-col items-center shrink-0 w-20 sm:w-24 md:w-28"
                  >
                    <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-[70px] md:h-[70px] rounded-full overflow-hidden bg-white border border-gray-200 shadow-xs flex items-center justify-center transition-all duration-200 group-hover:border-[#e6640d] group-hover:shadow-md">
                      {category.image ? (
                        <CustomImage
                          src={processImageUrl(category.image)}
                          alt={category.alt_tag || categoryName}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 pointer-events-none"
                        />
                      ) : (
                        <span className="text-sm font-semibold text-gray-500">
                          {categoryName.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <span className="mt-1.5 text-center text-[11px] sm:text-xs font-medium text-gray-800 leading-tight line-clamp-2 group-hover:text-[#e6640d] transition-colors">
                      {categoryName}
                    </span>
                  </Link>
                );
              })}
        </div>

        {/* Right Arrow */}
        <button
          type="button"
          onClick={() => handleSlide("right")}
          disabled={!canScrollRight}
          aria-label="Scroll categories right"
          className={`flex items-center justify-center absolute right-1.5 sm:right-3 top-[38px] sm:top-[44px] md:top-[47px] -translate-y-1/2 z-10 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white border border-gray-200 shadow-md text-gray-700 transition ${
            canScrollRight
              ? "hover:bg-gray-50 hover:text-black cursor-pointer opacity-100"
              : "opacity-35 cursor-not-allowed"
          }`}
        >
          <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>
    </section>
  );
}
