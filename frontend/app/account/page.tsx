"use client";

import React, { useState } from "react";
import { ArrowLeft, Mail } from "lucide-react";
import SignIn from "../Component/ui/account/signIn";
import OtpLogin from "../Component/ui/account/OtpLogin";
import Otp1, {
  PendingOtp,
  describeOtpTarget,
} from "../Component/ui/account/Otp1";
import Profile from "../Component/ui/account/Profile";
import { useIsLoggedIn } from "@/store/useUserStore";
import { useIsHydrated } from "@/hooks/useIsHydrated";

/**
 * Login/Signup with OTP is the front door: it signs existing customers in and
 * creates new accounts. Email & password stays one click away for accounts
 * that have a password (and for staff, who cannot use the OTP).
 */
const Account = () => {
  const isLoggedIn = useIsLoggedIn();
  const mounted = useIsHydrated();
  const [usePassword, setUsePassword] = useState(false);

  // signing in with a password to an unverified account sends a code first
  const [pendingOtp, setPendingOtp] = useState<PendingOtp | null>(null);

  if (!mounted) return null;

  if (isLoggedIn) {
    return <Profile />;
  }

  return (
    <div className="bg-white px-4 py-8 sm:p-10">
      <div className="mx-auto w-full max-w-xl rounded-2xl bg-gray-50 p-3 sm:p-6 shadow-sm">
        {usePassword ? (
          <>
            <SignIn onOpenOtp={setPendingOtp} />

            <button
              type="button"
              onClick={() => setUsePassword(false)}
              className="mx-auto mt-6 flex items-center gap-2 text-sm font-semibold text-gray-800 hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              Login with OTP instead
            </button>
          </>
        ) : (
          <>
            <div className="rounded-2xl bg-white px-4 py-8 sm:px-10 sm:py-10">
              <OtpLogin />
            </div>

            <div className="my-8 flex items-center gap-4 px-6 text-gray-600">
              <span className="h-px flex-1 bg-gray-300" />
              <span>Or continue with</span>
              <span className="h-px flex-1 bg-gray-300" />
            </div>

            <button
              type="button"
              onClick={() => setUsePassword(true)}
              className="flex w-full items-center gap-4 border-2 border-gray-900 bg-white px-5 py-4 text-lg text-gray-700 transition hover:bg-gray-100"
            >
              <Mail className="h-7 w-7 shrink-0 text-gray-900" />
              Login with email &amp; password
            </button>
          </>
        )}
      </div>

      {/* OTP MODAL — password sign-in to an account not verified yet */}
      {pendingOtp && (
        <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl p-6 shadow-lg w-full max-w-[350px] relative">
            <button
              onClick={() => setPendingOtp(null)}
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

            <Otp1
              pending={pendingOtp}
              onOtpVerified={() => setPendingOtp(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Account;
