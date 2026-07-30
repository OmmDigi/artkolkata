import { postRequest } from "@/lib/fetcher";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import React, {
  useState,
  useRef,
  FC,
  FormEvent,
  ChangeEvent,
  KeyboardEvent,
} from "react";

import { toast } from "react-toastify";

interface ResetOtpModalProps {
  onClose: () => void;
  email: string;
}

interface FormState {
  otp: string[];
  password: string;
  retypePassword: string;
}

interface VerifyOtpPayload {
  otp: string;
  email: string;
  newpassword?: string;
}

interface OtpResponse {
  success: boolean;
  message: string;
}

interface ErrorResponse {
  response?: {
    data?: {
      message?: string;
    };
  };
}

const ResetOtpModal: FC<ResetOtpModalProps> = ({ onClose, email }) => {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    otp: ["", "", "", ""],
    password: "",
    retypePassword: "",
  });

  const [error, setError] = useState<string>("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // -------------------- VERIFY OTP MUTATION --------------------
  const { mutate: verifyOtp, isPending: isLoading } = useMutation({
    mutationFn: (payload) =>
      postRequest({
        url: "/api/v1/users/verify-otp",
        body: payload as any,
      }),

    onSuccess: () => {
      toast.success("OTP verified successfully!");
      onClose();
      router.push("/account");
    },

    onError: (err: ErrorResponse) => {
      console.error("OTP verification error:", err);
      toast.error(err?.response?.data?.message || "Invalid OTP!");
    },
  });

  // -------------------- OTP INPUT HANDLER --------------------
  const handleOtpInput = (e: ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value;
    if (!/^[0-9]?$/.test(value)) return;

    const index = inputRefs.current.indexOf(e.target);
    const updatedOtp = [...form.otp];
    updatedOtp[index] = value;
    setForm((prev) => ({ ...prev, otp: updatedOtp }));

    if (value && index < form.otp.length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    const index = inputRefs.current.indexOf(e.currentTarget);

    if (
      !["Backspace", "Delete", "Tab"].includes(e.key) &&
      !/^[0-9]$/.test(e.key)
    ) {
      e.preventDefault();
    }

    if ((e.key === "Backspace" || e.key === "Delete") && index > 0) {
      const updatedOtp = [...form.otp];
      updatedOtp[index] = "";
      setForm((prev) => ({ ...prev, otp: updatedOtp }));
      inputRefs.current[index - 1]?.focus();
    }
  };

  // -------------------- PASSWORD CHANGE HANDLER --------------------
  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // -------------------- SUBMIT HANDLER --------------------
  const handleSubmit = (): void => {
    const otpValue = form.otp.join("");

    if (otpValue.length !== 4) {
      toast.error("Please enter 4 digit OTP");
      return;
    }

    if (form.password !== form.retypePassword) {
      setError("Passwords do not match!");
      return;
    }

    setError("");
    verifyOtp({
      otp: otpValue,
      email: email,
      password: form.password,
    } as any);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 shadow-lg w-[350px] relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-600 text-2xl"
          type="button"
          aria-label="Close modal"
        >
          ×
        </button>

        <h2 className="text-xl font-semibold text-center mb-4">Enter OTP</h2>

        {/* OTP FIELDS */}
        <div className="flex justify-center gap-2 mb-6">
          {form.otp.map((digit, idx) => (
            <input
              key={idx}
              type="text"
              maxLength={1}
              value={digit}
              onChange={handleOtpInput}
              onKeyDown={handleOtpKeyDown}
              ref={(el) => {
                inputRefs.current[idx] = el;
              }}
              className="w-12 h-12 border text-center rounded-lg text-xl shadow-sm
              ring-1 ring-gray-300 focus:ring-2 focus:ring-[#000000] outline-none"
              inputMode="numeric"
              autoComplete="off"
            />
          ))}
        </div>

        {/* PASSWORD INPUTS */}
        <input
          type="password"
          name="password"
          placeholder="New Password"
          className="w-full mb-3 px-3 py-2 ring-1 ring-gray-300 rounded-lg"
          value={form.password}
          onChange={handleChange}
        />

        <input
          type="password"
          name="retypePassword"
          placeholder="Retype Password"
          className="w-full mb-2 px-3 py-2 ring-1 ring-gray-300 rounded-lg"
          value={form.retypePassword}
          onChange={handleChange}
        />

        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

        {/* BUTTON */}
        <button
          type="button"
          disabled={isLoading}
          onClick={handleSubmit}
          className={`w-full bg-[#000000]  text-white py-2.5 font-semibold 
          rounded-lg shadow-md ${isLoading && "opacity-60 cursor-not-allowed"}`}
        >
          {isLoading ? "Verifying OTP..." : "Reset Password →"}
        </button>
      </div>
    </div>
  );
};

export default ResetOtpModal;
