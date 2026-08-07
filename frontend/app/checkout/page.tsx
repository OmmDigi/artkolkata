"use client";

import { useState, useRef, useEffect } from "react";
import {
  ChevronDown,
  Lock,
  ShoppingBag,
  TrashIcon,
  MapPin,
  CreditCard,
} from "lucide-react";
import { useCartStore } from "@/store/useCartStore";
import Link from "next/link";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getRequest, postRequest } from "@/lib/fetcher";
import { toast } from "react-toastify";

const CheckoutPage = () => {
  const [shipDifferent, setShipDifferent] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"ONLINE" | "COD">(
    "ONLINE",
  );
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showCoupon, setShowCoupon] = useState(false);
  const { removeFromCart, updateQuantity, cart } = useCartStore();

  const [shippingDetails, setShippingDetails] = useState({
    fullName: "",
    email: "ommdigitaldebu@gmail.com",
    phone: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
  });

  const [couponCode, setCouponCode] = useState("");
  const [discount, setDiscount] = useState<any>({});
  const [appliedCoupon, setAppliedCoupon] = useState(false);
  const [showCouponError, setShowCouponError] = useState(false);
  const [showCouponList, setShowCouponList] = useState(false);
  const couponRef = useRef<HTMLDivElement>(null);

  const [debouncedPincode, setDebouncedPincode] = useState("");

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

  // Debounce pincode so we don't hit the API on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPincode(shippingDetails.pincode);
    }, 500);
    return () => clearTimeout(timer);
  }, [shippingDetails.pincode]);

  const {
    data: priceBreakdownResponse,
    isFetching: isCalculatingPrice,
    isError: isPriceBreakdownError,
  } = useQuery({
    queryKey: [
      "price-breakdown",
      debouncedPincode,
      paymentMethod,
      appliedCoupon ? couponCode : "",
      normal,
      variant,
    ],
    queryFn: () =>
      postRequest<{ data: any }>({
        url: "/api/v1/orders/price-breakdown",
        body: {
          pincode: debouncedPincode,
          paymentMethod,
          product: {
            code: appliedCoupon ? couponCode : undefined,
            product_ids: normal,
            varient_ids: variant,
          },
        },
      }),
    enabled: debouncedPincode.length === 6 && cart.length > 0,
    retry: false,
  });

  const priceBreakdown = priceBreakdownResponse?.data;
  const isPincodeReady = debouncedPincode.length === 6;
  const isNotServiceable =
    isPincodeReady &&
    !isCalculatingPrice &&
    priceBreakdown?.serviceable === false;

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
    if (isNotServiceable) {
      toast.error(`Delivery isn't available for pincode ${debouncedPincode}`);
      return;
    }
    const orderData: Record<string, any> = {
      shippingDetails,
      paymentMethod,
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

  // Compute Totals — once the pincode is entered, use the real
  // subtotal/discount/GST/shipping/total from the price-breakdown API.
  // Before that (or if the call fails), fall back to a client-side estimate
  // with no shipping/GST so the summary isn't empty while typing the address.
  const clientSubtotal = cart.reduce(
    (sum, item) => sum + (item.product?.price || 0) * item.quantity,
    0,
  );
  const clientDiscountAmount =
    discount?.data?.subTotal && discount?.data?.priceAfterDiscount
      ? discount?.data?.subTotal - discount?.data?.priceAfterDiscount
      : 0;

  const subtotal = priceBreakdown?.subtotal ?? clientSubtotal;
  const discountAmount = priceBreakdown?.discount ?? clientDiscountAmount;
  const gstPercentage = priceBreakdown?.gst_percentage ?? 0;
  const gstAmount = priceBreakdown?.gst_amount ?? 0;
  const shippingCost = priceBreakdown?.shipping_charge ?? 0;
  const total =
    priceBreakdown?.total ??
    subtotal - discountAmount + shippingCost + gstAmount;

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
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    setShippingDetails((prev) => ({ ...prev, [name]: value }));
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
          {/* Left Column - Shipping Details & Payment */}
          <div className="lg:col-span-2 space-y-6">
            {/* SHIPPING DETAILS */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <div className="flex items-center mb-6 space-x-3">
                <MapPin className="text-gray-800" />
                <h2 className="text-xl font-bold text-gray-900">
                  Shipping Details
                </h2>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {/* Fields */}
                {["fullName", "email", "phone"].map((name) => (
                  <div
                    key={name}
                    className={name === "fullName" ? "md:col-span-2" : ""}
                  >
                    <label className="text-sm font-semibold text-gray-900 mb-2 block capitalize">
                      {name.replace(/([A-Z])/g, " $1")}{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      name={name}
                      value={(shippingDetails as any)[name]}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 transition"
                      placeholder={
                        name === "fullName"
                          ? "Full Name"
                          : name === "email"
                            ? "Email Address"
                            : "Phone Number"
                      }
                    />
                  </div>
                ))}

                {/* Address */}
                <div className="md:col-span-2 mt-2">
                  <label className="text-sm font-semibold text-gray-900 mb-2 block">
                    Address <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="address"
                    value={shippingDetails.address}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 transition"
                    placeholder="House number, street name, apartment, etc."
                  />
                </div>

                {/* City / State / Pincode / Country */}
                {["city", "state", "pincode", "country"].map((name) => (
                  <div key={name} className="mt-2">
                    <label className="block text-sm font-semibold text-gray-900 mb-2 capitalize">
                      {name} <span className="text-red-500">*</span>
                    </label>
                    <input
                      name={name}
                      disabled={name === "country"}
                      value={(shippingDetails as any)[name]}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 transition ${name === "country" ? "bg-gray-100 text-gray-500" : ""}`}
                      placeholder={`Enter ${name}`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* PAYMENT SECTION */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <div className="flex items-center mb-6 space-x-3">
                <CreditCard className="text-gray-800" />
                <h2 className="text-xl font-bold text-gray-900">
                  Payment Method
                </h2>
              </div>
              <div className="flex flex-col sm:flex-row justify-around gap-4 sm:gap-6">
                {["ONLINE", "COD"].map((method) => (
                  <label
                    key={method}
                    className={`flex flex-1 items-center justify-center p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                      paymentMethod === method
                        ? "border-gray-900 bg-gray-50 text-gray-900"
                        : "border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value={method}
                      checked={paymentMethod === method}
                      onChange={(e) =>
                        setPaymentMethod(e.target.value as "ONLINE" | "COD")
                      }
                      className="hidden"
                    />
                    <span className="font-semibold text-lg flex items-center gap-2">
                      {method === "ONLINE" && "💳 Pay Online"}
                      {method === "COD" && "💵 Cash on Delivery"}
                    </span>
                  </label>
                ))}
              </div>
            </div>
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
                            className="flex-shrink-0 self-start p-2  rounded transition-colors text-gray-400 hover:text-red-600 cursor-pointer"
                          >
                            <TrashIcon className="text-lg" />
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

                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Shipping</span>
                  {!isPincodeReady ? (
                    <span className="text-xs text-gray-400">Enter pincode</span>
                  ) : isCalculatingPrice ? (
                    <span className="text-xs text-gray-400">
                      Calculating...
                    </span>
                  ) : (
                    <span className="font-semibold text-gray-900">
                      ₹{shippingCost.toFixed(2)}
                    </span>
                  )}
                </div>

                {gstAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      GST ({gstPercentage}%)
                    </span>
                    <span className="font-semibold text-gray-900">
                      ₹{gstAmount.toFixed(2)}
                    </span>
                  </div>
                )}

                {isPriceBreakdownError && (
                  <p className="text-xs text-red-500">
                    Unable to calculate shipping right now. Try again.
                  </p>
                )}

                {isNotServiceable && (
                  <p className="text-xs text-red-500">
                    Delivery isn't available for pincode {debouncedPincode}.
                  </p>
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
                        className="px-4 py-2 bg-gray-900 text-white rounded-lg   transition font-medium"
                      >
                        {isApplyingCoupon ? "..." : "Apply"}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCouponList(!showCouponList);
                        setAppliedCoupon(false);
                      }}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium text-left underline"
                    >
                      {showCouponList ? "Hide coupons" : "Show all coupons"}
                    </button>

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
                <div className="space-y-4 pt-6 border-t border-gray-200">
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
                    disabled={
                      !agreedToTerms ||
                      isPlacingOrder ||
                      isCalculatingPrice ||
                      isNotServiceable
                    }
                    className={`w-full py-3 px-4 rounded-lg font-bold text-lg flex items-center justify-center gap-2 transition cursor-pointer ${
                      agreedToTerms &&
                      !isPlacingOrder &&
                      !isCalculatingPrice &&
                      !isNotServiceable
                        ? "bg-[#02F8C5] text-black  "
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
