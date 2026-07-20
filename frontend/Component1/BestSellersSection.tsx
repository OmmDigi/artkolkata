"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { TrendingUp } from "lucide-react";
import ScrollingText from "./UI/ScrollingText";
import { useQuery } from "@tanstack/react-query";
import { getRequest } from "@/lib/fetcher";

interface BestSellerProduct {
  id: any;
  name: string;
  href: string;
  image1: string;
  image2: string;
  price: number;
  originalPrice: number;
}

interface ApiCategory {
  id?: string | number;
  name?: string;
  slug?: string;
}

interface ApiProduct {
  id?: string | number;
  _id?: string;
  slug?: string;
  name?: string;
  images?: Array<{ image?: string }>;
  price?: number;
  selling_price?: number;
  original_price?: number;
  originalPrice?: number;
}

const fallbackProducts: BestSellerProduct[] = [
  {
    id: "fallback-1",
    name: "Heavyweight Oversized Hoodie",
    href: "/shop/heavyweight-oversized-hoodie",
    image1:
      "https://framerusercontent.com/images/XHQtokxpBrRieMyXVFgUTB7KS0.jpg",
    image2:
      "https://framerusercontent.com/images/GTy2Bbh36uTYPS8F34SC1dV1cI.jpg",
    price: 85.0,
    originalPrice: 110.0,
  },
  {
    id: "fallback-2",
    name: "Patterned Knit Sweater",
    href: "/shop/patterned-knit-sweater",
    image1:
      "https://framerusercontent.com/images/5n60PDud9wC2hKZ67RqkdLdEnOM.png",
    image2:
      "https://framerusercontent.com/images/Dh3OA7nlrSTKU7GkFh7IpzC704M.png",
    price: 45.0,
    originalPrice: 90.0,
  },
  {
    id: "fallback-3",
    name: "Quilted Bomber Jacket",
    href: "/shop/quilted-bomber-jacket",
    image1:
      "https://framerusercontent.com/images/wtLmzE2wAi9yJrXcWCnR857MSwQ.jpg",
    image2:
      "https://framerusercontent.com/images/UBz7Wqq5xr8G3Dd1Gqsc3otaozI.webp",
    price: 145.0,
    originalPrice: 180.0,
  },
];

const mapApiProduct = (item: ApiProduct): BestSellerProduct => {
  const image1 =
    item.images?.[0]?.image ??
    "https://framerusercontent.com/images/XHQtokxpBrRieMyXVFgUTB7KS0.jpg";
  const image2 = item.images?.[1]?.image ?? image1;
  const price = item.selling_price ?? item.price ?? 0;
  const originalPrice =
    item.original_price ?? item.originalPrice ?? item.price ?? price;

  return {
    id: item.id ?? item._id ?? item.slug ?? image1,
    name: item.name ?? "Best seller",
    href: item.slug ? `/product/${item.slug}` : "/shop",
    image1,
    image2,
    price,
    originalPrice,
  };
};

