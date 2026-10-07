import crypto from "crypto";

// crypto, not Math.random: an otp is a secret and Math.random is predictable
export const createOtp = () => crypto.randomInt(1000, 10000);
