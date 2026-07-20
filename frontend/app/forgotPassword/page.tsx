"use client";

import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "react-toastify";
import Link from "next/link";
import { postRequest } from "@/lib/fetcher";
import ResetOtpModal from "../Component/ui/account/resetOtpModal";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [showOtpModal, setShowOtpModal] = useState(false);

  // MUTATION TO SEND OTP
  const { mutate: sendOtp, isPending } = useMutation({
    mutationFn: (emailValue) =>
      postRequest({
        url: "/api/v1/users/send-otp",
        body: { email: emailValue },
      }),

    onSuccess: () => {
      setShowOtpModal(true); // open OTP modal
      toast.success("OTP sent successfully!");
    },

    onError: (err: any) => {
      console.error("Send OTP error:", err);
      toast.error(err?.response?.data?.message || "Failed to send OTP!");
    },
  });

  const handleSubmit = (e: any) => {
    e.preventDefault();

    if (!email) {
      toast.error("Email is required!");
      return;
    }

    sendOtp(email as any); //  API call

    // Don't clear email yet — user may need it in modal
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start pt-16  p-10 bg-white text-gray-800">
      <h1 className="text-3xl font-semibold mb-8 ">My Account</h1>

      {/* Card */}
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-xl shadow-md px-8 py-10">
        <h2 className="text-xl font-semibold text-center mb-2">
          Forgot your password?
        </h2>

        <p className="text-sm text-gray-600 text-center mb-8">
          Enter your email address and we’ll send an OTP to reset your password.
        </p>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-800">
              Email address *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full px-3 py-3 ring-1 ring-gray-300 rounded-lg shadow-sm
              focus:ring-2 focus:ring-[#000000] outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className={`w-full bg-[#000000] hover:bg-[#000000] text-white font-semibold py-3 rounded-xl shadow-md transition
              ${isPending && "opacity-60 cursor-not-allowed"}`}
          >
            {isPending ? "Sending OTP..." : "Send OTP"}
          </button>
        </form>
        <p className="text-center text-sm text-gray-700 mt-6">
          <Link href="/account" className="text-amber-600 underline">
            Back to Sign In
          </Link>
        </p>
      </div>

      {/* Back to login link */}

      {/* OTP MODAL */}
      {showOtpModal && (
        // <p>dfgdgfdgdfgdf</p>
        <ResetOtpModal
          email={email} // pass email to modal
          onClose={() => setShowOtpModal(false)}
        />
      )}
    </div>
  );
};

export default ForgotPassword;
