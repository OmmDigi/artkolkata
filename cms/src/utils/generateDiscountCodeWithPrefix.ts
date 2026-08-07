export function generateDiscountCodeWithPrefix(prefix?: string, length: number = 8): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  if(prefix) {
    code = prefix.toUpperCase() + "-";
  }

  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return code;
}
