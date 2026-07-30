"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Lock, ShoppingBag, TrashIcon } from "lucide-react";
import { useCartStore } from "@/store/useCartStore";
import Link from "next/link";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getRequest, postRequest } from "@/lib/fetcher";
import { toast } from "react-toastify";

const CheckoutPage = () => {
  const [shipDifferent, setShipDifferent] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cheque");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showCoupon, setShowCoupon] = useState(false);
  const { removeFromCart, updateQuantity, cart } = useCartStore();

  const [billingDetails, setBillingDetails] = useState({
    fullName: "",
    companyName: "",
    country: "",
    streetAddress: "",
    apartment: "",
    city: "",
    county: "",
    postcode: "",
    phone: "",
    email: "ommdigitaldebu@gmail.com",
  });

  const [couponCode, setCouponCode] = useState("");
  const [discount, setDiscount] = useState<any>({});
  const [appliedCoupon, setAppliedCoupon] = useState(false);
  const [showCouponError, setShowCouponError] = useState(false);
  const [showCouponList, setShowCouponList] = useState(false);
  const couponRef = useRef<HTMLDivElement>(null);

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

  // -------------------------------
  // React Query APIS
  // -------------------------------
  const { data: couponDiscount } = useQuery({
    queryKey: ["discount"],
    queryFn: () => getRequest<{ data: any[] }>("/api/v1/discount"),
  });
  const availableCoupons = couponDiscount?.data || [];

  const { mutateAsync: validateDiscount, isPending: isApplyingCoupon } =
    useMutation({
      mutationFn: (data: any) =>
        postRequest({ url: "/api/v1/discount/validate", body: data }),
      onSuccess: (response: any) => {
        setDiscount(response);
        setShowCouponError(false);
        setAppliedCoupon(true);
        toast.success(response?.message || "Coupon Applied");
      },
      onError: (error: any) => {
        setShowCouponError(true);
        toast.error(error?.response?.data?.message || "Invalid coupon");
      },
    });

  const { mutateAsync: placeOrder, isPending: isPlacingOrder } = useMutation({
    mutationFn: (data: any) =>
      postRequest({ url: "/api/v1/orders/place-order", body: data }),
    onSuccess: (response: any) => {
      toast.success(response?.message || "Order placed successfully");
      setCouponCode("");
      if (response?.data?.gatewayUrl) {
        window.location.href = `${response?.data?.gatewayUrl}`;
      } else {
        window.location.href = "/account/orders";
      }
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Order failed");
    },
  });

  const normal: any[] = [];
  const variant: any[] = [];
  cart.forEach((item) => {
    if (item.variantId === null || item.variantId === undefined) {
      normal.push({ id: item.id, quantity: item.quantity });
    } else {
      variant.push({ id: item.variantId, quantity: item.quantity });
    }
  });

  const formData = {
    product_ids: normal,
    varient_ids: variant,
    code: couponCode,
  };

  const applyCoupon = async () => {
    if (!couponCode) return;
    try {
      await validateDiscount(formData);
    } catch (e) {
      console.log(e);
    }
  };

  const handleOrderPlace = async () => {
    if (!agreedToTerms) return;
    const orderData: Record<string, any> = {
      shippingDetails: billingDetails,
      paymentMethod: paymentMethod === "cheque" ? "ONLINE" : "COD",
    };

    if (formData.code !== "") {
      orderData["product"] = formData;
    } else {
      orderData["product"] = {
        product_ids: normal,
        varient_ids: variant,
      };
    }

    try {
      await placeOrder(orderData);
    } catch (e) {
      console.log(e);
    }
  };

  // Compute Totals
  const subtotal = cart.reduce(
    (sum, item) => sum + (item.product?.price || 0) * item.quantity,
    0,
  );
  const discountAmount =
    discount?.data?.subTotal && discount?.data?.priceAfterDiscount
      ? discount?.data?.subTotal - discount?.data?.priceAfterDiscount
      : 0;

  const afterDiscount = subtotal - discountAmount;
  const shippingCost = 0;
  const vat = 0;
  const total = afterDiscount + shippingCost + vat;

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

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setBillingDetails((prev) => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    function handleClickOutside(event: any) {
      if (couponRef.current && !couponRef.current.contains(event.target)) {
        setShowCouponList(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-8 text-gray-800">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Checkout</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Billing & Shipping */}
          <div className="lg:col-span-2 space-y-6">
            <form className="space-y-6">
              <div className="bg-white shadow-sm border border-gray-200 p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  Billing Details
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      name="fullName"
                      value={billingDetails.fullName}
                      onChange={handleInputChange}
                      type="text"
                      placeholder="Full Name"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Company Name{" "}
                      <span className="text-gray-500 text-xs">(optional)</span>
                    </label>
                    <input
                      name="companyName"
                      value={billingDetails.companyName}
                      onChange={handleInputChange}
                      type="text"
                      placeholder="Company Name"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Country / Region <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="country"
                      value={billingDetails.country}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 transition bg-white"
                    >
                      <option value="">Select a country / region…</option>
                      {countries.map((country) => (
                        <option key={country} value={country}>
                          {country}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Street address <span className="text-red-500">*</span>
                    </label>
                    <input
                      name="streetAddress"
                      value={billingDetails.streetAddress}
                      onChange={handleInputChange}
                      type="text"
                      placeholder="House number and street name"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 transition mb-3"
                    />
                    <input
                      name="apartment"
                      value={billingDetails.apartment}
                      onChange={handleInputChange}
                      type="text"
                      placeholder="Apartment, suite, unit, etc. (optional)"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Town / City <span className="text-red-500">*</span>
                    </label>
                    <input
                      name="city"
                      value={billingDetails.city}
                      onChange={handleInputChange}
                      type="text"
                      placeholder="Town / City"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 transition"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        County{" "}
                        <span className="text-gray-500 text-xs">
                          (optional)
                        </span>
                      </label>
                      <input
                        name="county"
                        value={billingDetails.county}
                        onChange={handleInputChange}
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
                        name="postcode"
                        value={billingDetails.postcode}
                        onChange={handleInputChange}
                        type="text"
                        placeholder="Postcode"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Phone <span className="text-red-500">*</span>
                      </label>
                      <input
                        name="phone"
                        value={billingDetails.phone}
                        onChange={handleInputChange}
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
                        name="email"
                        value={billingDetails.email}
                        onChange={handleInputChange}
                        type="email"
                        placeholder="Email Address"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 transition"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>

          {/* Right Column - Order Summary */}
          <div className="lg:col-span-1">
            <div className="shadow-sm border border-gray-200 p-6 sticky top-8 space-y-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  Your Order
                </h3>
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
                          <Link
                            href={`/product/${item?.product?.slug}`}
                            className="flex-shrink-0"
                          >
                            <img
                              src={
                                item?.product?.images?.[0]?.image ||
                                item?.product?.image1
                              }
                              alt={
                                item?.product?.images?.[0]?.alt_tag ||
                                item?.product?.name
                              }
                              className="w-20 h-24 object-cover rounded"
                            />
                          </Link>
                          <div className="flex-1 min-w-0">
                            <Link
                              href={`/product/${item?.product?.slug}`}
                              className="text-sm font-medium text-gray-900 hover:text-pink-600 transition-colors block mb-2"
                              title={item?.product?.name}
                            >
                              {item?.product?.name?.length > 20
                                ? `${item.product.name.slice(0, 20)}...`
                                : item?.product?.name}
                            </Link>
                            {item?.product?.variations &&
                              item?.product?.variations.length > 0 && (
                                <dl className="text-xs text-gray-600 space-y-1 mb-3">
                                  {item?.product?.variations.map(
                                    (variation: any, i: number) => (
                                      <div key={i} className="flex gap-1">
                                        <dt className="font-medium">
                                          {variation.name}:
                                        </dt>
                                        <dd>{variation.value}</dd>
                                      </div>
                                    ),
                                  )}
                                </dl>
                              )}
                            <div className="flex items-center gap-3">
                              <div className="flex items-center border border-gray-300 rounded">
                                <button
                                  onClick={() => changeQty(item, -1)}
                                  className="px-2 py-1 hover:bg-gray-100 transition-colors text-gray-600"
                                >
                                  −
                                </button>
                                <span className="text-sm">{item.quantity}</span>
                                <button
                                  onClick={() => changeQty(item, 1)}
                                  className="px-2 py-1 hover:bg-gray-100 transition-colors text-gray-600"
                                >
                                  +
                                </button>
                              </div>
                              <span className="text-sm font-medium text-gray-900">
                                ₹
                                {(
                                  (item?.product?.price || 0) * item.quantity
                                ).toFixed(2)}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => deleteItem(item)}
                            className="flex-shrink-0 self-start p-2 hover:bg-gray-100 rounded transition-colors text-gray-400 hover:text-gray-600"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3 border-b border-gray-200 pb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-semibold text-gray-900">
                    ₹{subtotal.toFixed(2)}
                  </span>
                </div>

                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount</span>
                    <span className="font-semibold">
                      -₹{discountAmount.toFixed(2)}
                    </span>
                  </div>
                )}


              </div>

              <div className="flex justify-between items-center text-lg">
                <span className="font-bold text-gray-900">Total</span>
                <span className="text-2xl font-bold text-gray-900">
                  ₹{total.toFixed(2)}
                </span>
              </div>

              <div
                className="border-t border-gray-200 pt-4 relative"
                ref={couponRef}
              >
                <button
                  type="button"
                  onClick={() => setShowCoupon(!showCoupon)}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Have a coupon? Click here to enter your coupon code
                </button>
                {showCoupon && (
                  <div className="mt-4 space-y-3 relative">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        onFocus={() => {
                          setShowCouponList(true);
                          setAppliedCoupon(false);
                        }}
                        placeholder="Coupon code"
                        className="flex-1 px-4 py-2 border text-gray-800 border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 transition"
                      />
                      <button
                        type="button"
                        onClick={applyCoupon}
                        disabled={isApplyingCoupon}
                        className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition font-medium"
                      >
                        {isApplyingCoupon ? "..." : "Apply"}
                      </button>
                    </div>

                    {showCouponList && availableCoupons?.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
                        {availableCoupons.map((c: any) => (
                          <div
                            key={c.code}
                            onClick={() => {
                              setCouponCode(c.code);
                              setShowCouponList(false);
                            }}
                            className="px-4 py-3 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-0"
                          >
                            <div className="flex justify-between items-center">
                              <div>
                                <div className="font-bold text-gray-900">
                                  {c.code}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {c.title}
                                </div>
                              </div>
                              <div className="text-sm font-semibold text-green-600">
                                {c.value}
                                {c.type === "percentage" ? "%" : "₹"} OFF
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-8">
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
                  </div>
                </div>

                <div className="mt-6 space-y-4 pt-6 border-t border-gray-200">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="w-5 h-5 mt-1 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">
                      I have read and agree to the website terms and conditions
                      <span className="text-red-500"> *</span>
                    </span>
                  </label>

                  <button
                    type="button"
                    onClick={handleOrderPlace}
                    disabled={!agreedToTerms || isPlacingOrder}
                    className={`w-full py-3 px-4 rounded-lg font-bold text-lg flex items-center justify-center gap-2 transition ${
                      agreedToTerms && !isPlacingOrder
                        ? "bg-gray-900 text-white hover:bg-gray-800"
                        : "bg-gray-300 text-gray-600 cursor-not-allowed"
                    }`}
                  >
                    <Lock className="w-5 h-5" />
                    {isPlacingOrder ? "Placing Order..." : "Place Order"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
