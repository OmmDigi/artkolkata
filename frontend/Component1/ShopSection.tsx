"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useState } from "react";
import { Star, ShoppingCart, Heart } from "lucide-react";
import ScrollingText from "./UI/ScrollingText";
import { useQuery } from "@tanstack/react-query";
import { getRequest } from "@/lib/fetcher";
import { useWishlistStore } from "@/store/useWishlistStore";
import { useCartStore } from "@/store/useCartStore";

export interface Product {
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
  price?: number;
  selling_price?: number;
  original_price?: number;
  originalPrice?: number;
  category?: any;
  category_slug?: string;
  category_id?: string | number;
}

export const mapApiProduct = (item: ApiProduct): Product => {
  const image1 =
    item.images?.[0]?.image ??
    "https://framerusercontent.com/images/dfydRQ0hineaQjqYigxtJ3UUI.jpg";
  const image2 = item.images?.[1]?.image ?? image1;
  const price = item.selling_price ?? item.price ?? 0;
  const originalPrice =
    item.original_price ?? item.originalPrice ?? item.price ?? price;

  return {
    id: item.id ?? item._id ?? item.slug ?? image1,
    name: item.name ?? "Featured product",
    href: item.slug ? `/product/${item.slug}` : "/shop",
    image1,
    image2,
    price,
    originalPrice,
  };
};

export function ProductCard({ product }: { product: Product }) {
  const router = useRouter();
  const [hoveredImage, setHoveredImage] = useState(false);
  const [loadingIcon, setLoadingIcon] = useState<"cart" | "wish" | null>(null);

  const { wishlist, toggleWishlist } = useWishlistStore();
  const { addToCart, removeFromCart, isInCart } = useCartStore();

  const isInWishlist = wishlist.some((item) => item.id === product.id);
  const inCart = isInCart(product.id, null);

  const handleAction = (type: "cart" | "wish") => {
    setLoadingIcon(type);
    setTimeout(() => {
      setLoadingIcon(null);
      if (type === "wish") toggleWishlist(product);
      if (type === "cart") {
        if (inCart) {
          removeFromCart(product.id, null);
        } else {
          addToCart(product, null, 1);
        }
      }
    }, 150);
  };

  return (
    <div className="group relative flex flex-col h-full border border-gray-300 p-2">
      <div
        className="relative overflow-hidden rounded-lg hover:scale-105 transition-transform duration-300 bg-[#ececea] 
      aspect-[4/4] mb-4"
        onMouseEnter={() => setHoveredImage(true)}
        onMouseLeave={() => setHoveredImage(false)}
      >
        <Link href={product.href} className="block w-full h-full relative">
          <Image
            src={hoveredImage ? product.image2 : product.image1}
            alt={product.name}
            fill
            className="object-cover transition-opacity duration-300"
          />
        </Link>

        {/* Buttons at bottom corners */}
        <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center opacity-100  transition-opacity duration-300 pointer-events-none">
          <button
            className={`p-2.5 rounded-full transition-colors pointer-events-auto shadow-md flex items-center justify-center ${
              inCart
                ? "bg-orange-500 text-white hover:bg-orange-600"
                : "bg-white text-black hover:bg-black hover:text-white"
            }`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleAction("cart");
            }}
            aria-label="Add to cart"
            style={{ width: "38px", height: "38px" }}
          >
            {loadingIcon === "cart" ? (
              <div className="w-[18px] h-[18px] border-2 border-[currentColor] border-t-transparent rounded-full animate-spin" />
            ) : (
              <ShoppingCart size={18} />
            )}
          </button>
          <button
            className={`p-2.5 rounded-full transition-colors pointer-events-auto shadow-md flex items-center justify-center 
                 bg-white text-black hover:bg-black hover:text-white
            `}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleAction("wish");
            }}
            aria-label="Add to wishlist"
            style={{ width: "38px", height: "38px" }}
          >
            {loadingIcon === "wish" ? (
              <div className="w-[18px] h-[18px] border-2 border-[currentColor] border-t-transparent rounded-full animate-spin" />
            ) : (
              <Heart
                size={24}
                fill={isInWishlist ? "red" : "none"}
                color={isInWishlist ? "red" : "currentColor"}
              />
            )}
          </button>
        </div>
      </div>

      <Link href={product.href} className="block mt-auto">
        <p className="text-sm font-medium text-black mb-2 group-hover:opacity-80 transition-opacity">
          {product.name?.length > 30
            ? `${product.name.slice(0, 30)}...`
            : product.name}
        </p>
        <div className="flex gap-2 items-center mb-3">
          <span className="text-sm font-medium text-black">
            {Number(product.price ?? 0).toFixed(2)}
          </span>
          <span className="text-sm text-black/50 line-through">
            {Number(product.originalPrice ?? 0).toFixed(2)}
          </span>
        </div>
      </Link>

      <div className="flex flex-col gap-2 mt-auto">
        <button
          className={`w-full py-2 rounded-md font-medium text-sm transition-colors flex items-center justify-center gap-2 ${
            inCart
              ? "bg-orange-500 text-white hover:bg-orange-600"
              : "border border-black text-black hover:bg-black hover:text-white"
          }`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleAction("cart");
          }}
        >
          {loadingIcon === "cart" ? (
            <div className="w-[16px] h-[16px] border-2 border-[currentColor] border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <ShoppingCart size={16} />
              {inCart ? "In Cart" : "Add to Cart"}
            </>
          )}
        </button>

        <button
          className="w-full py-2 rounded-md font-medium text-sm bg-green-600 hover:bg-green-700 text-white transition-colors flex items-center justify-center"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!inCart) {
              const productObj = {
                id: product.id,
                name: product.name,
                price: Number(product.price ?? 0),
                slug: product.href.split("/product/")[1],
                images: [{ image: product.image1 }, { image: product.image2 }],
              };
              addToCart(productObj as any, null, 1);
            }
            router.push("/checkout");
          }}
        >
          BUY NOW
        </button>
      </div>
    </div>
  );
}

