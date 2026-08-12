import { postRequest } from "@/lib/fetcher";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState, FC, ChangeEvent, FormEvent } from "react";
import { toast } from "react-toastify";
import { useUserStore } from "../../../../store/useUserStore";

interface SignInProps {
  pendingOtpEmail?: string;
  isOtpVerified?: boolean;
  onRequireOtp?: () => void;
  onOpenOtp: (email: string) => void;
}

interface FormState {
  email: string;
  password: string;
}

interface LoginPayload {
  email: string;
  password: string;
}

interface LoginResponse {
  data: {
    refreshToken: string;
    user: {
      name: string;
      email: string;
      [key: string]: any;
    };
  };
}

interface ErrorResponse {
  response?: {
    data?: {
      message?: string;
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
  const setUser = useUserStore((state) => state.setUser);

  const [form, setForm] = useState<FormState>({ email: "", password: "" });

  // ----------- LOGIN MUTATION -----------
  const { mutate: loginUser, isPending } = useMutation({
    mutationFn: (loginData) =>
      postRequest({
        url: "/api/v1/users/login",
        body: loginData as any,
      }),

    onSuccess: (res: LoginResponse) => {
      setUser({
        token: res.data.refreshToken,
        name: res.data.user?.name,
        email: res.data.user?.email,
      });
      router.push("/");
      toast.success("Signed in successfully!");
    },

    onError: (err: ErrorResponse) => {
      console.error("Login error:", err);
      toast.error(err?.response?.data?.message || "Invalid credentials!");

      if (
        err?.statusCode === 301 ||
        err?.data?.statusCode === 301 ||
        err?.status === 301
      ) {
        toast.info("Please check your email for OTP!");
        console.log("301 detected, opening OTP with email:", form.email);
        onOpenOtp(form.email);
        return;
      }
    },
  });

  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const payload: LoginPayload = {
      email: form.email,
      password: form.password,
    };
    loginUser(payload as any);
  };

  return (
    <div className="flex justify-center text-gray-800 ">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-xl shadow-md px-8 py-10">
        <h2 className="text-xl text-gray-800 font-semibold text-center mb-2">
          Welcome Back
        </h2>
        <p className="text-sm text-gray-600 text-center mb-8">
          Please sign in to access your full account
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email */}
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-800">
              Email address *
            </label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="name@example.com"
              className="w-full px-3 py-3 ring-1 ring-gray-300 text-gray-800 rounded-lg shadow-sm
              focus:ring-2 focus:ring-[#02F8C5] outline-none"
              required
            />
          </div>

          {/* Password */}
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-800">
              Password *
            </label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
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
