export const generateOrderNumber = (): string => {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  const timestamp = `${year}${month}${day}`;

  // random 5-digit number
  const random = Math.floor(10000 + Math.random() * 90000);

  return `ORD${timestamp}${random}`;
};
