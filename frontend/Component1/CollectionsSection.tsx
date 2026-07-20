"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { Package } from "lucide-react";
import ScrollingText from "./UI/ScrollingText";
import { useQuery } from "@tanstack/react-query";
import { getRequest } from "@/lib/fetcher";

interface ApiCategory {
  id?: string | number;
  name?: string;
  slug?: string;
  image?: string;
  alt_tag?: string;
  sub_categories?: any[];
}

interface ApiProduct {
  id?: string | number;
  name?: string;
  slug?: string;
  images?: Array<{ image?: string }>;
  price?: number;
  selling_price?: number;
}

interface Collection {
  id: string | number;
  name: string;
  slug: string;
  tag: string;
  image: string;
  images: string[];
}

function CollectionCard({
  collection,
  index,
}: {
  collection: Collection;
  index: number;
}) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const handleDotClick = (imageIndex: number) => {
    setCurrentImageIndex(imageIndex);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % collection.images.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [collection.images.length]);

  return (
    <div
      className={`flex flex-col ${
        index % 2 === 0 ? "lg:flex-row" : "lg:flex-row-reverse"
      } gap-8 items-start`}
    >
      <div className="flex-1 relative">
        <div className="relative w-full aspect-square md:aspect-video rounded-2xl overflow-hidden bg-gray-200">
          <Image
            src={collection.images[currentImageIndex] || collection.image}
            alt={collection.name}
            fill
            className="object-cover"
            unoptimized={true}
          />

          {collection.images.length > 1 && (
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-3">
              {collection.images.map((_, imageIndex) => (
                <button
                  key={imageIndex}
                  onClick={() => handleDotClick(imageIndex)}
                  className={`w-2 h-2 rounded-full transition-all backdrop-blur-[10px] ${
                    imageIndex === currentImageIndex
                      ? "bg-white opacity-100"
                      : "bg-white opacity-60"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-between">
        <div>
          <div className="inline-flex items-center gap-3 bg-white backdrop-blur-sm rounded-full px-4 py-2 mb-6 border border-white">
            <div className="px-3 py-1 bg-black rounded-full">
              <span className="text-xs font-medium text-white">
                {collection.tag}
              </span>
            </div>
            <span className="text-sm font-medium text-black capitalize">
              {collection.name}
            </span>
          </div>

          <h3 className="text-2xl md:text-3xl font-bold text-black mb-3">
            Explore {collection.name} collection
          </h3>
          <p className="text-sm md:text-base text-black/70 leading-relaxed">
            Discover our curated selection of premium {collection.name} wear
            designed for style and comfort.
          </p>
        </div>

        <div className="flex flex-col gap-6 mt-8">
          <Link
            href={`/product?category=${collection.slug}`}
            className="inline-block px-6 py-3 bg-black text-white rounded-full font-medium text-sm hover:bg-black/90 transition-colors w-fit"
          >
            All collections
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function CollectionsSection() {
  const {
    data: categoryData,
    isLoading: isLoadingCategories,
    isError: isErrorCategories,
  } = useQuery({
    queryKey: ["categories"],
    queryFn: () =>
      getRequest<{ data: ApiCategory[] }>("/api/v1/products/category"),
  });

  const categories = (categoryData as any)?.data ?? [];
  const [collections, setCollections] = useState<Collection[]>([]);

  const { data: productsData } = useQuery({
    queryKey: ["category-products"],
    queryFn: async () => {
      if (categories.length === 0) return {};
      const results: Record<string, ApiProduct[]> = {};
      for (const cat of categories) {
        try {
          const response = await getRequest<{ data: ApiProduct[] }>(
            `/api/v1/products?category=${cat.slug}`,
          );
          results[cat.slug || ""] = (response as any)?.data ?? [];
        } catch (error) {
          results[cat.slug || ""] = [];
        }
      }
      return results;
    },
    enabled: categories.length > 0,
  });

  useEffect(() => {
    if (categories.length > 0 && productsData) {
      const mappedCollections = categories.map((cat: ApiCategory) => {
        const categoryProducts = (productsData as any)[cat.slug || ""] ?? [];
        const images = categoryProducts
          .slice(0, 5)
          .map((p: ApiProduct) => p.images?.[0]?.image)
          .filter(Boolean) as string[];

        return {
          id: cat.id,
          name: cat.name || "Collection",
          slug: cat.slug || "",
          tag: "New",
          image: cat.image || "",
          images: images.length > 0 ? images : [cat.image || ""],
        };
      });
      setCollections(mappedCollections);
    }
  }, [categories, productsData]);

  return (
    <section className="w-full bg-white py-2 md:py-2 px-6 md:px-12">
      <div className="max-w-7xl mx-auto">
        <div className="mb-16 md:mb-24">
          <div className="inline-flex items-center gap-2 bg-white border border-black rounded-full px-4 py-2 mb-6">
            <Package size={16} className="text-black" />
            <span className="text-sm font-medium text-black">
              <ScrollingText
                text="Our Collections"
                className="text-lg font-bold"
              />
            </span>
          </div>

          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-black mb-5">
            Modern collections defined by simplicity
          </h2>

          <Link
            href="/product"
            className="inline-block px-6 py-3 bg-black text-white rounded-full font-medium text-sm hover:bg-black/90 transition-colors"
          >
            <ScrollingText
              text="Shop all items"
              className="text-lg font-bold"
            />
          </Link>
        </div>

        {isLoadingCategories ? (
          <div className="text-center py-12">
            <p className="text-black/70">Loading collections...</p>
          </div>
        ) : isErrorCategories ? (
          <div className="text-center py-12">
            <p className="text-red-700">Unable to load collections</p>
          </div>
        ) : (
          <div className="space-y-20 md:space-y-28">
            {collections.map((collection, index) => (
              <CollectionCard
                key={collection.id}
                collection={collection}
                index={index}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
