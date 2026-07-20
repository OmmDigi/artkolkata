"use client";

import React, { useState } from "react";
import SignIn from "../Component/ui/account/signIn";
import Register from "../Component/ui/account/register";
import Otp1 from "../Component/ui/account/Otp1";

const Account = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [pendingOtpEmail, setPendingOtpEmail] = useState("");
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [showOtp, setShowOtp] = useState(false);

  const handleSignupSuccess = (email: any) => {
    setPendingOtpEmail(email);
    setIsOtpVerified(false);

    setShowOtp(true);
    setActiveTab(0);
  };

  const handleRequireOtp = () => {
    if (pendingOtpEmail && !isOtpVerified) setShowOtp(true);
  };

  const handleOtpVerified = () => {
    setIsOtpVerified(true);
    setShowOtp(false);
    setPendingOtpEmail("");
  };

  const handleCloseOtp = () => {
    setShowOtp(false);
    setActiveTab(0);
  };

  console.log(
    "Modal state - showOtp:",
    showOtp,
    "pendingOtpEmail:",
    pendingOtpEmail,
  );

  return (
    <div className=" bg-white p-10">
      <h1 className="text-3xl text-gray-800 font-semibold text-center">
        My Account
      </h1>

      {/* TAB HEADERS */}
      <div className="flex justify-center mt-6 font-semibold ">
        <button
          onClick={() => setActiveTab(0)}
          className={`px-10 py-3  shadow-md transition  ${
            activeTab === 0
              ? "bg-[#000000] text-white  shadow-lg"
              : "bg-white text-gray-700 hover:bg-gray-100"
          }`}
        >
          Sign In
        </button>

        <button
          onClick={() => setActiveTab(1)}
          className={`px-10 py-3  shadow-md transition ${
            activeTab === 1
              ? "bg-[#000000] text-white  shadow-lg"
              : "bg-white text-gray-700 hover:bg-gray-100"
          }`}
        >
          Register
        </button>
      </div>

      {/* TAB CONTENT */}
      <div className="mt-6">
        {activeTab === 0 && (
          <SignIn
            pendingOtpEmail={pendingOtpEmail}
            isOtpVerified={isOtpVerified}
            onRequireOtp={handleRequireOtp}
            onOpenOtp={(email: any) => {
              //  ADDED THIS
              console.log("onOpenOtp called with email:", email);
              setPendingOtpEmail(email); // store email for OTP
              console.log("Setting showOtp to true");
              setShowOtp(true); // show OTP modal
            }}
          />
        )}

        {activeTab === 1 && (
          <Register onSignupSuccess={handleSignupSuccess as any} />
        )}
      </div>

      {/* OTP MODAL */}
      {showOtp && pendingOtpEmail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 style={{ zIndex: 9999 }}">
          <div className="bg-white rounded-xl p-6 shadow-lg w-[350px] relative">
            <button
              onClick={handleCloseOtp}
              className="absolute top-3 right-3 text-gray-600 text-2xl"
            >
              ×
            </button>

            <h2 className="text-xl font-semibold text-center mb-2">
              Enter OTP
            </h2>
            <p className="text-sm text-gray-600 text-center mb-5">
              We sent a 4-digit OTP to your email
            </p>

            <Otp1 email={pendingOtpEmail} onOtpVerified={handleOtpVerified} />
          </div>
        </div>
      )}
    </div>
  );
};

export default Account;
