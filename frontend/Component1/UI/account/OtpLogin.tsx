"use client";

import { postRequest } from "@/lib/fetcher";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, {
  ClipboardEvent,
  FC,
  FormEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "react-toastify";
import { useUserStore } from "@/hooks/useUserStore";
import { useWishlistStore } from "@/store/useWishlistStore";
import { useCartStore } from "@/store/useCartStore";
import { PendingOtp, describeOtpTarget } from "./Otp1";
import CountryCodeSelect, {
  DEFAULT_COUNTRY,
  toInternationalPhone,
} from "./CountryCodeSelect";

/**
 * Login/Signup with OTP. One code proves the phone or email: an existing
 * account is signed in straight away, a new one is asked only for a name.
 *
 *   request → verify → (new customers only) name
 */

type Channel = PendingOtp["channel"];
type Step = "request" | "verify" | "name";

const OTP_LENGTH = 4;
const RESEND_SECONDS = 30;

interface SessionResponse {
  data: {
    refreshToken?: string;
    is_new_user?: boolean;
    signup_token?: string;
    user?: { name: string; email: string | null; phone_no?: string };
  };
}

interface ApiError {
  response?: { status?: number; data?: { message?: string } };
}

const errorMessage = (err: ApiError, fallback: string) =>
  err?.response?.data?.message || fallback;

const inputBox =
  "flex w-full rounded-lg ring-1 ring-gray-300 bg-white focus-within:ring-2 focus-within:ring-[#02F8C5]";

const primaryButton =
  "w-full sm:w-auto sm:min-w-[220px] bg-[#02F8C5] text-black font-semibold px-8 py-3 shadow-md transition disabled:opacity-60 disabled:cursor-not-allowed";

const OtpLogin: FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setUser = useUserStore((state) => state.setUser);

  const [step, setStep] = useState<Step>("request");
  const [channel, setChannel] = useState<Channel>("phone");
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(true);

  const [pending, setPending] = useState<PendingOtp | null>(null);
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [resendIn, setResendIn] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [signupToken, setSignupToken] = useState("");
  const [name, setName] = useState("");

  // resend countdown
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  useEffect(() => {
    if (step === "verify") otpRefs.current[0]?.focus();
  }, [step]);

  const identifier =
    channel === "phone"
      ? toInternationalPhone(country, phone)
      : email.trim();

  const startSession = async (res: SessionResponse, message: string) => {
    const { refreshToken, user } = res.data;
    if (!refreshToken) return;

    setUser({
      token: refreshToken,
      name: user?.name,
      email: user?.email ?? undefined,
      phone: user?.phone_no || undefined,
    });
    // the guest wishlist and cart saved in this browser are handed over
    await useWishlistStore.getState().mergeGuestWishlist();
    await useCartStore.getState().mergeGuestCart();

    toast.success(message);
    router.push(searchParams.get("redirect") || "/");
  };

  // ----------- 1. SEND OTP -----------
  const { mutate: sendOtp, isPending: isSending } = useMutation({
    mutationFn: (target: string) =>
      postRequest<{ data: { otp_target: string; otp_channel: Channel } }>({
        url: "/api/v1/users/otp-login/send",
        body: { identifier: target },
      }),
    onSuccess: (res, target) => {
      setPending({
        target: res?.data?.otp_target ?? target,
        channel: res?.data?.otp_channel ?? channel,
      });
      setOtp(Array(OTP_LENGTH).fill(""));
      setResendIn(RESEND_SECONDS);
      setStep("verify");
      toast.success("OTP sent!");
    },
    onError: (err: ApiError) =>
      toast.error(errorMessage(err, "Could not send the OTP. Please try again.")),
  });

  // ----------- 2. VERIFY OTP -----------
  const { mutate: verifyOtp, isPending: isVerifying } = useMutation({
    mutationFn: (code: string) =>
      postRequest<SessionResponse>({
        url: "/api/v1/users/otp-login/verify",
        body: { identifier: pending!.target, otp: code },
      }),
    onSuccess: async (res) => {
      if (res.data?.is_new_user && res.data.signup_token) {
        setSignupToken(res.data.signup_token);
        setStep("name");
        return;
      }
      await startSession(res, "Signed in successfully!");
    },
    onError: (err: ApiError) => {
      toast.error(errorMessage(err, "Invalid OTP, try again!"));
      setOtp(Array(OTP_LENGTH).fill(""));
      otpRefs.current[0]?.focus();
    },
  });

  // ----------- 3. NEW CUSTOMER: NAME -----------
  const { mutate: completeSignup, isPending: isCompleting } = useMutation({
    mutationFn: () =>
      postRequest<SessionResponse>({
        url: "/api/v1/users/otp-login/complete",
        body: { signup_token: signupToken, name: name.trim() },
      }),
    onSuccess: (res) => startSession(res, "Welcome! Your account is ready."),
    onError: (err: ApiError) => {
      toast.error(errorMessage(err, "Could not create your account."));
      // the proof of the otp has expired, or the account now exists: start again
      const status = err?.response?.status;
      if (status === 400 || status === 409) setStep("request");
    },
  });

  const handleRequest = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!acceptedTerms) {
      toast.error("Please accept the terms and conditions to continue");
      return;
    }
    if (channel === "phone" && phone.length !== country.length) {
      toast.error(`Enter a valid ${country.length}-digit mobile number`);
      return;
    }
    sendOtp(identifier);
  };

  const submitOtp = (digits: string[]) => {
    const code = digits.join("");
    if (code.length === OTP_LENGTH && !isVerifying) verifyOtp(code);
  };

  const handleOtpChange = (index: number, raw: string) => {
    const value = raw.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    if (value && index < OTP_LENGTH - 1) otpRefs.current[index + 1]?.focus();
    // the last digit submits on its own
    if (value && next.every(Boolean)) submitOtp(next);
  };

  const handleOtpKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0)
      otpRefs.current[index - 1]?.focus();
  };

  const handleOtpPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const digits = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, OTP_LENGTH);
    if (!digits) return;
    e.preventDefault();
    const next = Array.from({ length: OTP_LENGTH }, (_, i) => digits[i] ?? "");
    setOtp(next);
    otpRefs.current[Math.min(digits.length, OTP_LENGTH - 1)]?.focus();
    submitOtp(next);
  };

  // ======================= RENDER =======================

  if (step === "verify" && pending) {
    return (
      <div className="text-center text-gray-800">
        <h2 className="text-2xl sm:text-3xl font-bold mb-2">Enter OTP</h2>
        <p className="text-sm text-gray-600 mb-6">
          We sent a {OTP_LENGTH}-digit OTP to {describeOtpTarget(pending)}.{" "}
          <button
            type="button"
            onClick={() => setStep("request")}
            className="font-semibold text-gray-900 underline"
          >
            Change
          </button>
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (otp.join("").length !== OTP_LENGTH) {
              toast.error(`Please enter the ${OTP_LENGTH}-digit OTP`);
              return;
            }
            submitOtp(otp);
          }}
          className="flex flex-col items-center gap-6"
        >
          <div className="flex gap-3">
            {otp.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => {
                  otpRefs.current[idx] = el;
                }}
                type="text"
                inputMode="numeric"
                autoComplete={idx === 0 ? "one-time-code" : "off"}
                aria-label={`OTP digit ${idx + 1}`}
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(idx, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                onPaste={handleOtpPaste}
                className="w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl rounded-lg ring-1 ring-gray-300 outline-none focus:ring-2 focus:ring-[#02F8C5]"
              />
            ))}
          </div>

          <button type="submit" disabled={isVerifying} className={primaryButton}>
            {isVerifying ? "Verifying..." : "Verify OTP"}
          </button>
        </form>

        <p className="mt-4 text-sm text-gray-600">
          {resendIn > 0 ? (
            <>Resend OTP in {resendIn}s</>
          ) : (
            <button
              type="button"
              onClick={() => sendOtp(pending.target)}
              disabled={isSending}
              className="font-semibold text-gray-900 underline disabled:opacity-60"
            >
              {isSending ? "Sending..." : "Didn't get the code? Resend OTP"}
            </button>
          )}
        </p>
      </div>
    );
  }

  if (step === "name") {
    return (
      <div className="text-center text-gray-800">
        <h2 className="text-2xl sm:text-3xl font-bold mb-2">Almost there!</h2>
        <p className="text-sm text-gray-600 mb-6">
          Your {pending?.channel === "email" ? "email" : "number"} is verified.
          What should we call you?
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim().length < 2) {
              toast.error("Please enter your name");
              return;
            }
            completeSignup();
          }}
          className="flex flex-col items-center gap-6"
        >
          <div className={inputBox}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              autoComplete="name"
              autoFocus
              maxLength={100}
              className="flex-1 min-w-0 px-4 py-3 text-lg rounded-lg outline-none"
              required
            />
          </div>

          <button type="submit" disabled={isCompleting} className={primaryButton}>
            {isCompleting ? "Creating account..." : "Continue"}
          </button>
        </form>
      </div>
    );
  }

  // ----------- step: request -----------
  return (
    <div className="text-gray-800">
      <h2 className="text-2xl sm:text-3xl font-bold text-center mb-6 sm:mb-8">
        Login/Signup With OTP
      </h2>

      <form onSubmit={handleRequest} className="space-y-5">
        {/* channel picker */}
        <div role="radiogroup" className="grid grid-cols-2 gap-3 sm:gap-4">
          {(
            [
              ["phone", "Mobile"],
              ["email", "Email"],
            ] as const
          ).map(([value, label]) => {
            const active = channel === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setChannel(value)}
                className={`flex items-center gap-3 rounded-lg px-4 py-3 ring-1 transition ${
                  active ? "ring-2 ring-[#02F8C5]" : "ring-gray-300 hover:ring-gray-400"
                }`}
              >
                <span
                  className={`h-6 w-6 shrink-0 rounded-full border-2 ${
                    active ? "border-[#02F8C5] bg-[#02F8C5]" : "border-gray-300 bg-white"
                  }`}
                />
                <span className="text-lg">{label}</span>
              </button>
            );
          })}
        </div>

        {/* phone or email */}
        {channel === "phone" ? (
          <div className={inputBox}>
            <CountryCodeSelect
              value={country}
              onChange={setCountry}
              className="py-3 text-base"
            />
            <input
              type="tel"
              value={phone}
              onChange={(e) =>
                setPhone(e.target.value.replace(/\D/g, "").slice(0, country.length))
              }
              placeholder="Phone Number"
              inputMode="numeric"
              autoComplete="tel-national"
              aria-label="Phone number"
              className="flex-1 min-w-0 px-4 py-3 text-lg rounded-r-lg outline-none"
              required
            />
          </div>
        ) : (
          <div className={inputBox}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email Address"
              autoComplete="email"
              aria-label="Email address"
              className="flex-1 min-w-0 px-4 py-3 text-lg rounded-lg outline-none"
              required
            />
          </div>
        )}

        {/* terms */}
        <label className="flex items-start gap-3 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-black cursor-pointer"
          />
          <span>
            By continuing to login you agree to accept Art Kolkata&apos;s{" "}
            <Link
              href="/terms-conditions"
              target="_blank"
              className="font-bold text-gray-900 hover:underline"
            >
              terms and conditions
            </Link>
          </span>
        </label>

        <div className="flex justify-center pt-1">
          <button
            type="submit"
            disabled={isSending || !acceptedTerms}
            className={primaryButton}
          >
            {isSending ? "Sending OTP..." : "Request OTP"}
          </button>
        </div>

        <p className="text-center text-sm text-gray-600">
          A {OTP_LENGTH} digit OTP will be sent to your{" "}
          {channel === "phone" ? "phone number" : "email"}
        </p>
      </form>
    </div>
  );
};

export default OtpLogin;
