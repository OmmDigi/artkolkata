"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getRequest } from "@/lib/fetcher";
import { Menu, X } from "lucide-react";

interface ApiCategory {
  id?: string | number;
  name?: string;
  slug?: string;
  image?: string;
  alt_tag?: string;
  sub_categories?: any[];
}
export default function SubNav() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [show, setShow] = useState(true);
  const [isProductHover, setIsProductHover] = useState(false);
  const [isSubNavMenuOpen, setIsSubNavMenuOpen] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY.current && currentScrollY > 50) {
        setShow(false);
      } else if (currentScrollY < lastScrollY.current) {
        setShow(true);
      }
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const {
    data: categoryData,
    isLoading: isLoadingCategories,
    isError: isErrorCategories,
  } = useQuery({
    queryKey: ["categories"],
    queryFn: () =>
      getRequest<{ data: ApiCategory[] }>("/api/v1/products/category"),
  });

  const navItems = [
    { href: "/", label: "Home" },
    { href: "/product", label: "Product" },
    { href: "/blog", label: "Blogs" },
    { href: "/about", label: "About" },
    { href: "/contact", label: "Contact" },
  ];

  const categories = categoryData?.data ?? [];
  const productCards = categories.slice(0, 14);

  const getActiveHref = () => {
    if (pathname === "/") return "/";
    if (pathname.startsWith("/product")) return "/product";
    if (pathname.startsWith("/blog")) return "/blog";
    if (pathname.startsWith("/about")) return "/about";
    if (pathname.startsWith("/contact")) return "/contact";
    return pathname;
  };

  const activeHref = getActiveHref();

  const handleNavClick = (
    href: string,
    e: React.MouseEvent<HTMLAnchorElement>,
  ) => {
    e.preventDefault();
    router.push(href);
  };

  return (
    <nav
      className={`hidden md:block sticky top-15 shadow-2xl bg-gray-800 border-t border-gray-700 transition-all duration-300 z-40 ${show ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
        }`}
      aria-label="Sub navigation"
    >
      <div className="max-w-9xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Hamburger Icon */}
        <button
          onClick={() => setIsSubNavMenuOpen(true)}
          onMouseEnter={() => setIsSubNavMenuOpen(true)}
          className=" cursor-pointer absolute left-4 sm:left-6 lg:left-8 top-1/2 -translate-y-1/2 text-gray-300 hover:text-white transition flex items-center gap-2"
        >
          <Menu size={20} />
          <span className="text-sm font-medium hidden lg:block">ALL</span>
        </button>

        <ul className="flex justify-center gap-8 py-1">
          {navItems.map((item) => {
            const isActive = item.href === activeHref;
            const isProduct = item.href === "/product";
            return (
              <li
                key={item.href}
                className={isProduct ? "relative" : undefined}
                onMouseEnter={
                  isProduct ? () => setIsProductHover(true) : undefined
                }
                onMouseLeave={
                  isProduct ? () => setIsProductHover(false) : undefined
                }
              >
                <a
                  href={item.href}
                  onClick={(e) => handleNavClick(item.href, e)}
                  aria-current={isActive ? "page" : undefined}
                  className={`text-sm font-medium transition-colors duration-200 pb-0 ${isActive
                    ? "text-white border-b-2 border-white"
                    : "text-gray-300 hover:text-white"
                    }`}
                >
                  {item.label}
                </a>
                {isProduct && isProductHover && (
                  <div className="absolute left-1/2 top-full z-50 mt-0 w-[68rem] -translate-x-1/2 rounded-sm border border-gray-200 bg-white p-4 shadow-2xl">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-900">
                        Shop by Category
                      </span>
                    </div>
                    <div className="grid grid-cols-7 gap-3">
                      {isLoadingCategories ? (
                        <div className="col-span-2 rounded-sm bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                          Loading categories...
                        </div>
                      ) : isErrorCategories ? (
                        <div className="col-span-2 rounded-sm bg-gray-50 px-4 py-6 text-center text-sm text-red-500">
                          Unable to load categories
                        </div>
                      ) : productCards.length === 0 ? (
                        <div className="col-span-2 rounded-sm bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                          No categories available
                        </div>
                      ) : (
                        productCards.map((category) => (
                          <button
                            key={category.id ?? category.slug}
                            type="button"
                            onClick={() => {
                              router.push(`/product?category=${category.slug}`);
                              setIsProductHover(false);
                            }}
                            className="group overflow-hidden rounded-sm border border-gray-200 bg-white text-left transition hover:-translate-y-0.5 hover:shadow-xl"
                          >
                            <div className="h-28 w-full overflow-hidden bg-gray-100">
                              {category.image ? (
                                <img
                                  src={category.image}
                                  alt={
                                    category.alt_tag ??
                                    category.name ??
                                    "Category"
                                  }
                                  className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center text-sm text-gray-500">
                                  No image
                                </div>
                              )}
                            </div>
                            <div className="space-y-1 p-3">
                              <p className="truncate text-sm font-semibold text-gray-900">
                                {category.name ?? "Category"}
                              </p>
                              <p className="text-xs text-gray-500">
                                View products
                              </p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Sidebar Overlay */}
      {isSubNavMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[55]"
          onClick={() => setIsSubNavMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        onMouseLeave={() => setIsSubNavMenuOpen(false)}
        className={`fixed top-0 left-0 h-screen w-[20%] min-w-[250px] bg-white z-[60] shadow-2xl transform transition-transform duration-300 ease-in-out ${isSubNavMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="text-black flex justify-between items-center p-4 border-b border-gray-200 bg-white">
          <span className="font-bold text-lg">Categories</span>
          <button onClick={() => setIsSubNavMenuOpen(false)} className="text-gray-500 hover:text-black">
            <X size={24} />
          </button>
        </div>
        <div className="overflow-y-auto h-[calc(100vh-60px)] p-4 space-y-3">
          {isLoadingCategories ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : isErrorCategories ? (
            <p className="text-sm text-red-500">Error loading categories</p>
          ) : categories.length === 0 ? (
            <p className="text-sm text-gray-500">No categories</p>
          ) : (
            categories.map(category => (
              <button
                key={category.id ?? category.slug}
                onClick={() => {
                  router.push(`/product?category=${category.slug}`);
                  setIsSubNavMenuOpen(false);
                }}
                className="w-full flex items-center gap-0 p-1 hover:bg-gray-50 transition rounded-md border border-transparent hover:border-gray-200 text-left"
              >
                {category.image ? (
                  <img src={category.image} alt={category.alt_tag || category.name || "Category"} className="w-8 h-8 object-cover rounded shadow-sm" />
                ) : (
                  <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center shadow-sm">
                    <span className="text-xs text-gray-500">No Img</span>
                  </div>
                )}
                <span className="font-medium text-sm text-gray-800">{category.name || "Category"}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </nav>
  );
}
