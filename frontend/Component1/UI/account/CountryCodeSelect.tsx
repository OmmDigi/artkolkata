import React, { FC } from "react";
import Image from "next/image";

export interface CountryCode {
  iso: string;
  name: string;
  /** dialling code without the + */
  dial: string;
  /** flag image path in /public — emoji flags don't render on every browser (e.g. Windows) */
  flag: string;
  /** digits in a local mobile number, used to cap the input */
  length: number;
}

/**
 * Countries a customer can register a mobile number in. India only for now:
 * the OTP goes through an Indian DLT SMS gateway, which cannot deliver
 * anywhere else. Add a country here once there is a gateway that reaches it
 * (and the api accepts its numbers — see normalizeIndianPhone).
 */
export const COUNTRY_CODES: CountryCode[] = [
  { iso: "IN", name: "India", dial: "91", flag: "/flag-in.png", length: 10 },
];

export const DEFAULT_COUNTRY = COUNTRY_CODES[0];

/**
 * Whether the shared "email or mobile number" box currently holds a number,
 * so the code picker is shown beside it only then.
 */
export const looksLikePhone = (value: string) =>
  /^\+?[\d\s-]+$/.test(value.trim());

/**
 * The local number with the picked code in front: "+919876543210".
 * A number typed with its own "+code" is kept as typed; a leading 0 or a
 * pasted copy of the code is dropped so it is not doubled up.
 */
export const toInternationalPhone = (country: CountryCode, raw: string) => {
  const trimmed = raw.trim();
  let digits = trimmed.replace(/\D/g, "");

  if (trimmed.startsWith("+")) return `+${digits}`;

  digits = digits.replace(/^0+/, "");
  if (digits.length > country.length && digits.startsWith(country.dial))
    digits = digits.slice(country.dial.length);

  return `+${country.dial}${digits}`;
};

interface CountryCodeSelectProps {
  value: CountryCode;
  onChange: (country: CountryCode) => void;
  className?: string;
}

const CountryCodeSelect: FC<CountryCodeSelectProps> = ({
  value,
  onChange,
  className = "",
}) => (
  <div className="flex shrink-0 items-center gap-1.5 bg-gray-50 pl-3 border-r border-gray-300 rounded-l-lg">
    {/* <option> can't hold an image, so the picked country's flag sits beside the select */}
    <Image src={value.flag} alt={value.name} width={20} height={13} />
    <select
      aria-label="Country code"
      value={value.iso}
      onChange={(e) =>
        onChange(
          COUNTRY_CODES.find((c) => c.iso === e.target.value) ??
            DEFAULT_COUNTRY,
        )
      }
      className={`bg-transparent pr-1 text-sm text-gray-800 outline-none cursor-pointer ${className}`}
    >
      {COUNTRY_CODES.map((c) => (
        <option key={c.iso} value={c.iso}>
          +{c.dial}
        </option>
      ))}
    </select>
  </div>
);

export default CountryCodeSelect;
