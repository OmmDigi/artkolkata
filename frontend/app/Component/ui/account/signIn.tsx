import { postRequest } from "@/lib/fetcher";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useState, FC, ChangeEvent, FormEvent } from "react";
import { toast } from "react-toastify";
import { useCartStore } from "../../../../store/useCartStore";
import { useWishlistStore } from "../../../../store/useWishlistStore";
import { useUserStore } from "../../../../store/useUserStore";
import { PendingOtp } from "./Otp1";
import PasswordInput from "./PasswordInput";
import CountryCodeSelect, {
  DEFAULT_COUNTRY,
  looksLikePhone,
  toInternationalPhone,
} from "./CountryCodeSelect";

interface SignInProps {
  pendingOtpEmail?: string;
  isOtpVerified?: boolean;
  onRequireOtp?: () => void;
  onOpenOtp: (pending: PendingOtp) => void;
}

interface FormState {
  identifier: string;
  password: string;
}

interface LoginPayload {
  // an email address or a mobile number — the api works out which
  identifier: string;
  password: string;
}

interface LoginResponse {
  data: {
    refreshToken: string;
    user: {
      name: string;
      email: string | null;
      [key: string]: any;
    };
  };
}

interface ErrorResponse {
  response?: {
    status?: number;
    data?: {
      message?: string;
      data?: {
        otp_target?: string;
        otp_channel?: PendingOtp["channel"];
      };
    };
  };
  statusCode?: number;
  data?: {
    statusCode?: number;
  };
  status?: number;
}

const SignIn: FC<SignInProps> = ({
  pendingOtpEmail,
  isOtpVerified,
  onRequireOtp,
  onOpenOtp,
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setUser = useUserStore((state) => state.setUser);

  const [form, setForm] = useState<FormState>({ identifier: "", password: "" });
  const [country, setCountry] = useState(DEFAULT_COUNTRY);

  // the code picker shows only while the box holds a number, not an email
  const isPhone = looksLikePhone(form.identifier);
  const identifierToSend = isPhone
    ? toInternationalPhone(country, form.identifier)
    : form.identifier.trim();

  // ----------- LOGIN MUTATION -----------
  const { mutate: loginUser, isPending } = useMutation({
    mutationFn: (loginData) =>
      postRequest({
        url: "/api/v1/users/login",
        body: loginData as any,
      }),

    onSuccess: async (res: LoginResponse) => {
      setUser({
        token: res.data.refreshToken,
        name: res.data.user?.name,
        email: res.data.user?.email ?? undefined,
      });
      await useWishlistStore.getState().mergeGuestWishlist();
      await useCartStore.getState().mergeGuestCart();
      const redirectUrl = searchParams.get("redirect") || "/";
      router.push(redirectUrl);
      toast.success("Signed in successfully!");
    },

    onError: (err: ErrorResponse) => {
      if (
        err?.statusCode === 301 ||
        err?.data?.statusCode === 301 ||
        err?.status === 301 ||
        err?.response?.status === 301
      ) {
        // account not verified yet — the api has sent a code, and says where
        const sentTo = err?.response?.data?.data;
        const pending: PendingOtp = {
          target: sentTo?.otp_target ?? identifierToSend,
          channel: sentTo?.otp_channel ?? (isPhone ? "phone" : "email"),
        };
        toast.info(
          `Please verify your account. We sent an OTP to your ${pending.channel}.`,
        );
        onOpenOtp(pending);
        return;
      }

      console.error("Login error:", err);
      toast.error(err?.response?.data?.message || "Invalid credentials!");
    },
  });

  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const payload: LoginPayload = {
      identifier: identifierToSend,
      password: form.password,
    };
    loginUser(payload as any);
  };

  return (
    <div className="flex justify-center text-gray-800 ">
      <div className="w-full max-w-md bg-white py-2 sm:border sm:border-gray-200 sm:rounded-xl sm:shadow-md sm:px-8 sm:py-10">
        <h2 className="text-xl text-gray-800 font-semibold text-center mb-2">
          Welcome Back
        </h2>
        <p className="text-sm text-gray-600 text-center mb-8">
          Please sign in to access your full account
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email or phone */}
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-800">
              Email or mobile number *
            </label>
            <div
              className="flex w-full ring-1 ring-gray-300 rounded-lg shadow-sm
              focus-within:ring-2 focus-within:ring-[#02F8C5]"
            >
              {isPhone && (
                <CountryCodeSelect value={country} onChange={setCountry} />
              )}
              <input
                type="text"
                name="identifier"
                value={form.identifier}
                onChange={handleChange}
                placeholder="name@example.com or 10-digit mobile number"
                autoComplete="username"
                className={`flex-1 min-w-0 px-3 py-3 text-gray-800 outline-none ${
                  isPhone ? "rounded-r-lg" : "rounded-lg"
                }`}
                required
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-800">
              Password *
            </label>
            <PasswordInput
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              autoComplete="current-password"
              className="w-full px-3 py-3 ring-1 ring-gray-300  text-gray-800 rounded-lg shadow-sm
              focus:ring-2 focus:ring-[#02F8C5] outline-none"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className={`w-full bg-[#02F8C5]  text-black font-semibold py-3 rounded-xl shadow-md transition-all
              ${isPending ? "opacity-70 cursor-not-allowed" : ""}`}
          >
            {isPending ? "Signing In..." : "Sign In →"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-700 mt-6">
          <Link
            href="/forgotPassword"
            className="text-amber-600 hover:underline border-b border-amber-400 "
          >
            Lost your password?
          </Link>
        </p>
      </div>
    </div>
  );
};

export default SignIn;
