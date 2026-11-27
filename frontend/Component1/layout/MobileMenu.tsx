"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Heart,
  User,
  X,
  Home,
  Box,
  Layers,
  FileText,
  Users,
  Phone,
  LogOut,
  ChevronDown,
  ChevronRight,
  Globe,
  Truck,
  ShieldCheck,
  ShoppingCart,
  ShoppingBag,
} from "lucide-react";
import { useWishlistStore } from "@/store/useWishlistStore";
import { useUserStore, useIsLoggedIn } from "@/store/useUserStore";
import { processImageUrl } from "@/lib/utils";

export interface MobileMenuCategory {
  id?: string | number;
  name?: string;
  slug?: string;
}

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  categories: MobileMenuCategory[];
  isLoadingCategories?: boolean;
  isErrorCategories?: boolean;
  siteLogo?: string;
  siteLogoAlt?: string;
}

export default function MobileMenu({
  isOpen,
  onClose,
  categories,
  isLoadingCategories = false,
  isErrorCategories = false,
  siteLogo,
  siteLogoAlt,
}: MobileMenuProps) {
  const pathname = usePathname() ?? "/";
  const [isProductsOpen, setIsProductsOpen] = useState(false);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const { wishlist } = useWishlistStore();
  const isLoggedIn = useIsLoggedIn();
  const logout = useUserStore((state) => state.logout);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-close mobile menu when switching to desktop viewport (>= 768px)
  useEffect(() => {
    if (!isOpen) return;
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        onClose();
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isOpen, onClose]);

  // Lock background scroll while mobile menu is open
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  const isAuthenticated = mounted && isLoggedIn;

  return (
    <div className="md:hidden">
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[55]"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <aside
        aria-label="Mobile navigation"
        aria-hidden={!isOpen}
        className={`bg-white fixed top-0 left-0 h-full w-[74%] max-w-[305px] z-[60] shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col overflow-hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
        }`}
      >
        {/* Top Brand Banner with Pillar & Yellow Wave */}
        <div className="relative bg-gradient-to-b from-[#6e7175] to-[#525458] px-4 pt-3.5 pb-7 text-white shrink-0 overflow-hidden">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="absolute top-2.5 right-2.5 z-20 text-white/90 hover:text-white p-1 cursor-pointer"
          >
            <X size={20} />
          </button>

          {/* Decorative Architectural Pillar on Right */}
          <svg
            viewBox="0 0 64 110"
            aria-hidden="true"
            className="absolute right-1 bottom-2 w-12 h-20 opacity-85 pointer-events-none select-none"
          >
            <rect x="10" y="6" width="44" height="6" rx="2" fill="#e5e7eb" />
            <circle cx="13" cy="15" r="5" fill="#d1d5db" />
            <circle cx="51" cy="15" r="5" fill="#d1d5db" />
            <rect x="16" y="12" width="32" height="8" fill="#f3f4f6" />
            <rect x="18" y="20" width="28" height="78" fill="#e5e7eb" />
            <rect x="22" y="22" width="3" height="74" fill="#cbd5e1" />
            <rect x="30.5" y="22" width="3" height="74" fill="#cbd5e1" />
            <rect x="39" y="22" width="3" height="74" fill="#cbd5e1" />
            <rect x="12" y="98" width="40" height="8" rx="1" fill="#d1d5db" />
          </svg>

          <div className="relative z-10 flex flex-col items-center text-center">
            <img
              src={processImageUrl(siteLogo ?? "/Art-Kolkata-Logo.png")}
              alt={siteLogoAlt || "Art Kolkata Logo"}
              className="h-14 object-contain drop-shadow"
            />
            <p className="mt-1 text-[10.5px] font-medium text-white/95 tracking-wide">
              Cement Casting Mould Manufacturer
            </p>
            <div className="mt-0.5 flex items-center justify-center gap-2">
              <span className="h-[1.5px] w-7 bg-[#FFC107]" />
              <span className="text-[11px] italic font-semibold text-white/90">
                Since 2015
              </span>
              <span className="h-[1.5px] w-7 bg-[#FFC107]" />
            </div>
          </div>

          {/* Bottom Yellow Wave */}
          <svg
            viewBox="0 0 320 28"
            preserveAspectRatio="none"
            className="absolute bottom-0 left-0 w-full h-5 pointer-events-none z-10"
          >
            <path
              d="M0,10 Q80,26 160,12 T320,8 L320,28 L0,28 Z"
              fill="#FFC107"
            />
            <path
              d="M0,16 Q80,29 160,17 T320,14 L320,28 L0,28 Z"
              fill="#ffffff"
            />
          </svg>
        </div>

        {/* Scrollable Menu Content */}
        <nav className="flex-1 overflow-y-auto px-3.5 py-2 flex flex-col">
          <div className="flex flex-col">
            {/* Home */}
            <Link
              href="/"
              onClick={onClose}
              className={`flex items-center gap-3 px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                pathname === "/"
                  ? "bg-[#FFC107] text-gray-900 rounded-xl shadow-xs"
                  : "text-gray-800 hover:bg-gray-100 border-b border-gray-200"
              }`}
            >
              <Home size={18} className="shrink-0" />
              <span>Home</span>
            </Link>

            {/* Products (Expandable) */}
            <div className="border-b border-gray-200">
              <button
                type="button"
                onClick={() => setIsProductsOpen((prev) => !prev)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                  pathname.startsWith("/product")
                    ? "text-[#e6640d] font-semibold"
                    : "text-gray-800 hover:bg-gray-50"
                }`}
              >
                <span className="flex items-center gap-3">
                  <Box size={18} className="shrink-0 text-gray-700" />
                  <span>Products</span>
                </span>
                <ChevronDown
                  size={16}
                  className={`text-gray-500 transition-transform duration-200 ${
                    isProductsOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              {isProductsOpen && (
                <div className="pl-11 pr-3 pb-2 space-y-1">
                  <Link
                    href="/product"
                    onClick={onClose}
                    className="block py-1.5 text-xs font-medium text-gray-700 hover:text-black"
                  >
                    All Products
                  </Link>
                  <Link
                    href="/product?tag=Best+Seller"
                    onClick={onClose}
                    className="block py-1.5 text-xs font-medium text-gray-700 hover:text-black"
                  >
                    Best Sellers
                  </Link>
                </div>
              )}
            </div>

            {/* Product Categories (Expandable) */}
            <div className="border-b border-gray-200">
              <button
                type="button"
                onClick={() => setIsCategoriesOpen((prev) => !prev)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-3">
                  <Layers size={18} className="shrink-0 text-gray-700" />
                  <span>Product Categories</span>
                </span>
                <ChevronDown
                  size={16}
                  className={`text-gray-500 transition-transform duration-200 ${
                    isCategoriesOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              {isCategoriesOpen && (
                <div className="pl-11 pr-3 pb-2 space-y-1 max-h-44 overflow-y-auto">
                  {isLoadingCategories ? (
                    <p className="py-1 text-xs text-gray-500">Loading...</p>
                  ) : isErrorCategories ? (
                    <p className="py-1 text-xs text-red-500">
                      Unable to load categories
                    </p>
                  ) : (
                    categories.map((cat) => (
                      <Link
                        key={cat.id ?? cat.slug}
                        href={`/product?category=${encodeURIComponent(
                          cat.slug || "",
                        )}`}
                        onClick={onClose}
                        className="block py-1.5 text-xs font-medium text-gray-700 hover:text-[#e6640d]"
                      >
                        {cat.name}
                      </Link>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Blog */}
            <Link
              href="/blog"
              onClick={onClose}
              className={`flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium border-b border-gray-200 transition-colors ${
                pathname.startsWith("/blog")
                  ? "bg-[#FFC107] text-gray-900 font-semibold rounded-xl border-transparent"
                  : "text-gray-800 hover:bg-gray-50"
              }`}
            >
              <FileText size={18} className="shrink-0 text-gray-700" />
              <span>Blog</span>
            </Link>

            {/* About Us */}
            <Link
              href="/about"
              onClick={onClose}
              className={`flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium border-b border-gray-200 transition-colors ${
                pathname.startsWith("/about")
                  ? "bg-[#FFC107] text-gray-900 font-semibold rounded-xl border-transparent"
                  : "text-gray-800 hover:bg-gray-50"
              }`}
            >
              <Users size={18} className="shrink-0 text-gray-700" />
              <span>About Us</span>
            </Link>

            {/* Contact Us */}
            <Link
              href="/contact"
              onClick={onClose}
              className={`flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium border-b border-gray-200 transition-colors ${
                pathname.startsWith("/contact")
                  ? "bg-[#FFC107] text-gray-900 font-semibold rounded-xl border-transparent"
                  : "text-gray-800 hover:bg-gray-50"
              }`}
            >
              <Phone size={18} className="shrink-0 text-gray-700" />
              <span>Contact Us</span>
            </Link>

            {/* My Account */}
            <Link
              href="/account"
              onClick={onClose}
              className={`flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium border-b border-gray-200 transition-colors ${
                pathname.startsWith("/account")
                  ? "bg-[#FFC107] text-gray-900 font-semibold rounded-xl border-transparent"
                  : "text-gray-800 hover:bg-gray-50"
              }`}
            >
              <User size={18} className="shrink-0 text-gray-700" />
              <span>My Account</span>
            </Link>

            {/* Wishlist */}
            <Link
              href="/wishlist"
              onClick={onClose}
              className={`flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium border-b border-gray-200 transition-colors ${
                pathname.startsWith("/wishlist")
                  ? "bg-[#FFC107] text-gray-900 font-semibold rounded-xl border-transparent"
                  : "text-gray-800 hover:bg-gray-50"
              }`}
            >
              <Heart size={18} className="shrink-0 text-gray-700" />
              <span>Wishlist</span>
              <span className="bg-red-600 text-white text-[11px] font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">
                {wishlist.length}
              </span>
            </Link>

            {/* Log Out */}
            {isAuthenticated && (
              <button
                type="button"
                onClick={() => {
                  logout();
                  onClose();
                }}
                className="flex items-center gap-3 w-full text-left px-3.5 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 border-b border-gray-200 transition-colors cursor-pointer"
              >
                <LogOut size={18} className="shrink-0 text-red-600" />
                <span>Log Out</span>
              </button>
            )}
          </div>

          {/* 3 Feature Tiles */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="rounded-xl bg-gray-100 border border-gray-200/70 px-1.5 py-2.5 flex flex-col items-center text-center gap-1.5">
              <Globe className="w-6 h-6 text-gray-700" strokeWidth={1.5} />
              <span className="text-[10px] leading-tight font-medium text-gray-700">
                Pan India & Global Delivery
              </span>
            </div>
            <div className="rounded-xl bg-gray-100 border border-gray-200/70 px-1.5 py-2.5 flex flex-col items-center text-center gap-1.5">
              <div className="relative flex items-center justify-center">
                <div className="flex flex-col gap-[2px] -mr-0.5">
                  <span className="w-2.5 h-[2px] rounded-full bg-[#FFC107]" />
                  <span className="w-3.5 h-[2px] rounded-full bg-[#FFC107]" />
                  <span className="w-2 h-[2px] rounded-full bg-[#FFC107]" />
                </div>
                <Truck className="w-6 h-6 text-gray-700" strokeWidth={1.5} />
              </div>
              <span className="text-[10px] leading-tight font-medium text-gray-700">
                Delivery Within a Week
              </span>
            </div>
            <div className="rounded-xl bg-gray-100 border border-gray-200/70 px-1.5 py-2.5 flex flex-col items-center text-center gap-1.5">
              <div className="relative flex items-center justify-center">
                <Box className="w-6 h-6 text-gray-700" strokeWidth={1.5} />
                <span className="absolute -bottom-0.5 -right-1 w-3.5 h-3.5 rounded-full bg-[#FFC107] flex items-center justify-center shadow-xs">
                  <ShieldCheck
                    className="w-2.5 h-2.5 text-white"
                    strokeWidth={2.5}
                  />
                </span>
              </div>
              <span className="text-[10px] leading-tight font-medium text-gray-700">
                Secure Packaging
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2.5 mt-4 pb-2">
            <Link
              href={isAuthenticated ? "/account?tab=orders" : "/account"}
              onClick={onClose}
              className="w-full px-4 py-2.5 rounded-xl bg-[#FFC107] hover:bg-[#eab308] text-gray-900 font-bold text-sm flex items-center justify-between shadow-xs transition-colors"
            >
              <span className="flex items-center gap-3">
                <ShoppingCart size={18} />
                <span>Your Order</span>
              </span>
              <ChevronRight size={18} />
            </Link>

            <Link
              href="/product"
              onClick={onClose}
              className="w-full px-4 py-2.5 rounded-xl bg-white border border-gray-800 hover:bg-gray-50 text-gray-900 font-bold text-sm flex items-center justify-between transition-colors"
            >
              <span className="flex items-center gap-3">
                <ShoppingBag size={18} />
                <span>Keep Shopping</span>
              </span>
              <ChevronRight size={18} />
            </Link>
          </div>
        </nav>

        {/* Bottom Architectural Balustrade & Yellow Wave */}
        <div className="relative bg-white shrink-0 pt-1">
          <svg
            viewBox="0 0 320 44"
            preserveAspectRatio="none"
            aria-hidden="true"
            className="w-full h-11 block pointer-events-none select-none"
          >
            <g fill="#e2e5ea">
              <rect x="8" y="4" width="20" height="4" rx="1" />
              <rect x="11" y="8" width="14" height="28" />
              <rect x="7" y="34" width="22" height="5" />
              <polygon points="130,11 160,4 190,11" />
              <rect x="28" y="11" width="264" height="3" />
              <rect x="28" y="33" width="264" height="5" />
              <rect x="38" y="14" width="6" height="19" rx="2" />
              <rect x="54" y="14" width="6" height="19" rx="2" />
              <rect x="70" y="14" width="6" height="19" rx="2" />
              <rect x="86" y="14" width="6" height="19" rx="2" />
              <rect x="102" y="14" width="6" height="19" rx="2" />
              <rect x="118" y="14" width="6" height="19" rx="2" />
              <rect x="134" y="14" width="6" height="19" rx="2" />
              <rect x="150" y="14" width="6" height="19" rx="2" />
              <rect x="166" y="14" width="6" height="19" rx="2" />
              <rect x="182" y="14" width="6" height="19" rx="2" />
              <rect x="198" y="14" width="6" height="19" rx="2" />
              <rect x="214" y="14" width="6" height="19" rx="2" />
              <rect x="230" y="14" width="6" height="19" rx="2" />
              <rect x="246" y="14" width="6" height="19" rx="2" />
              <rect x="262" y="14" width="6" height="19" rx="2" />
              <rect x="278" y="14" width="6" height="19" rx="2" />
              <rect x="292" y="4" width="20" height="4" rx="1" />
              <rect x="295" y="8" width="14" height="28" />
              <rect x="291" y="34" width="22" height="5" />
            </g>
            <path
              d="M0,33 Q90,43 185,35 T320,33 L320,44 L0,44 Z"
              fill="#FFC107"
            />
          </svg>
        </div>
      </aside>
    </div>
  );
}
