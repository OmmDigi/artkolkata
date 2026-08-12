"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Heart,
  ShoppingCart,
  User,
  Search,
  Menu,
  X,
  MapPin,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getRequest } from "@/lib/fetcher";
import { useWishlistStore } from "../../store/useWishlistStore";
import { useUserStore, useIsLoggedIn } from "../../store/useUserStore";
import ShoppingCartSidebar from "@/app/Component/trending/ShoppingCartSidebar";
import LanguageSelector from "@/app/Component/LanguageSelector";
import { useSiteInfo } from "@/hooks/useSiteSettings";

interface ApiCategory {
  id?: string | number;
  name?: string;
  slug?: string;
  image?: string;
  alt_tag?: string;
  sub_categories?: any[];
}
export default function Navbar() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState<string | null>(null);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchQuery.trim().length >= 3) setDebouncedQuery(searchQuery.trim());
      else setDebouncedQuery(null);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const {
    data: searchResults,
    isLoading: isSearchLoading,
    isError: isSearchError,
  } = useQuery({
    queryKey: ["searchProducts", debouncedQuery],
    queryFn: () =>
      getRequest<any>(
        `/api/v1/products?search=${encodeURIComponent(debouncedQuery!)}&limit=5`,
      ),
    enabled: !!debouncedQuery,
  });
  const [locationLabel, setLocationLabel] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [locationError, setLocationError] = useState("");
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const lastScrollY = useRef(0);

  const [placeholderText, setPlaceholderText] = useState("Search products...");
  const [ribbonText, setRibbonText] = useState("");

  const { data: siteInfo } = useSiteInfo();

  useEffect(() => {
    const fullText = "End of Summer Sale is Live";
    let currentCharIdx = 0;
    let isDeleting = false;
    let timeoutId: NodeJS.Timeout;

    const type = () => {
      if (isDeleting) {
        setRibbonText(fullText.substring(0, currentCharIdx - 1));
        currentCharIdx--;
      } else {
        setRibbonText(fullText.substring(0, currentCharIdx + 1));
        currentCharIdx++;
      }

      let typeSpeed = isDeleting ? 50 : 100;

      if (!isDeleting && currentCharIdx === fullText.length) {
        typeSpeed = 3000; // pause at end for 3 seconds
        isDeleting = true;
      } else if (isDeleting && currentCharIdx === 0) {
        isDeleting = false;
        typeSpeed = 1000; // pause before typing again
      }

      timeoutId = setTimeout(type, typeSpeed);
    };

    timeoutId = setTimeout(type, 500);

    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        isDropdownOpen &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsDropdownOpen(false);
      }
      if (
        isLocationModalOpen &&
        modalRef.current &&
        !modalRef.current.contains(target)
      ) {
        setIsLocationModalOpen(false);
      }
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(target)
      ) {
        setSearchQuery("");
        setDebouncedQuery(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDropdownOpen, isLocationModalOpen]);

  const {
    data: categoryData,
    isLoading: isLoadingCategories,
    isError: isErrorCategories,
  } = useQuery({
    queryKey: ["categories"],
    queryFn: () =>
      getRequest<{ data: ApiCategory[] }>("/api/v1/products/category?limit=-1"),
  });

  useEffect(() => {
    if (!categoryData?.data || categoryData.data.length === 0) return;

    let currentCategoryIdx = 0;
    let currentCharIdx = 11; // Start typing after "Search for "
    let isDeleting = false;
    let timeoutId: NodeJS.Timeout;

    const type = () => {
      const currentCategory =
        categoryData.data[currentCategoryIdx].name || "products";
      const fullText = `Search for ${currentCategory}`;

      if (isDeleting) {
        setPlaceholderText(fullText.substring(0, currentCharIdx - 1));
        currentCharIdx--;
      } else {
        setPlaceholderText(fullText.substring(0, currentCharIdx + 1));
        currentCharIdx++;
      }

      let typeSpeed = isDeleting ? 30 : 100;

      if (!isDeleting && currentCharIdx === fullText.length) {
        typeSpeed = 2000; // pause at end
        isDeleting = true;
      } else if (isDeleting && currentCharIdx <= 11) {
        isDeleting = false;
        currentCategoryIdx =
          (currentCategoryIdx + 1) % categoryData.data.length;
        typeSpeed = 500; // pause before typing next
      }

      timeoutId = setTimeout(type, typeSpeed);
    };

    timeoutId = setTimeout(type, 100);

    return () => clearTimeout(timeoutId);
  }, [categoryData]);

  const fetchPinDetails = async (pin: string) => {
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
      const data = await res.json();

      if (
        !Array.isArray(data) ||
        data.length === 0 ||
        data[0].Status !== "Success"
      ) {
        setPinError("Invalid pin code. Please try again.");
        return;
      }

      const postOffice = data[0].PostOffice?.[0];
      if (!postOffice) {
        setPinError("No post office found for this pin code.");
        return;
      }

      const firstWord =
        postOffice.Name?.split(" ")[0] ||
        postOffice.Name ||
        postOffice.District ||
        "Location";
      setLocationLabel(firstWord);
      setPostalCode(pin);
      setLocationError("");
      setPinError("");
      setIsLocationModalOpen(false);
    } catch (error) {
      setPinError("Unable to fetch pin details. Please try again.");
    }
  };

  const handleLocationButton = () => {
    setPinError("");
    setIsLocationModalOpen(true);
  };

  const handlePinSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!pinInput.trim()) {
      setPinError("Enter a pin code.");
      return;
    }

    await fetchPinDetails(pinInput.trim());
  };

  const { wishlist } = useWishlistStore();
  const isLoggedIn = useIsLoggedIn();
  const user = useUserStore((state) => state.user);
  const logout = useUserStore((state) => state.logout);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isAuthenticated = mounted && isLoggedIn;

  return (
    <>
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-200 transition-colors duration-300 ease-in-out shadow-sm">
        {/* Top Ribbon (Mobile Only) */}
        <div className="md:hidden bg-[#cb2b2b] text-white text-[12px] py-[5px] px-[10px] text-center min-h-[28px] max-h-[35px] flex items-center justify-center w-full">
          <Link
            href="/product"
            className="tracking-[1.2px] hover:underline uppercase font-medium"
          >
            {ribbonText}
            <span className="animate-pulse">|</span>
          </Link>
        </div>

        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-15 relative">
            {/* Mobile Menu Button (Left on Mobile) */}
            <button
              className="md:hidden transition text-gray-700 hover:text-gray-900 z-10"
              onClick={() => setIsMenuOpen(true)}
            >
              <Menu size={24} />
            </button>

            {/* Mobile Cart Button  and Language button */}
            {/* <div className="flex">
              <div className="md:hidden z-10 text-gray-700 hover:text-gray-900">
                <LanguageSelector />
              </div>
              <div className="md:hidden z-10 text-gray-700 hover:text-gray-900">
                <ShoppingCartSidebar variant="amazon" />
              </div>
            </div> */}

            {/* Logo */}
            <div className="flex items-center justify-center absolute inset-0 pointer-events-none md:static md:inset-auto md:justify-start md:pointer-events-auto md:gap-2">
              <Link
                href="/"
                className="text-2xl font-bold text-gray-900 transition pointer-events-auto"
              >
                <img
                  src={siteInfo?.site_logo || "/Art-Kolkata-Logo.png"}
                  alt={siteInfo?.site_logo_alt || "Art Kolkata Logo"}
                  className="h-12 md:h-16 object-contain"
                />
              </Link>
              <div
                onClick={handleLocationButton}
                className="cursor-pointer hidden lg:flex items-center gap-3 text-sm text-gray-700 pointer-events-auto"
              >
                <MapPin size={18} className="text-orange-500" />
                <div className="flex flex-col leading-tight">
                  <span className="text-xs uppercase tracking-wide text-gray-500">
                    Delivering to
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="text-xs text-blue-600 cursor-pointer"
                    >
                      {locationLabel && postalCode
                        ? `${locationLabel} - ${postalCode}`
                        : "Enter pin code"}
                    </button>
                  </div>
                </div>
              </div>
              {locationError && (
                <span className="hidden lg:block text-xs text-red-500 pointer-events-auto">
                  {locationError}
                </span>
              )}
            </div>

            {/* Search Bar with Category Dropdown */}
            <div
              className="hidden md:flex items-center flex-1 mx-4"
              ref={searchContainerRef}
            >
              <div className="relative w-full">
                <div className="flex items-center border border-gray-300 rounded-md overflow-visible bg-white">
                  {/* Category Dropdown Button */}
                  <div
                    className="relative"
                    ref={dropdownRef}
                    onMouseEnter={() => setIsDropdownOpen(true)}
                    onMouseLeave={() => setIsDropdownOpen(false)}
                  >
                    <button
                      onClick={() => setIsDropdownOpen((prev) => !prev)}
                      className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 transition flex items-center space-x-2 min-w-max border-r border-gray-300 h-full"
                    >
                      <span className="text-sm font-medium">All </span>
                      <svg
                        className={`w-4 h-4 transition ${isDropdownOpen ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 14l-7 7m0 0l-7-7m7 7V3"
                        />
                      </svg>
                    </button>

                    {/* Dropdown Menu */}
                    {isDropdownOpen && (
                      <div className="absolute top-full left-0 w-72 bg-white border border-gray-200 rounded-md shadow-lg mt-0 max-h-96 overflow-y-auto z-50">
                        {isLoadingCategories ? (
                          <div className="px-4 py-2 text-gray-500 text-sm">
                            Loading categories...
                          </div>
                        ) : isErrorCategories ? (
                          <div className="px-4 py-2 text-gray-500 text-sm">
                            Error loading categories
                          </div>
                        ) : categoryData?.data &&
                          categoryData.data.length > 0 ? (
                          categoryData?.data?.map((category) => (
                            <Link
                              key={category.id}
                              href={`/product?category=${category.slug}`}
                              className="block hover:bg-gray-200 transition border-b border-gray-100 last:border-b-0"
                              onClick={() => setIsDropdownOpen(false)}
                            >
                              <div className="flex items-center space-x-3 p-3">
                                {category.image && (
                                  <img
                                    src={category.image}
                                    alt={category.alt_tag || category.name}
                                    className="w-16 h-16 object-cover rounded"
                                  />
                                )}
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-gray-900">
                                    {category.name}
                                  </div>
                                </div>
                              </div>
                            </Link>
                          ))
                        ) : (
                          <div className="px-4 py-2 text-gray-500 text-sm">
                            No categories available
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Search Input */}
                  <input
                    type="text"
                    placeholder={placeholderText}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 px-4 py-2 outline-none text-sm text-black"
                  />

                  {/* Search Button */}
                  <button className="px-4 py-2 bg-orange-500 hover:bg-orange-600 transition text-white border-l border-gray-300 rounded-r-md">
                    <Search size={18} />
                  </button>
                </div>

                {/* Search Results Dropdown */}
                {searchQuery.trim().length >= 3 && (
                  <div className="absolute top-full left-0 mt-1 w-full bg-white shadow-lg rounded-md border border-gray-200 z-50 p-2 max-h-96 overflow-y-auto">
                    {isSearchLoading ? (
                      <p className="text-gray-600 p-3 text-sm">Searching...</p>
                    ) : isSearchError ? (
                      <p className="text-red-600 p-3 text-sm">
                        Error fetching results.
                      </p>
                    ) : searchResults?.data?.length > 0 ? (
                      searchResults.data.map((item: any) => (
                        <Link
                          key={item.id}
                          href={`/product/${item.slug}`}
                          onClick={() => {
                            setSearchQuery("");
                            setDebouncedQuery(null);
                          }}
                          className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded transition cursor-pointer border-b border-gray-100 last:border-0"
                        >
                          <img
                            src={item?.images?.[0]?.image || item?.image1}
                            className="w-12 h-12 object-cover rounded border"
                            alt={item.name}
                          />
                          <div>
                            <p className="font-medium text-gray-800 text-sm">
                              {item.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              ₹{item.price}
                            </p>
                          </div>
                        </Link>
                      ))
                    ) : (
                      <p className="text-gray-600 p-3 text-sm">
                        No products found.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="ml-4 flex-shrink-0">
              <LanguageSelector />
            </div>

            {/* Desktop Navigation Links (Moved to Right) */}
            <nav className="hidden lg:flex items-center space-x-8"></nav>

            {/* Right Icons */}
            <div className="hidden md:flex items-center space-x-6 text-gray-700">
              {/* Account Dropdown */}
              <div className="relative transition hover:text-gray-900 cursor-pointer group">
                <div className="flex flex-col text-sm leading-tight">
                  <span className="text-[11px] text-gray-500 font-medium">
                    Hello, {isAuthenticated ? user?.name || "User" : "sign in"}
                  </span>
                  <span className="font-bold flex items-center text-[13px]">
                    Account & Lists
                    <svg
                      className="w-4 h-4 ml-0.5 text-gray-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </span>
                </div>

                {/* Dropdown Menu */}
                <div className="absolute top-full right-0 mt-2 w-56 bg-white border border-gray-200 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <div className="py-2 flex flex-col">
                    <div className="px-4 py-2 text-sm font-bold border-b border-gray-100">
                      Your Account
                    </div>
                    <Link
                      href={isAuthenticated ? "/account" : "/account"}
                      className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-orange-500"
                    >
                      Your Account
                    </Link>
                    <Link
                      href={
                        isAuthenticated ? "/account?tab=orders" : "/account"
                      }
                      className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-orange-500"
                    >
                      Your Orders
                    </Link>
                    <Link
                      href="/wishlist"
                      className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-orange-500"
                    >
                      Your Wish List
                    </Link>
                    <Link
                      href="/product"
                      className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-orange-500"
                    >
                      Keep shopping
                    </Link>
                    {isAuthenticated && (
                      <button
                        onClick={() => {
                          (logout(), router.push("/"));
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-orange-500"
                      >
                        Logout
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Wishlist */}
              <Link
                href="/wishlist"
                className="flex items-center text-gray-800 hover:text-orange-500 transition-colors"
              >
                <div className="relative flex items-end">
                  <Heart className="w-8 h-8" strokeWidth={1.5} />
                  <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-[11px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-sm">
                    {wishlist.length}
                  </span>
                </div>
              </Link>

              {/* Cart */}
              <div className="relative hover:text-gray-900">
                <ShoppingCartSidebar variant="amazon" />
              </div>
            </div>
          </div>
        </div>
        {/* Mobile Search Bar */}
        <div className="md:hidden w-full px-4 pb-3 pt-1">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-500 h-4 w-4" />
            <input
              type="text"
              placeholder={placeholderText}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-400 rounded-full text-sm text-black focus:outline-none focus:border-gray-500"
            />
            {/* Mobile Search Results Dropdown */}
            {searchQuery.trim().length >= 3 && (
              <div className="absolute top-full left-0 mt-1 w-full bg-white shadow-lg rounded-md border border-gray-200 z-50 p-2 max-h-96 overflow-y-auto">
                {isSearchLoading ? (
                  <p className="text-gray-600 p-3 text-sm">Searching...</p>
                ) : isSearchError ? (
                  <p className="text-red-600 p-3 text-sm">
                    Error fetching results.
                  </p>
                ) : searchResults?.data?.length > 0 ? (
                  searchResults.data.map((item: any) => (
                    <Link
                      key={item.id}
                      href={`/product/${item.slug}`}
                      onClick={() => {
                        setSearchQuery("");
                        setDebouncedQuery(null);
                      }}
                      className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded transition cursor-pointer border-b border-gray-100 last:border-0"
                    >
                      <img
                        src={item?.images?.[0]?.image || item?.image1}
                        className="w-12 h-12 object-cover rounded border"
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
                  <p className="text-gray-600 p-3 text-sm">
                    No products found.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[55] md:hidden"
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      {/* Mobile Menu Sidebar */}
      <div
        className={`bg-white fixed top-0 left-0 h-full w-[70%] max-w-sm  z-[60] shadow-2xl transform transition-transform duration-300 ease-in-out md:hidden ${isMenuOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex text-black justify-between items-center p-4 border-b border-gray-200">
          <span className="font-bold text-lg">Menu</span>
          <button onClick={() => setIsMenuOpen(false)}>
            <X size={24} />
          </button>
        </div>
        <nav className="flex flex-col p-4 space-y-4 overflow-y-auto">
          <Link
            href="/"
            onClick={() => setIsMenuOpen(false)}
            className="text-gray-700 hover:text-gray-900 font-medium text-lg border-b pb-2"
          >
            Home
          </Link>
          <Link
            href="/product"
            onClick={() => setIsMenuOpen(false)}
            className="text-gray-700 hover:text-gray-900 font-medium text-lg border-b pb-2"
          >
            Product
          </Link>
          <Link
            href="/blog"
            onClick={() => setIsMenuOpen(false)}
            className="text-gray-700 hover:text-gray-900 font-medium text-lg border-b pb-2"
          >
            Blog
          </Link>
          <Link
            href="/about"
            onClick={() => setIsMenuOpen(false)}
            className="text-gray-700 hover:text-gray-900 font-medium text-lg border-b pb-2"
          >
            About Us
          </Link>
          <Link
            href="/contact"
            onClick={() => setIsMenuOpen(false)}
            className="text-gray-700 hover:text-gray-900 font-medium text-lg border-b pb-2"
          >
            Contact Us
          </Link>

          <div className="pt-4 mt-2">
            <Link
              href={isAuthenticated ? "/account" : "/account"}
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center text-gray-700 hover:text-gray-900 font-medium text-lg border-b pb-2 mb-4"
            >
              <User size={20} className="mr-3" /> My Account
            </Link>
            {isAuthenticated && (
              <button
                onClick={() => {
                  logout();
                  setIsMenuOpen(false);
                }}
                className="flex items-center w-full text-left text-gray-700 hover:text-gray-900 font-medium text-lg border-b pb-2 mb-4"
              >
                <User size={20} className="mr-3" /> Logout
              </button>
            )}
            <Link
              href="/wishlist"
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center text-gray-700 hover:text-gray-900 font-medium text-lg border-b pb-2"
            >
              <Heart size={20} className="mr-3" />
              Wishlist
              <span className="ml-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {wishlist.length}
              </span>
            </Link>
          </div>
        </nav>
      </div>

      {isLocationModalOpen && (
        <div className="fixed inset-0 z-50 flex min-h-screen items-center justify-center bg-black/40 p-4">
          <div
            ref={modalRef}
            className="w-full max-w-md rounded-sm bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Enter Pin Code
                </h2>
                <p className="text-sm text-gray-500">
                  Use the postal pin to set your delivery location.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsLocationModalOpen(false)}
                className="text-gray-500 hover:text-gray-900"
              >
                ×
              </button>
            </div>
            <form onSubmit={handlePinSubmit} className="px-6 py-5">
              <label className="block text-sm font-medium text-gray-700">
                Pin Code
              </label>
              <input
                type="text"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="110001"
                className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-black focus:border-orange-500 focus:outline-none"
              />
              {pinError && (
                <p className="mt-3 text-sm text-red-500">{pinError}</p>
              )}
              <button
                type="submit"
                className="mt-5 w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-600"
              >
                Submit
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
