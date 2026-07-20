"use client";

import { useState } from "react";
import { ChevronDown, Lock, ShoppingBag, TrashIcon } from "lucide-react";
import { useCartStore } from "@/store/useCartStore";
import Link from "next/link";

const CheckoutPage = () => {
  const [shipDifferent, setShipDifferent] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState("bacs");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showCoupon, setShowCoupon] = useState(false);
  const [shippingMethod, setShippingMethod] = useState("flat_rate:1");
  const { removeFromCart, updateQuantity, cart } = useCartStore();

  const changeQty = (item: any, diff: number) => {
    const newQty = item.quantity + diff;
    if (newQty <= 0) {
      removeFromCart(item.id, item.variantId);
      return;
    }
    updateQuantity(item.id, item.variantId, newQty);
  };

  const deleteItem = (item: any) => {
    removeFromCart(item.id, item.variantId);
  };

  const subtotal = 25.82;
  const shippingCost = shippingMethod === "free_shipping:2" ? 0 : 10;
  const vat = 7.15;
  const total = subtotal + shippingCost + vat;

  const countries = [
    "United Kingdom (UK)",
    "United States (US)",
    "Canada",
    "Australia",
    "Germany",
    "France",
    "Italy",
    "Spain",
    "Netherlands",
    "India",
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8 text-gray-800">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Checkout</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Billing & Shipping */}
          <div className="lg:col-span-2 space-y-6">
            <form className="space-y-6">
              {/* Billing Details Section */}
              <div className="bg-white  shadow-sm border border-gray-200 p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  Billing Details
                </h2>

                <div className="space-y-4">
                  {/* First and Last Name */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        First Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="First Name"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Last Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Last Name"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 transition"
                      />
                    </div>
                  </div>

                  {/* Company Name */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Company Name{" "}
                      <span className="text-gray-500 text-xs">(optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Company Name"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 transition"
                    />
                  </div>

                  {/* Country/Region */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Country / Region <span className="text-red-500">*</span>
                    </label>
                    <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 transition bg-white">
                      <option>Select a country / region…</option>
                      {countries.map((country) => (
                        <option key={country} value={country}>
                          {country}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Street Address */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Street address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="House number and street name"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 transition mb-3"
                    />
                    <input
                      type="text"
                      placeholder="Apartment, suite, unit, etc. (optional)"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 transition"
                    />
                  </div>

                  {/* City */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Town / City <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Town / City"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 transition"
                    />
                  </div>

                  {/* County & Postcode */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        County{" "}
                        <span className="text-gray-500 text-xs">
                          (optional)
                        </span>
                      </label>
                      <input
                        type="text"
                        placeholder="County"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Postcode <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Postcode"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 transition"
                      />
                    </div>
                  </div>

                  {/* Phone & Email */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Phone <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        placeholder="Phone"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Email Address <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        placeholder="Email Address"
                        defaultValue="ommdigitaldebu@gmail.com"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 transition"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Shipping Address Section */}
              <div className="bg-white  shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <input
                    type="checkbox"
                    id="ship_different"
                    checked={shipDifferent}
                    onChange={(e) => setShipDifferent(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300"
                  />
                  <label
                    htmlFor="ship_different"
                    className="text-lg font-semibold text-gray-900 cursor-pointer"
                  >
                    Ship to a different address?
                  </label>
                </div>

                {shipDifferent && (
                  <div className="space-y-4 mt-6 pt-6 border-t border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Shipping Details
                    </h3>
                    {/* Same fields as billing */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                          First Name
                        </label>
                        <input
                          type="text"
                          placeholder="First Name"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 transition"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                          Last Name
                        </label>
                        <input
                          type="text"
                          placeholder="Last Name"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 transition"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Street address
                      </label>
                      <input
                        type="text"
                        placeholder="House number and street name"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 transition"
                      />
                    </div>
                  </div>
                )}
              </div>
            </form>
          </div>
          {/* Right Column - Order Summary */}
          <div className="lg:col-span-1">
            <div className="  shadow-sm border border-gray-200 p-6 sticky top-8 space-y-6">
              {/* Order Summary */}
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  Your Order
                </h3>
                {/* Cart Items */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  {cart.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <ShoppingBag className="w-16 h-16 text-gray-300 mb-4" />
                      <p className="text-gray-500">Your cart is empty</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {cart?.map((item, index) => (
                        <div
                          key={index}
                          className="flex gap-4 pb-4 border-b border-gray-100 last:border-0"
                        >
                          {/* Product Image */}
                          <Link
                            href={`/product/${item?.product?.slug}`}
                            className="flex-shrink-0"
                          >
                            <img
                              src={item?.product?.images?.[0]?.image || item?.product?.image1}
                              alt={item?.product?.images?.[0]?.alt_tag || item?.product?.name}
                              className="w-20 h-24 object-cover rounded"
                            />
                          </Link>

                          {/* Product Details */}
                          <div className="flex-1 min-w-0">
                            <Link
                              href={`/product/${item?.product?.slug}`}
                              className="text-sm font-medium text-gray-900 hover:text-pink-600 transition-colors block mb-2"
                            >
                              {item?.product?.name}
                            </Link>
                            <p></p>
                            {/* Variations */}
                            {/* {item.product?.variations.find(item.)} */}
                            {item?.product?.variations &&
                              item?.product?.variations.length > 0 && (
                                <dl className="text-xs text-gray-600 space-y-1 mb-3">
                                  {item?.product?.variations.map(
                                    (variation: any, index: number) => (
                                      <div key={index} className="flex gap-1">
                                        <dt className="font-medium">
                                          {variation.name}:
                                        </dt>
                                        <dd>{variation.value}</dd>
                                      </div>
                                    ),
                                  )}
                                </dl>
                              )}
                            {/* Quantity and Price */}
                            <div className="flex items-center gap-3">
                              <div className="flex items-center border border-gray-300 rounded">
                                <button
                                  onClick={() => changeQty(item, -1)}
                                  className="px-2 py-1 hover:bg-gray-100 transition-colors text-gray-600"
                                  aria-label="Decrease quantity"
                                >
                                  −
                                </button>
                                <span className="text-sm">{item.quantity}</span>

                                <button
                                  onClick={() => changeQty(item, 1)}
                                  className="px-2 py-1 hover:bg-gray-100 transition-colors text-gray-600"
                                  aria-label="Increase quantity"
                                >
                                  +
                                </button>
                              </div>
                              <span className="text-sm font-medium text-gray-900">
                                ₹
                                {(item?.product?.price * item.quantity).toFixed(
                                  2,
                                )}
                              </span>
                            </div>
                          </div>

                          {/* Remove Button */}
                          <button
                            onClick={() => deleteItem(item)}
                            className="flex-shrink-0 self-start p-2 hover:bg-gray-100 rounded transition-colors text-gray-400 hover:text-gray-600"
                            aria-label="Remove item"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Pricing Summary */}
              <div className="space-y-3 border-b border-gray-200 pb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-semibold text-gray-900">
                    ₹{subtotal.toFixed(2)}
                  </span>
                </div>

                {/* Shipping Method */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-900">
                    Shipping
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="shipping"
                        value="flat_rate:1"
                        checked={shippingMethod === "flat_rate:1"}
                        onChange={(e) => setShippingMethod(e.target.value)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-gray-700">
                        Flat rate: ₹10.00
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="shipping"
                        value="free_shipping:2"
                        checked={shippingMethod === "free_shipping:2"}
                        onChange={(e) => setShippingMethod(e.target.value)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-gray-700">
                        Free shipping
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="shipping"
                        value="local_pickup:3"
                        checked={shippingMethod === "local_pickup:3"}
                        onChange={(e) => setShippingMethod(e.target.value)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-gray-700">
                        Local pickup
                      </span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Shipping Cost</span>
                  <span className="font-semibold text-gray-900">
                    ₹{shippingCost.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">VAT</span>
                  <span className="font-semibold text-gray-900">
                    ₹{vat.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Total */}
              <div className="flex justify-between items-center text-lg">
                <span className="font-bold text-gray-900">Total</span>
                <span className="text-2xl font-bold text-gray-900">
                  ₹{total.toFixed(2)}
                </span>
              </div>

              {/* Coupon Section */}
              <div className="border-t border-gray-200 pt-4">
                <button
                  onClick={() => setShowCoupon(!showCoupon)}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Have a coupon? Click here to enter your coupon code
                </button>
                {showCoupon && (
                  <div className="mt-4 space-y-3">
                    <input
                      type="text"
                      placeholder="Coupon code"
                      className="w-full px-4 py-2 border text-gray-800 border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 transition"
                    />
                    <button className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition font-medium">
                      Apply Coupon
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-8   ">
                <h3 className="text-2xl font-bold text-gray-900 mb-6">
                  Payment Method
                </h3>

                <div className="space-y-4">
                  <div className="border border-gray-200 rounded-lg p-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="payment"
                        value="cheque"
                        checked={paymentMethod === "cheque"}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-4 h-4"
                      />
                      <span className="font-semibold text-gray-900">
                        Online payments
                      </span>
                    </label>
                  </div>

                  <div className="border border-gray-200 rounded-lg p-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="payment"
                        value="cod"
                        checked={paymentMethod === "cod"}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-4 h-4"
                      />
                      <span className="font-semibold text-gray-900">
                        Cash on delivery
                      </span>
                    </label>
                    {paymentMethod === "cod" && (
                      <p className="mt-3 text-sm text-gray-600 pl-7">
                        Pay with cash upon delivery.
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-6 space-y-4 pt-6 border-t border-gray-200">
                  <p className="text-sm text-gray-600">
                    Your personal data will be used to process your order,
                    support your experience throughout this website, and for
                    other purposes described in our{" "}
                    <a
                      href="#"
                      className="text-blue-600 hover:text-blue-700 underline"
                    >
                      privacy policy
                    </a>
                    .
                  </p>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="w-5 h-5 mt-1 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">
                      I have read and agree to the website{" "}
                      <a
                        href="#"
                        className="text-blue-600 hover:text-blue-700 underline"
                      >
                        terms and conditions
                      </a>
                      <span className="text-red-500"> *</span>
                    </span>
                  </label>

                  <button
                    disabled={!agreedToTerms}
                    className={`w-full py-3 px-4 rounded-lg font-bold text-lg flex items-center justify-center gap-2 transition ${
                      agreedToTerms
                        ? "bg-gray-900 text-white hover:bg-gray-800"
                        : "bg-gray-300 text-gray-600 cursor-not-allowed"
                    }`}
                  >
                    <Lock className="w-5 h-5" />
                    Place Order
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Section - Full Width Below */}
      </div>
    </div>
  );
};

export default CheckoutPage;
