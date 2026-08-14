"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getRequest } from "@/lib/fetcher";

interface ApiCategory {
  id?: string | number;
  name?: string;
  slug?: string;
  image?: string;
  alt_tag?: string;
}

export default function CategoryShowcase() {
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
  const displayCategories = categories;

  return (
    <section className="w-full bg-white py-3 md:py-5 px-6 md:px-12">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-5">
          <p className="text-2xl md:text-4xl lg:text-5xl font-bold text-black mb-4">
            Discover by category
          </p>
          <p className="text-sm md:text-md  text-black/70 mt-2">
            Browse curated category cards to find the right look, trend
          </p>
        </div>

        <div className="flex gap-6 overflow-x-auto md:flex-wrap md:justify-center scrollbar-hide">
          {isLoadingCategories ? (
            <div className="col-span-full rounded-3xl border border-gray-200 bg-gray-50 p-10 text-center text-sm text-gray-600">
              Loading categories...
            </div>
          ) : isErrorCategories ? (
            <div className="col-span-full rounded-3xl border border-red-200 bg-red-50 p-10 text-center text-sm text-red-700">
              Unable to load categories. Showing featured collections instead.
            </div>
          ) : null}

          {displayCategories?.map((category: any, index: any) => {
            const imageSrc = category.image;
            const categoryName = category.name ?? "Collection";
            const categorySlug =
              category.slug ||
              category.name?.toLowerCase().replace(/\s+/g, "-") ||
              "all";

            return (
              <Link
                key={category.id ?? categorySlug}
                href={`/product?category=${categorySlug}`}
                className="group flex flex-col items-center flex-shrink-0"
              >
                <div className="relative w-20 h-20 md:w-32 md:h-32  overflow-hidden bg-gray-100 border border-gray-200 shadow-sm transition duration-300 hover:shadow-lg ">
                  <img
                    src={imageSrc}
                    alt={category.alt_tag ?? categoryName}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                </div>
                <p className="mt-4 text-center text-sm font-semibold text-black">
                  {categoryName}
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