export default function ShopSection() {
  const [gridCols, setGridCols] = useState(5);

  const {
    data: categoryData,
    isLoading: isLoadingCategories,
    isError: isErrorCategories,
  } = useQuery({
    queryKey: ["categories"],
    queryFn: () =>
      getRequest<{ data: ApiCategory[] }>("/api/v1/products/category?limit=-1"),
  });

  const categories = categoryData?.data || [];

  const {
    data: allProductsData,
    isLoading: isLoadingProducts,
    isError: isErrorProducts,
  } = useQuery({
    queryKey: ["all-products"],
    queryFn: () => getRequest<{ data: ApiProduct[] }>("/api/v1/products"),
  });

  const allProducts = allProductsData?.data || [];

  const productsData = categories.map((category) => {
    const categoryProducts = allProducts.filter((product) => {
      if (product.category_slug && category.slug) {
        return product.category_slug === category.slug;
      }
      if (product.category_id && category.id) {
        return product.category_id === category.id;
      }

      const productCategory = product.category;
      if (!productCategory) return false;

      const catId = category.id || category._id;

      if (typeof productCategory === "object") {
        return (
          productCategory._id === catId ||
          productCategory.id === catId ||
          productCategory.slug === category.slug
        );
      }

      return productCategory === catId || productCategory === category.slug;
    });

    return {
      category,
      products: categoryProducts.slice(0, 10).map(mapApiProduct),
    };
  });

  const isLoading = isLoadingCategories || isLoadingProducts;
  const isError = isErrorCategories || isErrorProducts;

  const getGridColsClass = () => {
    if (gridCols === 3) return "lg:min-w-[31%]";
    if (gridCols === 4) return "lg:min-w-[23%]";
    if (gridCols === 5) return "lg:min-w-[18%]";
    return "lg:min-w-[23%]";
  };
  console.log("productsData", productsData);

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

        <div className="mb-1 md:mb-[-60]">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-8">
            <div></div>

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
            {productsData?.slice(0, 4).map(({ category, products }) => (
              <div key={category.id} className="mb-12">
                <div className=" hidden md:inline-flex items-center gap-2 bg-white border border-black rounded-full px-4 py-2 mb-6">
                  <Star size={16} className="fill-black" />
                  <span className="text-sm font-medium text-black">
                    <ScrollingText
                      text={`${category.name}`}
                      className="text-lg font-semibold"
                    />
                  </span>
                </div>

                <div className="flex overflow-x-auto gap-4 md:gap-6 lg:gap-8 pb-4 snap-x snap-mandatory scrollbar-hide">
                  {products.map((product) => (
                    <div
                      key={product.id}
                      className={`min-w-[50vw] sm:min-w-[35vw] md:min-w-[30vw] ${getGridColsClass()} snap-start flex-shrink-0`}
                    >
                      <ProductCard product={product} />
                    </div>
                  ))}
                </div>

                {/* Show All Products Button */}
                <div className="mt-6 text-center">
                  <Link
                    href={`/product?category=${category.slug}`}
                    className="inline-block px-6 py-3 bg-black text-white rounded-full font-medium text-sm hover:bg-black/90 transition-colors"
                  >
                    <ScrollingText
                      text={`Show all ${category.name} products`}
                      className="text-sm font-semibold"
                    />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