function BestSellerCard({ product }: { product: BestSellerProduct }) {
  const [hoveredImage, setHoveredImage] = useState(false);

  return (
    <Link href={product.href} className="group">
      <div className="relative overflow-hidden rounded-lg bg-[#ececea] aspect-[3/4] mb-4">
        {/* Image Container */}
        <div className="relative w-full h-full">
          <Image
            src={hoveredImage ? product.image2 : product.image1}
            alt={product.name}
            fill
            className="object-cover transition-opacity duration-300"
            onMouseEnter={() => setHoveredImage(true)}
            onMouseLeave={() => setHoveredImage(false)}
          />

          {/* Best Seller Badge */}
          <div className="absolute top-4 right-4 bg-black rounded-full px-3 py-1.5 flex items-center gap-2">
            <TrendingUp size={16} className="text-white" />
            <span className="text-xs font-medium text-white">Best seller</span>
          </div>
        </div>

        {/* Thumbnail Images */}
        <div className="absolute bottom-4 left-4 flex gap-2">
          <button
            onMouseEnter={() => setHoveredImage(false)}
            className={`w-8 h-8 rounded-full border-2 overflow-hidden transition-all ${
              !hoveredImage ? "border-black" : "border-black/10"
            }`}
          >
            <Image
              src={product.image1}
              alt={`${product.name} view 1`}
              width={32}
              height={32}
              className="w-full h-full object-cover"
            />
          </button>
          <button
            onMouseEnter={() => setHoveredImage(true)}
            className={`w-8 h-8 rounded-full border-2 overflow-hidden transition-all ${
              hoveredImage ? "border-black" : "border-black/10"
            }`}
          >
            <Image
              src={product.image2}
              alt={`${product.name} view 2`}
              width={32}
              height={32}
              className="w-full h-full object-cover"
            />
          </button>
        </div>
      </div>

      {/* Product Info */}
      <div>
        <h3 className="text-sm font-medium text-black mb-2 group-hover:opacity-80 transition-opacity">
          {product.name}
        </h3>
        <div className="flex gap-2 items-center">
          <span className="text-sm font-medium text-black">
            ${Number(product.price ?? 0).toFixed(2)}
          </span>
          <span className="text-sm text-black/50 line-through">
            ${Number(product.originalPrice ?? 0).toFixed(2)}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function BestSellersSection() {
  const [gridCols, setGridCols] = useState(4);

  const {
    data: categoryData,
    isLoading: isLoadingCategories,
    isError: isErrorCategories,
  } = useQuery({
    queryKey: ["categories"],
    queryFn: () =>
      getRequest<{ data: ApiCategory[] }>("/api/v1/products/category"),
  });

  const firstCategory = categoryData?.data?.[1];
  const activeCategory = firstCategory?.slug || firstCategory?.name || "";

  const {
    data: productData,
    isLoading: isLoadingProducts,
    isError: isErrorProducts,
  } = useQuery({
    queryKey: ["products-by-category", activeCategory],
    queryFn: () =>
      getRequest<{ data: ApiProduct[] }>(
        `/api/v1/products?category=${activeCategory}`,
      ),
    enabled: Boolean(activeCategory),
  });

  const apiProducts = productData?.data?.map(mapApiProduct) ?? [];
  const productsToDisplay =
    apiProducts.length > 0 ? apiProducts : fallbackProducts;
  const isLoading = isLoadingCategories || isLoadingProducts;
  const isError = isErrorCategories || isErrorProducts;

  const getGridColsClass = () => {
    if (gridCols === 3) return "lg:grid-cols-3";
    if (gridCols === 4) return "lg:grid-cols-4";
    if (gridCols === 5) return "lg:grid-cols-5";
    return "lg:grid-cols-3";
  };

  return (
    <section className="w-full bg-white py-16 md:py-24 px-6 md:px-12">
      <div className="max-w-full mx-auto">
        <div className="mb-12 md:mb-16">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-8">
            <div>
              <div className="inline-flex items-center gap-2 bg-white border border-black rounded-full px-4 py-2 mb-6">
                <TrendingUp size={16} className="text-black" />
                <span className="text-sm font-medium text-black">
                  <ScrollingText
                    text={
                      activeCategory
                        ? `Best sellers in ${activeCategory}`
                        : "Best sellers"
                    }
                    className="text-lg font-bold"
                  />
                </span>
              </div>

              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-black mb-4">
                Our signature best selling pieces
              </h2>
              <p className="text-sm text-black/70 mb-6">
                {firstCategory
                  ? `Showing best sellers from category: ${firstCategory.name ?? activeCategory}`
                  : "Loading best sellers..."}
              </p>

              <Link
                href="/shop"
                className="inline-block px-6 py-3 bg-black text-white rounded-full font-medium text-sm hover:bg-black/90 transition-colors"
              >
                <ScrollingText
                  text="See all collections"
                  className="text-lg font-semibold"
                />
              </Link>
            </div>

            <div className="hidden lg:flex items-center gap-3 ml-auto">
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
                    className="text-sm font-bold"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div
          className={`grid grid-cols-2 md:grid-cols-2 ${getGridColsClass()} gap-4 md:gap-6 lg:gap-8`}
        >
          {isLoading && (
            <div className="col-span-full rounded-2xl border border-dashed border-black/20 p-12 text-center text-black/70">
              Loading best sellers...
            </div>
          )}

          {isError && (
            <div className="col-span-full rounded-2xl border border-dashed border-red-200 p-12 text-center text-red-700">
              Unable to load best sellers. Showing fallback items.
            </div>
          )}

          {productsToDisplay.map((product) => (
            <BestSellerCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}
