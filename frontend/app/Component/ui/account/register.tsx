// Register.jsx
import { postRequest } from "@/lib/fetcher";
import { useMutation } from "@tanstack/react-query";
import React, { useState } from "react";
import { toast } from "react-toastify";

const Register = ({ onSignupSuccess }: any) => {
  const [form, setForm] = useState({
    username: "",
    email: "",
    phone_no: "",
    password: "",
  });

  const {
    mutate: signupUser,
    isPending: isLoading,
    isError,
    error,
  } = useMutation({
    mutationFn: (formData: any) => {
      const payload = {
        name: formData.username,
        email: formData.email,
        phone_no: formData.phone_no,
        password: formData.password,
      };

      return postRequest({
        url: "/api/v1/users/signup",
        body: payload,
      });
    },

    onSuccess: () => {
      //  setRegisteredEmail(form.email);

      toast.success("Account created successfully!");
      if (onSignupSuccess) {
        onSignupSuccess(form.email); // tell parent which email needs OTP
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
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: any) => {
    e.preventDefault();
    signupUser(form);
  };

  return (
    <div className="relative mx-auto w-full max-w-md bg-white border border-gray-200 rounded-xl shadow-md px-8 py-10">
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

        {/* Email */}
        <div className="mb-5">
          <label className="block mb-1 text-sm font-medium">
            Email address *
          </label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            className="w-full px-3 py-3 ring-1 ring-gray-300 rounded-lg"
            placeholder="name@example.com"
            required
          />
        </div>

        {/* Phone Number */}
        <div className="mb-5">
          <label className="block mb-1 text-sm font-medium">
            Phone Number *
          </label>
          <input
            type="tel"
            name="phone_no"
            value={form.phone_no}
            onChange={handleChange}
            className="w-full px-3 py-3 ring-1 ring-gray-300 rounded-lg"
            placeholder="Enter phone number"
            required
          />
        </div>

        {/* Password */}
        <div className="mb-5">
          <label className="block mb-1 text-sm font-medium">Password *</label>
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            className="w-full px-3 py-3 ring-1 ring-gray-300 rounded-lg"
            placeholder="••••••••"
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
          className={`w-full bg-[#000000] font-semibold text-white py-3 rounded-xl shadow-md 
          ${isLoading && "opacity-70 cursor-not-allowed"}`}
        >
          {isLoading ? "Creating Account..." : "Create Account →"}
        </button>
      </form>
    </div>
  );
};

export default Register;
