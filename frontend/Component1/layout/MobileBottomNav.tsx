"use client";

import React, { useState } from "react";
import Link from "next/link";
import { User, LayoutGrid, ShoppingBag, Heart, ShoppingCart, X } from "lucide-react";
import ShoppingCartSidebar from "@/app/Component/trending/ShoppingCartSidebar";
import { useQuery } from "@tanstack/react-query";
import { getRequest } from "@/lib/fetcher";
import { useWishlistStore } from "@/store/useWishlistStore";

interface ApiCategory {
  id?: string | number;
  name?: string;
  slug?: string;
  image?: string;
  alt_tag?: string;
  sub_categories?: any[];
}
const MobileBottomNav = () => {
  const { wishlist } = useWishlistStore();

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const handleCategoryClick = () => setIsCategoryModalOpen(true);

  const {
    data: categoryData,
    isLoading: isLoadingCategories,
    isError: isErrorCategories,
  } = useQuery({
    queryKey: ["categories"],
    queryFn: () =>
      getRequest<{ data: ApiCategory[] }>("/api/v1/products/category?limit=-1"),
  });

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 px-2  shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
      <div className="flex justify-between items-center h-14 relative">
        {/* Profile */}
        <Link href="/account" className="flex flex-col items-center justify-center w-1/5 text-gray-900 hover:text-black transition-colors">
          <User className="h-6 w-6 mb-1" strokeWidth={1.5} />
          <span className="text-[10px] font-medium">Profile</span>
        </Link>

        {/* Category */}
        <div onClick={handleCategoryClick} className="flex flex-col items-center justify-center w-1/5 text-gray-900 hover:text-black transition-colors">
          <LayoutGrid className="h-6 w-6 mb-1" strokeWidth={1.5} />
          <span className="text-[10px] font-medium">Category</span>
        </div>

        {/* Products (Center Prominent Button) */}
        <div className="w-1/5 flex justify-center h-full relative">
          <Link
            href="/product"
            className="absolute -top-6 flex flex-col items-center justify-center w-14 h-14 bg-black rounded-full text-white shadow-lg border-4 border-white transition-transform hover:scale-105"
          >
            <ShoppingBag className="h-6 w-6" strokeWidth={2} />
          </Link>
          <span className="text-[10px] font-medium text-gray-900 absolute bottom-0">Products</span>
        </div>

        {/* Wishlist */}
        <Link href="/wishlist" className="relative flex flex-col items-center justify-center w-1/5 text-gray-900 hover:text-black transition-colors">
          <Heart className="h-6 w-6 mb-1" strokeWidth={1.5} />
          <span className="text-[10px] font-medium">Wishlist</span>
          {wishlist?.length > 0 && (
            <span className="absolute top-[-4px] right-3 w-5 h-5 bg-red-500 text-white text-[12px] font-bold rounded-full flex items-center justify-center">
              {wishlist?.length}
            </span>
          )}
        </Link>



        {/* Cartbox */}
        <div className="flex flex-col items-center justify-center w-1/5 text-gray-900 hover:text-black transition-colors relative">
          <ShoppingCartSidebar />
          <span className="text-[10px] font-medium">Cart</span>
          {/* <span className="absolute top-0 right-3 bg-red-500 text-white text-[8px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
            0
          </span> */}
        </div>
      </div>

      {/* Category Modal */}
      {isCategoryModalOpen && (
        <div className="fixed text-black inset-0 z-[60] bg-white flex flex-col md:hidden">
          <div className="flex justify-between items-center p-4 border-b">
            <h2 className="text-lg font-semibold">Categories</h2>
            <button onClick={() => setIsCategoryModalOpen(false)} className="p-2">
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 pb-20">
            {isLoadingCategories ? (
              <div className="text-center text-gray-500 py-10">Loading categories...</div>
            ) : isErrorCategories ? (
              <div className="text-center text-red-500 py-10">Error loading categories</div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {categoryData?.data?.map((category) => {
                  const categoryName = category.name ?? "Category";
                  const categorySlug =
                    category.slug || categoryName.toLowerCase().replace(/\s+/g, "-");

                  return (
                    <Link
                      key={category.id ?? categorySlug}
                      href={`/product?category=${categorySlug}`}
                      onClick={() => setIsCategoryModalOpen(false)}
                      className="flex flex-col items-center text-center gap-2"
                    >
                      <div className="w-16 h-16 rounded-full bg-gray-100 overflow-hidden border border-gray-200">
                        {category.image ? (
                          <img src={category.image} alt={category.alt_tag ?? categoryName} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <LayoutGrid className="w-6 h-6" />
                          </div>
                        )}
                      </div>
                      <span className="text-xs font-medium leading-tight">{categoryName}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileBottomNav;
