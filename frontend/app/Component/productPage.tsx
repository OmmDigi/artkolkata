"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Grid3x3, Heart, List } from "lucide-react";
import Link from "next/link";
import { getRequest } from "@/lib/fetcher";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import { useWishlistStore } from "@/store/useWishlistStore";
import { useCartStore } from "@/store/useCartStore";
import ProductCard from "./trending/ProductCard";

interface Product {
  id: string | number;
  price: number | string;
  [key: string]: any;
}

interface SortOption {
  label: string;
  value: "" | "low-to-high" | "high-to-low";
}

const ProductsPage = () => {
  // paging + filter + sort states
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [sortBy, setSortBy] = useState("");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [sortedProducts, setSortedProducts] = useState<Product[]>([]);
  const [expandedFilters, setExpandedFilters] = useState<{
    [key: string]: boolean;
  }>({ category: true });

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setExpandedFilters((prev) => ({ ...prev, category: false }));
      } else {
        setExpandedFilters((prev) => ({ ...prev, category: true }));
      }
    };

    if (typeof window !== "undefined") {
      handleResize();
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, []);

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // selected category/subcategory states (slug or name whichever is present)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSubCategories, setSelectedSubCategories] = useState<string[]>(
    [],
  );

  const { wishlist, toggleWishlist } = useWishlistStore();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  console.log("searchParams", sortedProducts);

  // ---------- SORT OPTIONS ----------
  const sortOptions: SortOption[] = [
    { label: "Select", value: "" },
    { label: "Sort by price: low to high", value: "low-to-high" },
    { label: "Sort by price: high to low", value: "high-to-low" },
  ];

  // Categories query (unchanged)
  const {
    isLoading: isLoadingCategory,
    isError: isErrorCategory,
    data: category,
    error: errorCategory,
  } = useQuery({
    queryKey: ["All-category"],
    queryFn: () => getRequest(`/api/v1/products/category?limit=-1`),
  });

  const buildProductsUrl = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(currentPage));
    params.set("limit", String(limit));
    const query = params.toString();
    return `/api/v1/products${query ? `?${query}` : ""}`;
  };

  const {
    isLoading,
    isError,
    data: products,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      "all-products",
      currentPage,
      limit,
      selectedCategories,
      selectedSubCategories,
      searchParams.toString(),
    ],
    queryFn: () => getRequest(buildProductsUrl()),
  });

  // Apply client-side sorting whenever products (from server) change or filters change
  useEffect(() => {
    const original: Product[] = (products as any)?.data ?? [];

    // apply sort
    let filtered = original;
    switch (sortBy) {
      case "Sort by price: low to high":
        filtered = filtered
          .slice()
          .sort((a, b) => Number(a.price) - Number(b.price));
        break;
      case "Sort by price: high to low":
        filtered = filtered
          .slice()
          .sort((a, b) => Number(b.price) - Number(a.price));
        break;
      default:
        // keep original ordering
        break;
    }
    setSortedProducts(filtered);
  }, [products, sortBy]);

  // On mount: read URL search params and set selectedCategories/subCategories accordingly
  useEffect(() => {
    const cats = searchParams?.getAll("category") ?? [];
    const subs = searchParams?.getAll("sub_category") ?? [];
    setSelectedCategories(cats);
    setSelectedSubCategories(subs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Loading / Error UI
  if (isLoading && isLoadingCategory) {
    return <div className="bg-white">Loading...</div>;
  }

  if (isError && isErrorCategory) {
    return <div className="bg-white">Error: {(error as any)?.message}</div>;
  }

  const toggleFilter = (filterId: string) => {
    setExpandedFilters((prev) => ({
      ...prev,
      [filterId]: !prev[filterId],
    }));
  };

  const scrollToTop = () => {
    if (typeof window !== "undefined") {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  };

  const renderStars = (rating: number) => {
    const percentage = (rating / 5) * 100;
    return (
      <div className="flex items-center text-sm mb-2">
        <div className="relative">
          <div className="flex text-gray-300">{"★".repeat(5)}</div>
          <div
            className="absolute top-0 left-0 overflow-hidden flex text-yellow-400"
            style={{ width: `${percentage}%` }}
          >
            {"★".repeat(5)}
          </div>
        </div>
      </div>
    );
  };

  // Helpers to extract slug or name from category object
  const getOptionKey = (opt: any) => opt?.slug ?? opt?.name ?? opt?.id;

  // When user clicks a category option
  const handleCategorySelect = (option: any) => {
    const key = String(getOptionKey(option));
    let newCategories = [...selectedCategories];

    if (newCategories.includes(key)) {
      newCategories = newCategories.filter((c) => c !== key);
    } else {
      newCategories.push(key);
    }

    setSelectedCategories(newCategories);

    // update URL search params
    const params = new URLSearchParams();
    newCategories.forEach((c) => params.append("category", c));
    selectedSubCategories.forEach((s) => params.append("sub_category", s));

    router.push(`${window.location.pathname}?${params.toString()}`);
    // set to page 1
    setCurrentPage(1);
  };

  // When user clicks a subcategory option
  const handleSubCategorySelect = (child: any, parentCategory?: any) => {
    const subKey = String(getOptionKey(child));
    const catKey = parentCategory ? String(getOptionKey(parentCategory)) : null;

    let newCategories = [...selectedCategories];
    let newSubCategories = [...selectedSubCategories];

    if (catKey && !newCategories.includes(catKey)) {
      newCategories.push(catKey);
    }

    if (newSubCategories.includes(subKey)) {
      newSubCategories = newSubCategories.filter((s) => s !== subKey);
    } else {
      newSubCategories.push(subKey);
    }

    setSelectedCategories(newCategories);
    setSelectedSubCategories(newSubCategories);

    const params = new URLSearchParams();
    newCategories.forEach((c) => params.append("category", c));
    newSubCategories.forEach((s) => params.append("sub_category", s));

    router.push(`${window.location.pathname}?${params.toString()}`);
    setCurrentPage(1);
  };

  const FilterSection = ({
    title,
    options,
    filterId,
  }: {
    title: string;
    options: any;
    filterId: string;
  }) => {
    const isExpanded = expandedFilters[filterId];

    return (
      <div className="border-b border-gray-200 py-4">
        <button
          onClick={() => toggleFilter(filterId)}
          className="flex items-center justify-between w-full text-left px-4 md:px-0
    bg-gradient-to-b from-[#02F8C5] to-white
    md:bg-none md:bg-white"
        >
          <h3 className="text-sm font-medium text-gray-900">{title}</h3>
          <ChevronDown
            className={`w-4 h-4 text-gray-800 transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </button>

        {isExpanded && options && (
          <ul className="mt-3 space-y-2">
            {options?.data?.length > 0 &&
              options.data.map((option: any) => {
                const optKey = getOptionKey(option);
                const isCategoryChecked = selectedCategories.includes(
                  String(optKey),
                );

                return (
                  <li key={optKey}>
                    <label
                      className="flex items-center cursor-pointer group"
                      onClick={(e) => {
                        e.preventDefault();
                        handleCategorySelect(option);
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isCategoryChecked}
                        readOnly
                        className="w-4 h-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                      />
                      <span className="ml-2 text-sm text-gray-700 group-hover:text-gray-900">
                        {option.name}
                      </span>
                    </label>

                    {option.sub_categories &&
                      option.sub_categories.length > 0 && (
                        <ul className="ml-6 mt-2 space-y-2">
                          {option.sub_categories.map((child: any) => {
                            const childKey = getOptionKey(child);
                            const isSubChecked = selectedSubCategories.includes(
                              String(childKey),
                            );

                            return (
                              <li key={childKey}>
                                <label
                                  className="flex items-center cursor-pointer group"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleSubCategorySelect(child, option);
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSubChecked}
                                    readOnly
                                    className="w-4 h-4 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                                  />
                                  <span className="ml-2 text-sm text-gray-600 group-hover:text-gray-900">
                                    {child.name}
                                  </span>
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                  </li>
                );
              })}
          </ul>
        )}
      </div>
    );
  };

  // Sort apply function (updates sortBy; sorting applied client-side via effect)
  const applySorting = (option: SortOption) => {
    setSortBy(option.label || "Select");
    setShowSortMenu(false);
  };

  // Clear all filters handler
  const handleClearAll = () => {
    const params = new URLSearchParams(searchParams.toString());

    setSelectedCategories([]);
    setSelectedSubCategories([]);
    setSortBy("");
    setCurrentPage(1);
    // setSortedProducts([]);
    params.delete("sub_category");
    params.delete("category");

    // refetchProducts();
    router.push(window.location.pathname);
    // refetch (will request paginated page)
  };

  return (
    <div className="min-h-screen bg-white px-1 md:px-6">
      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <nav className="text-sm text-gray-500">
          <a href="/" className="hover:text-gray-700">
            Home
          </a>
          {selectedCategories.length > 0 && <span className="mx-2">/</span>}
          <span className="text-gray-900">{selectedCategories.join(", ")}</span>
          {selectedSubCategories.length > 0 && <span className="mx-2">/</span>}
          <span className="text-gray-900">
            {selectedSubCategories.join(", ")}
          </span>
        </nav>
      </div>

      {/* <div className="max-w-7xl mx-auto px-4"> */}
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-8">
        {/* Sidebar Filters */}
        <aside className="w-full lg:w-1/8 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto scrollbar-hide">
          {/* Clear All Button */}
          <button
            onClick={handleClearAll}
            className="w-full mb-6 px-4 py-2 cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded transition-colors"
          >
            Clear all
          </button>

          {/* Category Filter */}
          <FilterSection
            title="Category"
            options={category}
            filterId="category"
          />
        </aside>

        {/* Products Grid */}
        <div className="flex-1 pb-6">
          {/* Results Header */}
          <div className="md:flex items-end justify-between mb-6">
            <p className="text-sm text-gray-600">
              Showing {sortedProducts?.length ?? 0} of{" "}
              {(products as any)?.total ?? (products as any)?.data?.length ?? 0}{" "}
              results
            </p>

            {/* Limit and Sort Controls */}
            <div className="flex justify-end gap-3">
              {/* Limit Select */}
              <div className="relative">
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-300 h-full"
                >
                  <option value={10}>10 per page</option>
                  <option value={20}>20 per page</option>
                  <option value={50}>50 per page</option>
                </select>
              </div>

              {/* Sort Dropdown */}
              <div ref={dropdownRef} className="relative w-56">
                <button
                  onClick={() => setShowSortMenu(!showSortMenu)}
                  className="flex justify-between items-center gap-2 px-4 py-2 border border-gray-300 rounded w-full text-gray-800 z-10"
                >
                  <span className="text-sm">{sortBy || "Select"}</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform text-gray-800 ${
                      showSortMenu ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {showSortMenu && (
                  <div className="absolute mt-2 w-full bg-white border border-gray-200 rounded shadow z-10">
                    {sortOptions.map((option: any) => (
                      <div
                        key={option.value}
                        role="button"
                        onClick={() => applySorting(option)}
                        className="px-2 py-2 text-sm hover:bg-gray-100 text-gray-800 cursor-pointer"
                      >
                        {option.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Products Grid */}
          <div
            className={`grid gap-4 md:gap-3 ${
              viewMode === "grid"
                ? "grid-cols-2 md:grid-cols-2 lg:grid-cols-4"
                : "grid-cols-1"
            }`}
          >
            {sortedProducts?.length === 0 && (
              <div className="col-span-full text-center text-gray-500">
                No products found
              </div>
            )}
            {sortedProducts.map((item, index) => (
              <div key={index} className="shadow-2xl rounded-lg">
                <ProductCard
                  product={item}
                  ids={item?.id}
                  image={item?.images?.[0]?.image}
                  hoverImage={item?.images?.[1]?.image}
                  colors={item?.colors}
                  name={item?.name}
                  price={item?.price}
                  slug={item?.slug}
                />
              </div>
            ))}
          </div>

          {/* Pagination (only when no category/subcategory filter present) */}
          {selectedCategories.length === 0 &&
            selectedSubCategories.length === 0 && (
              <nav className="flex justify-center items-center mt-5 gap-2">
                <button
                  onClick={() => {
                    scrollToTop();
                    if (currentPage > 1) {
                      setCurrentPage((p) => p - 1);
                    }
                  }}
                  className={`w-10 h-10 flex items-center justify-center border text-gray-800 border-gray-300
                  hover:border-gray-400 rounded transition-colors
                  ${currentPage === 1 ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  ←
                </button>
                <p className="text-gray-800">{currentPage}</p>
                <button
                  onClick={() => {
                    if ((products as any)?.data?.length === limit) {
                      setCurrentPage((p) => p + 1);
                      scrollToTop();
                    }
                  }}
                  className={`w-10 h-10 flex items-center justify-center border text-gray-800 border-gray-300
                  hover:border-gray-400 rounded transition-colors
                  ${
                    (products as any)?.data?.length < limit
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                  }`}
                >
                  →
                </button>
              </nav>
            )}
        </div>
      </div>
      {/* </div> */}
    </div>
  );
};

export default ProductsPage;
