"use client";

import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "react-toastify";
import Link from "next/link";
import { postRequest } from "@/lib/fetcher";
import ResetOtpModal from "../Component/ui/account/resetOtpModal";
import { PendingOtp, describeOtpTarget } from "../Component/ui/account/Otp1";
import CountryCodeSelect, {
  DEFAULT_COUNTRY,
  looksLikePhone,
  toInternationalPhone,
} from "../Component/ui/account/CountryCodeSelect";

const ForgotPassword = () => {
  // an email address or a mobile number
  const [identifier, setIdentifier] = useState("");
  const [country, setCountry] = useState(DEFAULT_COUNTRY);

  // the code picker shows only while the box holds a number, not an email
  const isPhone = looksLikePhone(identifier);
  const identifierToSend = isPhone
    ? toInternationalPhone(country, identifier)
    : identifier.trim();
  // where the api says the code went; the modal verifies against this
  const [pendingOtp, setPendingOtp] = useState<PendingOtp | null>(null);

  // MUTATION TO SEND OTP
  const { mutate: sendOtp, isPending } = useMutation({
    mutationFn: (value: string) =>
      postRequest({
        url: "/api/v1/users/send-otp",
        body: { identifier: value },
      }),

    onSuccess: (res: any) => {
      const pending: PendingOtp = {
        target: res?.data?.otp_target ?? identifierToSend,
        channel: res?.data?.otp_channel ?? (isPhone ? "phone" : "email"),
      };
      setPendingOtp(pending); // open OTP modal
      toast.success(`OTP sent to ${describeOtpTarget(pending)}`);
    },

    onError: (err: any) => {
      console.error("Send OTP error:", err);
      toast.error(err?.response?.data?.message || "Failed to send OTP!");
    },
  });

  const handleSubmit = (e: any) => {
    e.preventDefault();

    if (!identifier.trim()) {
      toast.error("Email or mobile number is required!");
      return;
    }

    sendOtp(identifierToSend); //  API call
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start px-4 py-8 sm:p-10 sm:pt-16 bg-white text-gray-800">
      <h1 className="text-2xl sm:text-3xl font-semibold mb-6 sm:mb-8">My Account</h1>

      {/* Card */}
      <div className="w-full max-w-md bg-white py-2 sm:border sm:border-gray-200 sm:rounded-xl sm:shadow-md sm:px-8 sm:py-10">
        <h2 className="text-xl font-semibold text-center mb-2">
          Forgot your password?
        </h2>

        <p className="text-sm text-gray-600 text-center mb-8">
          Enter your email address or mobile number and we’ll send an OTP to
          reset your password.
        </p>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-800">
              Email or mobile number *
            </label>
            <div
              className="flex w-full ring-1 ring-gray-300 rounded-lg shadow-sm
              focus-within:ring-2 focus-within:ring-[#000000]"
            >
              {isPhone && (
                <CountryCodeSelect value={country} onChange={setCountry} />
              )}
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="name@example.com or 10-digit mobile number"
                autoComplete="username"
                className={`flex-1 min-w-0 px-3 py-3 outline-none ${
                  isPhone ? "rounded-r-lg" : "rounded-lg"
                }`}
              />
            </div>
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
      {pendingOtp && (
        <ResetOtpModal
          pending={pendingOtp}
          onClose={() => setPendingOtp(null)}
        />
      )}
    </div>
  );
};

export default ForgotPassword;
