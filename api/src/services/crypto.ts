import crypto from "crypto";

const algorithm = "aes-256-gcm";
const ivLength = 16; // Initialization Vector length

// Encrypt function
export function encrypt(text: string) {
  const secretKey = crypto
    .createHash("sha256")
    .update(process.env.CRYPTO_SECRET_KEY as string) // Replace with a secure key/passphrase
    .digest(); // Ensures a 256-bit key
  const iv = crypto.randomBytes(ivLength);
  const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return `${iv.toString("hex")}:${encrypted}:${authTag}`;
}

// Decrypt function
export function decrypt(encryptedText: string) {
  try {
    const secretKey = crypto
      .createHash("sha256")
      .update(process.env.CRYPTO_SECRET_KEY as string) // Replace with a secure key/passphrase
      .digest(); // Ensures a 256-bit key
    const [ivHex, encrypted, authTagHex] = encryptedText.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    const decipher = crypto.createDecipheriv(algorithm, secretKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return { isError: false, decrypted };
  } catch (error : any) {
    return { isError: true };
  }
}
