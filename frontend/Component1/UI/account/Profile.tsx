"use client";
import { useEffect, useState } from "react";
import { Package, Download, Loader2, LogOut, User } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getRequest, postRequest } from "@/lib/fetcher";
import { useUserStore } from "@/store/useUserStore";
import { useCartStore } from "@/store/useCartStore";
import AddressManager from "./AddressManager";
import OrderTracking from "../order/OrderTracking";
import Link from "next/link";
import CustomImage from "@/Component1/CustomImage";
import { processImageUrl } from "@/lib/utils";

export default function Profile() {
  const [activeTab, setActiveTab] = useState("account");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  const { logout, user } = useUserStore();
  const addToCart = useCartStore((state) => state.addToCart);
  const router = useRouter();
  const searchParams = useSearchParams();

  const { data: GetUserOrderList, isLoading: loadingGetUserOrderList } =
    useQuery({
      queryKey: ["orders"],
      queryFn: () => getRequest<any>("api/v1/users/orders"),
    });

  const { mutateAsync: cancle } = useMutation({
    mutationFn: (data: any) =>
      postRequest({ url: "api/v1/orders/cancel", body: data }),
  });

  useEffect(() => {
    const tab = searchParams?.get("tab");
    if (tab) {
      setActiveTab(tab);
    } else {
      setActiveTab("account"); // default
    }
  }, [searchParams]);

  // const cancleOrder = async (id: number) => {
  //   const order_id = { order_id: id };
  //   try {
  //     const response: any = await cancle(order_id);
  //     toast.success(response.message || "Order Cancelled");
  //   } catch (err: any) {
  //     toast.error(err?.response?.data?.message || "Try Again");
  //   }
  // };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    router.replace(`?tab=${tab}`, { scroll: false });
  };

  const handleOrderAgain = (order: any) => {
    order.ordered_products.forEach((item: any) => {
      addToCart(
        {
          id: item.product_id || item.id,
          name: item.product_name,
          price: item.price || 0,
          images: [{ image: item.images?.image || item.image || "" }],
        },
        item.variant_id || item.sku,
        item.quantity,
      );
    });
    router.push("/checkout");
  };

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-1 md:px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-gray-200 rounded p-4 space-y-2">
              <button
                onClick={() => handleTabChange("account")}
                className={`w-full flex items-center gap-3 px-4 py-3 transition ${
                  activeTab === "account"
                    ? "bg-[#02F8C5] text-black"
                    : "hover:bg-gray-50 text-gray-700"
                }`}
              >
                <User className="w-5 h-5" />
                <span className="font-medium">Account Settings</span>
              </button>
              <button
                onClick={() => handleTabChange("orders")}
                className={`w-full flex items-center gap-3 px-4 py-3 transition ${
                  activeTab === "orders" || activeTab === "tracking"
                    ? "bg-[#02F8C5] text-black"
                    : "hover:bg-gray-50 text-gray-700"
                }`}
              >
                <Package className="w-5 h-5" />
                <span className="font-medium">Order History</span>
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 transition hover:bg-gray-50 text-red-600"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Log out</span>
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {activeTab === "orders" && (
              <div className="bg-white border border-gray-200 rounded p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  Order History
                </h2>
                <div className="space-y-4 grid grid-cols-1 md:grid-cols-2 gap-5">
                  {GetUserOrderList?.data?.length > 0 ? (
                    GetUserOrderList?.data?.map((order: any, index: number) => (
                      <div
                        key={index}
                        className="border border-gray-200 rounded p-4 bg-white"
                      >
                        {/* Top Section */}
                        <div className="flex justify-between items-center ">
                          <div>
                            <p className="font-medium text-sm text-gray-900">
                              Order #{order.order_number}
                            </p>
                            <p className="text-sm text-gray-500">
                              {order.order_date}
                            </p>
                            <div className="mt-2 flex flex-col gap-2">
                              {order?.invoice_url && (
                                <a
                                  href={order.invoice_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex justify-center items-center gap-1 px-3 py-1 text-sm font-medium cursor-pointer border border-gray-300 hover:bg-gray-50 text-gray-700"
                                >
                                  <span>Invoice</span>
                                  <Download className="w-4 h-4" />
                                </a>
                              )}
                              {order?.payment_slip_url && (
                                <a
                                  href={order.payment_slip_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex justify-center items-center gap-1 px-3 py-1 text-sm font-medium cursor-pointer border border-gray-300 hover:bg-gray-50 text-gray-700"
                                >
                                  <span>Payment Slip</span>
                                  <Download className="w-4 h-4" />
                                </a>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 items-end">
                            <div
                              className={`px-3 py-1 text-xs font-medium 
                            ${
                              order.order_status === "PENDING"
                                ? "bg-yellow-100 text-yellow-800"
                                : order.order_status === "CANCELLED"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-green-100 text-green-800"
                            }`}
                            >
                              {order.order_status}
                            </div>
                            <button
                              onClick={() => {
                                setSelectedOrder(order);
                                setActiveTab("tracking");
                                // mutateOrderStatus();
                              }}
                              className="px-3 cursor-pointer py-1 text-sm bg-[#02F8C5] text-black transition"
                            >
                              Track Order
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 border-t border-gray-100 pt-4 space-y-3">
                          {order.ordered_products.map(
                            (item: any, index: number) => (
                              <Link
                                href={`/product/${item?.product_slug}`}
                                key={index}
                                className="flex gap-4"
                              >
                                <CustomImage
                                  src={processImageUrl(item?.images?.image)}
                                  alt={item?.product_name}
                                  className="w-16 h-16 rounded object-cover border border-gray-100"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    {item.product_name}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    Variant:{" "}
                                    <span className="uppercase">
                                      {item.sku}
                                    </span>
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    Qty: {item.quantity}
                                  </p>
                                </div>
                              </Link>
                            ),
                          )}
                        </div>

                        <div className="border-t border-gray-100 mt-4 pt-4 space-y-4">
                          <div className="flex justify-between items-center">
                            <p className="text-gray-500 text-sm">
                              Total Amount
                            </p>
                            <p className="text-lg font-bold text-gray-900">
                              ₹ {order.total_amount}
                            </p>
                          </div>
                          <div className="flex gap-3 justify-end">
                            <button
                              className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded hover:bg-gray-800 transition cursor-pointer"
                              onClick={() => handleOrderAgain(order)}
                            >
                              Order Again
                            </button>
                            <button
                              className="px-4 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded hover:bg-gray-50 transition cursor-pointer"
                              onClick={() => {
                                const product = order.ordered_products[0];
                                if (product) {
                                  const identifier = product?.product_slug;
                                  router.push(`/product/${identifier}#reviews`);
                                }
                              }}
                            >
                              Review
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : loadingGetUserOrderList ? (
                    <div className="col-span-full flex justify-center py-10">
                      <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                    </div>
                  ) : (
                    <p className="col-span-full text-center text-gray-500 py-10">
                      You don't have any orders yet.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Tracking Tab */}
            {activeTab === "tracking" && selectedOrder && (
              <OrderTracking
                orderNumber={selectedOrder?.order_number}
                trackingId={selectedOrder?.tracking_id}
                subtitle={selectedOrder?.ordered_products?.[0]?.product_name}
                onBack={() => setActiveTab("orders")}
              />
            )}

            {/* Account Settings Tab */}
            {activeTab === "account" && (
              <div className="space-y-6">
                <div className="bg-white border border-gray-200 rounded p-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">
                    Profile Details
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Name</p>
                      <p className="font-medium text-gray-900">
                        {user?.name || "Not provided"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Email</p>
                      <p className="font-medium text-gray-900">
                        {user?.email || "Not provided"}
                      </p>
                    </div>
                  </div>
                </div>
                <AddressManager />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
