"use client";

import React, { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Search } from "lucide-react";
import { getRequest } from "@/lib/fetcher";

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // DEBOUNCE INPUT
  useEffect(() => {
    const handler = setTimeout(() => {
      if (query.trim().length >= 3) {
        setDebouncedQuery(query.trim());
      } else {
        setDebouncedQuery(null);
      }
    }, 400);

    return () => clearTimeout(handler);
  }, [query]);

  // REACT QUERY
  const { data, isLoading, isError } = useQuery({
    queryKey: ["search-products", debouncedQuery],
    queryFn: () =>
      getRequest(
        `/api/v1/products?search=${encodeURIComponent(debouncedQuery!)}&limit=5`
      ),
    enabled: !!debouncedQuery, // 🔥 only fetch when query exists
    staleTime: 500,
    refetchOnWindowFocus: false,
  });

  // CLOSE DROPDOWN ON OUTSIDE CLICK
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setQuery("");
        setDebouncedQuery(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // CLOSE DROPDOWN ON ITEM CLICK
  const handleItemClick = () => {
    setQuery("");
    setDebouncedQuery(null);
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 px-4 py-2 border border-gray-300 focus:outline-none focus:border-gray-400"
    >
      {/* <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#fbe25e] w-5 h-5 z-10" /> */}

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search for products..."
        className="w-full pl-12 pr-4 py-3 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-all duration-300 text-sm md:text-base"
      />

      {query.trim().length >= 3 && (
        <div className="absolute top-full left-0 mt-2 w-full bg-white shadow-lg rounded-xl z-50 p-2 max-h-90 overflow-auto">
          {isLoading ? (
            <p className="text-gray-600 p-3 text-sm">Searching...</p>
          ) : isError ? (
            <p className="text-red-600 p-3 text-sm">Error fetching results.</p>
          ) : (data as any)?.data?.length > 0 ? (
            (data as any).data.map((item: any) => (
              <Link
                key={item.id}
                href={`/product/${item.slug}`}
                onClick={handleItemClick}
                className="flex items-center gap-3 p-2 hover:bg-gray-100 rounded-lg transition cursor-pointer"
              >
                <img
                  src={item?.images?.[0]?.image}
                  className="w-12 h-12 object-cover rounded-lg border"
                  alt={item.name}
                />
                <div>
                  <p className="font-medium text-gray-800 text-sm">
                    {item.name}
                  </p>
                  <p className="text-xs text-gray-500">₹{item.price}</p>
                </div>
              </Link>
            ))
          ) : (
            <p className="text-gray-600 p-3 text-sm">No products found.</p>
          )}
        </div>
      )}
    </div>
  );
}
