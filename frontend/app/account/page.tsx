"use client";

import React, { useState, useEffect } from "react";
import SignIn from "../Component/ui/account/signIn";
import Register from "../Component/ui/account/register";
import Otp1, {
  PendingOtp,
  describeOtpTarget,
} from "../Component/ui/account/Otp1";
import Profile from "../Component/ui/account/Profile";
import { useIsLoggedIn } from "@/store/useUserStore";

const Account = () => {
  const [activeTab, setActiveTab] = useState(0);
  const isLoggedIn = useIsLoggedIn();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  // where the verification code went — set by signup or by signing in to an
  // unverified account
  const [pendingOtp, setPendingOtp] = useState<PendingOtp | null>(null);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [showOtp, setShowOtp] = useState(false);

  const handleSignupSuccess = (pending: PendingOtp) => {
    setPendingOtp(pending);
    setIsOtpVerified(false);

    setShowOtp(true);
    setActiveTab(0);
  };

  const handleRequireOtp = () => {
    if (pendingOtp && !isOtpVerified) setShowOtp(true);
  };

  const handleOtpVerified = () => {
    setIsOtpVerified(true);
    setShowOtp(false);
    setPendingOtp(null);
  };

  const handleCloseOtp = () => {
    setShowOtp(false);
    setActiveTab(0);
  };

  if (!mounted) return null;

  if (isLoggedIn) {
    return <Profile />;
  }

  return (
    <div className="bg-white px-4 py-8 sm:p-10">
      <h1 className="text-2xl sm:text-3xl text-gray-800 font-semibold text-center">
        My Account
      </h1>

      {/* TAB HEADERS */}
      <div className="mx-auto mt-6 flex w-full max-w-md overflow-hidden rounded-lg font-semibold">
        <button
          onClick={() => setActiveTab(0)}
          className={`flex-1 py-3 transition ${
            activeTab === 0
              ? "bg-[#02F8C5] text-black"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Sign In
        </button>

        <button
          onClick={() => setActiveTab(1)}
          className={`flex-1 py-3 transition ${
            activeTab === 1
              ? "bg-[#02F8C5] text-black"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Register
        </button>
      </div>

      {/* TAB CONTENT */}
      <div className="mt-6">
        {activeTab === 0 && (
          <SignIn
            pendingOtpEmail={pendingOtp?.target}
            isOtpVerified={isOtpVerified}
            onRequireOtp={handleRequireOtp}
            onOpenOtp={(pending) => {
              setPendingOtp(pending);
              setShowOtp(true); // show OTP modal
            }}
          />
        )}

        {activeTab === 1 && (
          <Register onSignupSuccess={handleSignupSuccess} />
        )}
      </div>

      {/* OTP MODAL */}
      {showOtp && pendingOtp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 style={{ zIndex: 9999 }}">
          <div className="bg-white rounded-xl p-6 shadow-lg w-full max-w-[350px] relative">
            <button
              onClick={handleCloseOtp}
              className="absolute top-3 right-3 text-gray-600 text-2xl"
            >
              ×
            </button>

            <h2 className="text-xl text-black font-semibold text-center mb-2">
              Enter OTP
            </h2>
            <p className="text-sm text-gray-600 text-center mb-5">
              We sent a 4-digit OTP to {describeOtpTarget(pendingOtp)}
            </p>

            <Otp1 pending={pendingOtp} onOtpVerified={handleOtpVerified} />
          </div>
        </div>
      )}
    </div>
  );
};

export default Account;
