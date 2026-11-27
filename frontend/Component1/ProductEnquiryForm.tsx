"use client";

import React, { useEffect, useState } from "react";
import {
  User,
  Phone,
  Box,
  Hash,
  MessageCircle,
  Wrench,
  ChevronRight,
  ChevronDown,
  Send,
  Layers,
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { getRequest, postRequest } from "@/lib/fetcher";
import { useSiteInfo } from "@/hooks/useSiteSettings";

interface Category {
  id: number;
  name: string;
}

const ENQUIRY_TYPES = [
  {
    value: "bulk_order",
    label: "Bulk Order",
    subtitle: "For large quantity requirements",
    icon: Box,
    iconBg: "bg-blue-50 text-blue-600",
    activeRing: "border-blue-500 bg-blue-50/40",
  },
  {
    value: "custom_frp_mould",
    label: "Custom FRP Mould",
    subtitle: "Share your design or requirements",
    icon: Wrench,
    iconBg: "bg-orange-50 text-[#e6640d]",
    activeRing: "border-[#e6640d] bg-orange-50/50",
  },
] as const;

const EMPTY_FORM = {
  name: "",
  phone: "",
  enquiry_type: "",
  category_id: "",
  quantity: "",
  message: "",
};

export default function ProductEnquiryForm({
  categoryId,
}: {
  categoryId?: number;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    category_id: categoryId ? String(categoryId) : "",
  });
  const [errorKeys, setErrorKeys] = useState<string[]>([]);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: siteInfo } = useSiteInfo();
  const primaryPhone =
    siteInfo?.contact_phones?.find((p) => p.is_primary) ??
    siteInfo?.contact_phones?.[0];
  const rawPhone = primaryPhone?.value || "8621803898";
  const digitsOnly = rawPhone.replace(/\D/g, "");
  const waPhone =
    digitsOnly.length === 10 ? `91${digitsOnly}` : digitsOnly || "918621803898";
  const displayPhone =
    digitsOnly.length === 10 ? `+91 ${digitsOnly}` : rawPhone;
  const telHref = `tel:+${waPhone}`;

  useEffect(() => {
    getRequest<{ data: Category[] }>(
      "/api/v1/products/category?page=1&limit=-1",
    )
      .then((res) => setCategories(res.data ?? []))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (categoryId) {
      setForm((prev) => ({ ...prev, category_id: String(categoryId) }));
    }
  }, [categoryId]);

  const setField =
    (field: keyof typeof EMPTY_FORM) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => {
      const value = e.target.value;
      setForm((prev) => ({ ...prev, [field]: value }));
      if (errorKeys.includes(field)) {
        setErrorKeys((prev) => prev.filter((k) => k !== field));
      }
    };

  const selectEnquiryType = (value: string) => {
    setForm((prev) => ({ ...prev, enquiry_type: value }));
    if (errorKeys.includes("enquiry_type")) {
      setErrorKeys((prev) => prev.filter((k) => k !== "enquiry_type"));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatus(null);
    setErrorKeys([]);

    try {
      const res = await postRequest<{ message: string }>({
        url: "/api/v1/website/product-enquiry",
        body: {
          name: form.name,
          phone: form.phone,
          enquiry_type: form.enquiry_type,
          category_id: Number(form.category_id),
          quantity: form.quantity,
          message: form.message,
        },
      });
      setStatus({
        ok: true,
        text:
          res?.message ||
          "Thank you! We have received your enquiry and will contact you soon.",
      });
      setForm({
        ...EMPTY_FORM,
        category_id: categoryId ? String(categoryId) : "",
      });
    } catch (error: any) {
      const data = error?.response?.data;
      setErrorKeys(Array.isArray(data?.key) ? data.key : []);
      setStatus({
        ok: false,
        text:
          data?.message ?? "Could not send your enquiry. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputBorderClass = (field: string) =>
    errorKeys.includes(field)
      ? "border-red-500 focus-within:border-red-500"
      : "border-gray-200 focus-within:border-[#e6640d]";

  return (
    <section
      aria-label="Product Enquiry"
      className="w-full bg-[#f4f5f7] py-12 md:py-16 px-4 sm:px-6 lg:px-12 border-t border-gray-200/70"
    >
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left Info & Quick Actions */}
        <div className="lg:col-span-6">
          <p className="text-xs font-bold uppercase tracking-widest text-[#e6640d] mb-2">
            GET IN TOUCH
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold text-gray-900 leading-tight">
            Need a Custom{" "}
            <span className="text-[#e6640d]">FRP Mould?</span>
          </h2>
          <p className="mt-3 text-sm sm:text-base text-gray-600 max-w-lg leading-relaxed">
            Share the product, size and quantity — or a drawing for custom
            finishing. We will respond with availability and specifications.
          </p>

          {/* WhatsApp & Call CTAs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-7">
            <a
              href={`https://wa.me/${waPhone}?text=${encodeURIComponent(
                "Hello! I have a product enquiry.",
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#16c75e] hover:bg-[#13b052] text-white font-bold text-xs uppercase tracking-wider py-3.5 px-5 shadow-sm transition-colors"
            >
              <FaWhatsapp className="w-4 h-4 shrink-0" />
              <span>ENQUIRE ON WHATSAPP</span>
            </a>

            <a
              href={telHref}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#e6640d] hover:bg-[#cf5609] text-white font-bold text-xs uppercase tracking-wider py-3.5 px-5 shadow-sm transition-colors"
            >
              <Phone className="w-4 h-4 shrink-0" />
              <span>CALL {displayPhone}</span>
            </a>
          </div>

          {/* Enquiry Type Quick Select Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-4">
            {ENQUIRY_TYPES.map((type) => {
              const Icon = type.icon;
              const isSelected = form.enquiry_type === type.value;
              return (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => selectEnquiryType(type.value)}
                  className={`flex items-center justify-between gap-3 rounded-xl border p-4 text-left transition-all cursor-pointer shadow-xs ${
                    isSelected
                      ? type.activeRing
                      : "border-gray-200/80 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${type.iconBg}`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900">
                        {type.label}
                      </p>
                      <p className="text-xs text-gray-500 leading-snug">
                        {type.subtitle}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Form Card */}
        <div className="lg:col-span-6">
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl border border-gray-200/80 shadow-lg p-6 sm:p-8 space-y-3.5"
          >
            <p className="text-xs font-bold uppercase tracking-widest text-[#e6640d] mb-2">
              SEND PRODUCT ENQUIRY
            </p>

            {/* Name */}
            <div
              className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 bg-white transition-colors ${inputBorderClass("name")}`}
            >
              <User className="w-4 h-4 text-gray-400 shrink-0" />
              <input
                type="text"
                required
                maxLength={120}
                placeholder="Your name *"
                value={form.name}
                onChange={setField("name")}
                className="w-full text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none bg-transparent"
              />
            </div>

            {/* Phone */}
            <div
              className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 bg-white transition-colors ${inputBorderClass("phone")}`}
            >
              <Phone className="w-4 h-4 text-gray-400 shrink-0" />
              <input
                type="tel"
                inputMode="tel"
                required
                placeholder="Your phone number *"
                value={form.phone}
                onChange={setField("phone")}
                className="w-full text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none bg-transparent"
              />
            </div>

            {/* Enquiry Type */}
            <div
              className={`relative flex items-center gap-3 rounded-xl border px-3.5 py-2.5 bg-white transition-colors ${inputBorderClass("enquiry_type")}`}
            >
              <Layers className="w-4 h-4 text-gray-400 shrink-0" />
              <select
                required
                value={form.enquiry_type}
                onChange={setField("enquiry_type")}
                className={`w-full appearance-none text-sm focus:outline-none bg-transparent pr-6 cursor-pointer ${
                  form.enquiry_type ? "text-gray-900" : "text-gray-400"
                }`}
              >
                <option value="" disabled>
                  Select enquiry type *
                </option>
                {ENQUIRY_TYPES.map((type) => (
                  <option
                    key={type.value}
                    value={type.value}
                    className="text-gray-900"
                  >
                    {type.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 pointer-events-none shrink-0" />
            </div>

            {/* Product Category */}
            <div
              className={`relative flex items-center gap-3 rounded-xl border px-3.5 py-2.5 bg-white transition-colors ${inputBorderClass("category_id")}`}
            >
              <Box className="w-4 h-4 text-gray-400 shrink-0" />
              <select
                required
                value={form.category_id}
                onChange={setField("category_id")}
                className={`w-full appearance-none text-sm focus:outline-none bg-transparent pr-6 cursor-pointer ${
                  form.category_id ? "text-gray-900" : "text-gray-400"
                }`}
              >
                <option value="" disabled>
                  Select category *
                </option>
                {categories.map((cat) => (
                  <option
                    key={cat.id}
                    value={cat.id}
                    className="text-gray-900"
                  >
                    {cat.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 pointer-events-none shrink-0" />
            </div>

            {/* Quantity */}
            <div
              className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 bg-white transition-colors ${inputBorderClass("quantity")}`}
            >
              <Hash className="w-4 h-4 text-gray-400 shrink-0" />
              <input
                type="text"
                maxLength={100}
                placeholder="Quantity (e.g. 50 pieces)"
                value={form.quantity}
                onChange={setField("quantity")}
                className="w-full text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none bg-transparent"
              />
            </div>

            {/* Message */}
            <div
              className={`flex items-start gap-3 rounded-xl border px-3.5 py-2.5 bg-white transition-colors ${inputBorderClass("message")}`}
            >
              <MessageCircle className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
              <textarea
                rows={3}
                maxLength={2000}
                placeholder="Size, quantity or details"
                value={form.message}
                onChange={setField("message")}
                className="w-full text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none bg-transparent resize-none"
              />
            </div>

            {/* Status / Error Message */}
            {status && (
              <p
                role="status"
                className={`rounded-lg px-3.5 py-2.5 text-xs sm:text-sm font-medium ${
                  status.ok
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-red-50 text-red-600 border border-red-200"
                }`}
              >
                {status.text}
              </p>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-[#16c75e] hover:bg-[#13b052] text-white font-bold text-xs sm:text-sm uppercase tracking-wider py-3.5 px-6 flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4 shrink-0" />
              <span>{isSubmitting ? "SENDING..." : "SEND ENQUIRY"}</span>
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
