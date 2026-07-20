import { PhonePe } from "../services/PhonePe";

export const phonePe = () =>
  new PhonePe(
    process.env.PHONEPE_MERCHANT_KEY || "",
    process.env.PHONEPE_MERCHANT_ID || "",
    process.env.PHONEPE_MERCHANT_BASE_URL || "",
    process.env.PHONEPE_MERCHANT_STATUS_URL || ""
  );
