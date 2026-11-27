"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
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

function getCategoryMeta(category: ApiCategory) {
  const categoryName = category.name ?? "Collection";
  const categorySlug =
    category.slug || category.name?.toLowerCase().replace(/\s+/g, "-") || "all";
  return {
    categoryName,
    categorySlug,
    imageSrc: category.image ?? "",
  };
}

export default function CategoryShowcase() {
  const desktopScrollRef = useRef<HTMLDivElement | null>(null);
  const scrollPosRef = useRef(0);
  const pauseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoveredRef = useRef(false);
  const [isPaused, setIsPaused] = useState(false);

  const {
    data: categoryData,
    isLoading: isLoadingCategories,
    isError: isErrorCategories,
  } = useQuery({
    queryKey: ["categories"],
    queryFn: () =>
      getRequest<{ data: ApiCategory[] }>("/api/v1/products/category?limit=-1"),
  });

  const categories = categoryData?.data?.filter(Boolean) ?? [];
  const shouldLoop = categories.length > 4;
  const desktopCategories = shouldLoop
    ? [...categories, ...categories]
    : categories;

  const pauseTemporarily = (ms = 800) => {
    setIsPaused(true);
    if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    pauseTimeoutRef.current = setTimeout(() => {
      if (desktopScrollRef.current) {
        scrollPosRef.current = desktopScrollRef.current.scrollLeft;
      }
      if (!isHoveredRef.current) {
        setIsPaused(false);
      }
    }, ms);
  };

  const scrollDesktop = (direction: "left" | "right") => {
    const el = desktopScrollRef.current;
    if (!el) return;
    pauseTemporarily(700);
    const step = 240;

    if (direction === "right") {
      if (shouldLoop && el.scrollLeft >= el.scrollWidth / 2) {
        el.scrollLeft -= el.scrollWidth / 2;
      } else if (
        !shouldLoop &&
        el.scrollLeft + el.clientWidth >= el.scrollWidth - 8
      ) {
        el.scrollTo({ left: 0, behavior: "smooth" });
        return;
      }
      el.scrollBy({ left: step, behavior: "smooth" });
    } else {
      if (shouldLoop && el.scrollLeft <= 8) {
        el.scrollLeft += el.scrollWidth / 2;
      } else if (!shouldLoop && el.scrollLeft <= 8) {
        el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
        return;
      }
      el.scrollBy({ left: -step, behavior: "smooth" });
    }
  };

  useEffect(() => {
    return () => {
      if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (isPaused || categories.length === 0) return;

    const el = desktopScrollRef.current;
    if (!el) return;

    scrollPosRef.current = el.scrollLeft;
    let animationFrameId: number;
    let lastTime = performance.now();

    const step = (now: number) => {
      const dt = Math.min(now - lastTime, 50);
      lastTime = now;

      if (el.scrollWidth > el.clientWidth) {
        // ~45px per second continuous auto-scroll
        scrollPosRef.current += (dt / 1000) * 45;

        if (shouldLoop) {
          const halfWidth = el.scrollWidth / 2;
          if (scrollPosRef.current >= halfWidth) {
            scrollPosRef.current -= halfWidth;
          }
        } else if (scrollPosRef.current + el.clientWidth >= el.scrollWidth) {
          scrollPosRef.current = 0;
        }

        el.scrollLeft = scrollPosRef.current;
      }

      animationFrameId = requestAnimationFrame(step);
    };

    animationFrameId = requestAnimationFrame(step);

    return () => cancelAnimationFrame(animationFrameId);
  }, [isPaused, categories.length, shouldLoop]);

  const statusBanner = isLoadingCategories ? (
    <div className="rounded-3xl border border-gray-200 bg-gray-50 p-10 text-center text-sm text-gray-600">
      Loading categories...
    </div>
  ) : isErrorCategories ? (
    <div className="rounded-3xl border border-red-200 bg-red-50 p-10 text-center text-sm text-red-700">
      Unable to load categories. Showing featured collections instead.
    </div>
  ) : null;

  return (
    <>
      {/* Mobile View (Grid) */}
      <section className="md:hidden w-full bg-white py-5 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-5">
            <p className="text-2xl font-bold text-black mb-2">
              Discover by category
            </p>
            <p className="text-sm text-black/70">
              Browse curated category cards to find the right look, trend
            </p>
          </div>

          {statusBanner}

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 sm:gap-4">
            {categories.map((category) => {
              const { categoryName, categorySlug, imageSrc } =
                getCategoryMeta(category);

              return (
                <Link
                  key={category.id ?? categorySlug}
                  href={`/product?category=${categorySlug}`}
                  className="group flex flex-col items-center"
                >
                  <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-white  shadow p-1 transition duration-300 group-hover:shadow-md">
                    <CustomImage
                      src={processImageUrl(imageSrc)}
                      alt={category.alt_tag ?? categoryName}
                      className="h-full w-full rounded-lg object-cover transition duration-500 group-hover:scale-105"
                    />
                  </div>
                  <p className="mt-2 text-center text-xs font-semibold text-black leading-tight line-clamp-2">
                    {categoryName}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Desktop View (Auto-scrolling Carousel) */}
      <section
        className="hidden md:block w-full bg-gradient-to-b from-[#f4f8fc] to-[#edf3fa] py-10 px-6 lg:px-10"
        onMouseEnter={() => {
          isHoveredRef.current = true;
          setIsPaused(true);
        }}
        onMouseLeave={() => {
          isHoveredRef.current = false;
          if (desktopScrollRef.current) {
            scrollPosRef.current = desktopScrollRef.current.scrollLeft;
          }
          setIsPaused(false);
        }}
      >
        <div className="max-w-[1440px] mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">
              Shop Mould Categories
            </h2>
            <div className="mt-3 flex items-center justify-center">
              <div className="h-[1px] w-20 bg-gray-300" />
              <span className="mx-2.5 w-1.5 h-1.5 rotate-45 bg-[#e6640d] inline-block" />
              <div className="h-[1px] w-20 bg-gray-300" />
            </div>
          </div>

          {statusBanner}

          {categories.length > 0 && (
            <div className="relative">
              {/* Left Arrow */}
              <button
                type="button"
                onClick={() => scrollDesktop("left")}
                aria-label="Scroll categories left"
                className="absolute left-2 top-[92px] -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white  shadow flex items-center justify-center text-gray-600 hover:text-black hover:shadow-lg transition cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              {/* Auto-scrolling Carousel Track */}
              <div
                ref={desktopScrollRef}
                className={`flex gap-5 overflow-x-auto scrollbar-hide px-6 py-2 ${
                  shouldLoop ? "" : "justify-center"
                }`}
              >
                {desktopCategories.map((category, idx) => {
                  const { categoryName, categorySlug, imageSrc } =
                    getCategoryMeta(category);

                  return (
                    <Link
                      key={`${category.id ?? categorySlug}-${idx}`}
                      href={`/product?category=${categorySlug}`}
                      className="group flex flex-col items-center flex-shrink-0 w-[184px]"
                    >
                      <div className="w-[184px] h-[176px] rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-sm transition-all duration-300 group-hover:shadow-md group-hover:-translate-y-0.5 p-2 flex items-center justify-center">
                        <CustomImage
                          src={processImageUrl(imageSrc)}
                          alt={category.alt_tag ?? categoryName}
                          className="h-full w-full rounded-xl object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                      <p className="mt-3 text-center text-sm font-semibold text-gray-800 group-hover:text-[#e6640d] transition-colors line-clamp-2">
                        {categoryName}
                      </p>
                    </Link>
                  );
                })}
              </div>

              {/* Right Arrow */}
              <button
                type="button"
                onClick={() => scrollDesktop("right")}
                aria-label="Scroll categories right"
                className="absolute right-2 top-[92px] -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white border border-gray-200/80 shadow-md flex items-center justify-center text-gray-600 hover:text-black hover:shadow-lg transition cursor-pointer"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
