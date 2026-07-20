import { postRequest } from "@/lib/fetcher";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import React, { useRef, useState, FC, FormEvent, ChangeEvent } from "react";
import { toast } from "react-toastify";

interface Otp1Props {
  email: string;
  onOtpVerified?: () => void;
}

interface VerifyOtpPayload {
  otp: string;
  email: string;
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

const Otp1: FC<Otp1Props> = ({ email, onOtpVerified }) => {
  const router = useRouter();
  const [otp, setOtp] = useState<string[]>(Array(4).fill(""));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const { mutate: verifyOtp, isPending } = useMutation({
    mutationFn: (payload) =>
      postRequest({
        url: "/api/v1/users/verify-otp",
        body: payload as any,
      }),
    onSuccess: (data: OtpResponse) => {
      toast.success("OTP Verified Successfully!");
      if (onOtpVerified) onOtpVerified();
      router.push("/");
    },
    onError: (err: ErrorResponse) => {
      toast.error(err?.response?.data?.message || "Invalid OTP, try again!");
    },
  });

  const handleSubmitOtp = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const otpValue = otp.join("");
    if (otpValue.length !== 4) {
      toast.error("Please enter 4 digit OTP");
      return;
    }
    verifyOtp({ otp: otpValue, email } as any);
  };

  const handleInput = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (!/^[0-9]?$/.test(value)) return;

    const index = inputRefs.current.indexOf(e.target);
    const updatedOtp = [...otp];
    updatedOtp[index] = value;
    setOtp(updatedOtp);

    if (value && index < otp.length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  return (
    <form
      onSubmit={handleSubmitOtp}
      className="flex flex-col items-center gap-4 text-gray-800"
    >
      <div className="flex gap-2">
        {otp.map((digit, idx) => (
          <input
            key={idx}
            type="text"
            maxLength={1}
            value={digit}
            onChange={handleInput}
            ref={(el) => {
              inputRefs.current[idx] = el;
            }}
            className="shadow-xs w-[60px] text-center text-2xl border rounded-lg py-2"
            inputMode="numeric"
            autoComplete="off"
          />
        ))}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className={`bg-amber-400 hover:bg-amber-500 text-white font-medium px-4 py-2 rounded-lg shadow-md
        ${isPending && "opacity-60 cursor-not-allowed"}`}
      >
        {isPending ? "Verifying OTP..." : "Submit OTP"}
      </button>
    </form>
  );
};

export default Otp1;
