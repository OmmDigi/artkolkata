// Register.jsx
import { postRequest } from "@/lib/fetcher";
import { useMutation } from "@tanstack/react-query";
import React, { useState } from "react";
import { toast } from "react-toastify";
import { PendingOtp } from "./Otp1";
import PasswordInput from "./PasswordInput";
import CountryCodeSelect, {
  DEFAULT_COUNTRY,
  toInternationalPhone,
} from "./CountryCodeSelect";

interface RegisterProps {
  onSignupSuccess?: (pending: PendingOtp) => void;
}

const Register = ({ onSignupSuccess }: RegisterProps) => {
  const [form, setForm] = useState({
    username: "",
    email: "",
    phone_no: "",
    password: "",
  });
  const [country, setCountry] = useState(DEFAULT_COUNTRY);

  const {
    mutate: signupUser,
    isPending: isLoading,
    isError,
    error,
  } = useMutation({
    mutationFn: (formData: any) => {
      // email is optional — left out entirely rather than sent blank
      const payload = {
        name: formData.username,
        phone_no: toInternationalPhone(country, formData.phone_no),
        password: formData.password,
        ...(formData.email.trim() ? { email: formData.email.trim() } : {}),
      };

      return postRequest({
        url: "/api/v1/users/signup",
        body: payload,
      });
    },

    onSuccess: (res: any) => {
      toast.success("Account created! Enter the OTP sent to your phone.");
      if (onSignupSuccess) {
        // tell parent where the OTP went, as the api normalised it
        onSignupSuccess({
          target:
            res?.data?.otp_target ?? toInternationalPhone(country, form.phone_no),
          channel: res?.data?.otp_channel ?? "phone",
        });
      }
      setForm({
        username: "",
        email: "",
        phone_no: "",
        password: "",
      });
    },

    onError: (err: any) => {
      console.error("Signup error:", err);
      toast.error(err?.response?.data?.message || "Signup failed!");
    },
  });

  const handleChange = (e: any) => {
    const { name } = e.target;
    // the code comes from the picker, so the number box takes digits only
    const value =
      name === "phone_no" ? e.target.value.replace(/\D/g, "") : e.target.value;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: any) => {
    e.preventDefault();
    signupUser(form);
  };

  return (
    <div className="relative mx-auto w-full max-w-md bg-white py-2 sm:border sm:border-gray-200 sm:rounded-xl sm:shadow-md sm:px-8 sm:py-10">
      <h4 className="text-xl text-gray-800 font-semibold mb-3">
        Create Account
      </h4>

      <p className="text-sm text-gray-700 mb-3">
        Your personal data will be used to support your experience.
      </p>

      <form onSubmit={handleSubmit} className="text-gray-800">
        {/* Username */}
        <div className="mb-5 ">
          <label className="block mb-1 text-sm font-medium">Username *</label>
          <input
            type="text"
            name="username"
            value={form.username}
            onChange={handleChange}
            className="w-full px-3 py-3 ring-1 ring-gray-300 rounded-lg text-start"
            placeholder="Enter username"
            required
          />
        </div>

        {/* Phone Number */}
        <div className="mb-5">
          <label className="block mb-1 text-sm font-medium">
            Mobile Number *
          </label>
          <div className="flex w-full ring-1 ring-gray-300 rounded-lg">
            <CountryCodeSelect value={country} onChange={setCountry} />
            <input
              type="tel"
              name="phone_no"
              value={form.phone_no}
              onChange={handleChange}
              className="flex-1 min-w-0 px-3 py-3 rounded-r-lg outline-none"
              placeholder={`${country.length}-digit mobile number`}
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={country.length}
              required
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">
            We&apos;ll send an OTP to verify this number.
          </p>
        </div>

        {/* Email */}
        <div className="mb-5">
          <label className="block mb-1 text-sm font-medium">
            Email address <span className="text-gray-500">(optional)</span>
          </label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            className="w-full px-3 py-3 ring-1 ring-gray-300 rounded-lg"
            placeholder="name@example.com"
          />
        </div>

        {/* Password */}
        <div className="mb-5">
          <label className="block mb-1 text-sm font-medium">Password *</label>
          <PasswordInput
            name="password"
            value={form.password}
            onChange={handleChange}
            className="w-full px-3 py-3 ring-1 ring-gray-300 rounded-lg"
            placeholder="••••••••"
            autoComplete="new-password"
            required
          />
        </div>

        {isError && (
          <p className="text-sm text-red-600 mb-2">
            {error?.response?.data?.message || "Something went wrong."}
          </p>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className={`w-full bg-[#02F8C5] font-semibold text-black py-3 rounded-xl shadow-md 
          ${isLoading && "opacity-70 cursor-not-allowed"}`}
        >
          {isLoading ? "Creating Account..." : "Create Account →"}
        </button>
      </form>
    </div>
  );
};

export default Register;
