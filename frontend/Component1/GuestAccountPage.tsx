"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getGuestOrderToken } from "@/lib/guestOrder";
// import { getRequest } from "@/lib/fetcher";
import Link from "next/link";
import { CheckCircle, Package } from "lucide-react";
import CustomImage from "@/Component1/CustomImage";
import { processImageUrl } from "@/lib/utils";

const GuestAccountPage = () => {
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("guest_token");
  
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = tokenFromUrl || getGuestOrderToken();
    if (!token) {
      setError("No guest order token found. Please check your email for the order link.");
      setLoading(false);
      return;
    }

    const fetchOrder = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}api/v1/orders/guest/order`, {
          headers: {
            "x-guest-order-token": token,
          },
        });
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || "Failed to fetch order");
        }
        
        setOrder(data.data || data);
      } catch (err: any) {
        setError(err.message || "Something went wrong.");
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [tokenFromUrl]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-800 px-4">
        <h1 className="text-2xl font-bold mb-2">Order Not Found</h1>
        <p className="text-gray-600 mb-6">{error}</p>
        <Link href="/" className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition">
          Return to Shop
        </Link>
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 text-gray-800">
      <div className="max-w-3xl mx-auto space-y-8">
        
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 text-center">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Order Confirmed!</h1>
          <p className="text-gray-600">Thank you for your purchase. We've received your order.</p>
          <div className="mt-6 flex flex-col items-center justify-center gap-1 text-sm bg-gray-50 py-4 rounded-xl border border-gray-100 inline-flex px-8">
            <span className="text-gray-500">Order Number</span>
            <span className="font-bold text-lg">{order.order_number}</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Package /> Order Details
          </h2>
          
          <div className="space-y-6">
            {order.ordered_products?.map((item: any, idx: number) => (
              <div key={idx} className="flex gap-4 items-center">
                <div className="w-16 h-16 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden">
                   {/* We might not have full image objects here, just checking if there's any */}
                  {item.images?.image || item.images?.image1 ? (
                    <CustomImage 
                      src={processImageUrl(item.images.image || item.images.image1)} 
                      alt={item.product_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                      <Package className="text-gray-400 w-6 h-6" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{item.product_name}</h3>
                  <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                </div>
                <div className="font-bold">
                  ₹{item.price}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 border-t border-gray-100 pt-6 space-y-3">
            <div className="flex justify-between text-gray-600">
              <span>Payment Method</span>
              <span className="font-medium">{order.payment_method}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Payment Status</span>
              <span className="font-medium">{order.payment_status}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Order Status</span>
              <span className="font-medium">{order.order_status}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-gray-900 pt-3 border-t border-gray-100">
              <span>Total</span>
              <span>₹{order.total_amount}</span>
            </div>
          </div>
        </div>

        {/*
          Only a customer who checked out as a business has this. Shown back to
          them because it is what their invoice will be billed to, and a wrong
          GSTIN is far cheaper to report now than after the invoice is filed.
        */}
        {order.gst_details?.gst_number ? (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <h3 className="font-bold text-gray-900 mb-4">GST Details</h3>
            <div className="text-gray-600 space-y-1 text-sm">
              <p className="font-medium text-gray-900">
                {order.gst_details.business_name}
              </p>
              <p>GSTIN: {order.gst_details.gst_number}</p>
              <p className="pt-2 text-xs text-gray-500">
                Your invoice will be issued to this business.
              </p>
            </div>
          </div>
        ) : null}

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="font-bold text-gray-900 mb-4">Shipping Address</h3>
          <div className="text-gray-600 space-y-1 text-sm">
            <p className="font-medium text-gray-900">{order.shipping_address?.name}</p>
            <p>{order.shipping_address?.address_line1}</p>
            <p>{order.shipping_address?.city}, {order.shipping_address?.state} {order.shipping_address?.pincode}</p>
            <p className="pt-2">Email: {order.shipping_address?.email}</p>
            <p>Phone: {order.shipping_address?.phone}</p>
          </div>
        </div>
        
        <div className="text-center">
           <Link href="/forgotPassword" className="text-blue-600 hover:underline font-medium text-sm">
              Want to track your orders? Change Your Password and login.
           </Link>
        </div>
      </div>
    </div>
  );
};

export default GuestAccountPage;
