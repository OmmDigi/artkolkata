/**
 * Where parcels come from, and where returns go back to.
 *
 * A forward booking never needs this — every partner already has the pickup
 * address saved in its own panel and is told which one to use by nickname or
 * id. A reverse booking does: the courier has to be given a destination, and
 * that destination is us.
 */
export interface WarehouseAddress {
  name: string;
  phone: string;
  email?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

/**
 * Reads the warehouse out of the env.
 *
 * Throws when a field a courier requires is missing, rather than sending a
 * half-filled address: a reverse pickup booked against an incomplete address
 * is collected from the customer and then has nowhere to go.
 */
export const warehouseAddress = (): WarehouseAddress => {
  const address = {
    // SALLER_NAME is the existing spelling in .env — kept so a deployment's
    // env keeps working, with the company name as the fallback.
    name: process.env.SALLER_NAME || process.env.COMPANY_NAME || "",
    phone: process.env.WAREHOUSE_PHONE || "",
    email: process.env.WAREHOUSE_EMAIL || process.env.ADMIN_EMAIL || undefined,
    addressLine1: process.env.WAREHOUSE_ADDRESS || "",
    addressLine2: process.env.WAREHOUSE_ADDRESS_2 || undefined,
    city: process.env.WAREHOUSE_CITY || "",
    state: process.env.WAREHOUSE_STATE || "",
    pincode: process.env.WAREHOUSE_PINCODE || "",
    country: process.env.WAREHOUSE_COUNTRY || "India",
  };

  const missing = (
    [
      ["SALLER_NAME", address.name],
      ["WAREHOUSE_PHONE", address.phone],
      ["WAREHOUSE_ADDRESS", address.addressLine1],
      ["WAREHOUSE_CITY", address.city],
      ["WAREHOUSE_STATE", address.state],
      ["WAREHOUSE_PINCODE", address.pincode],
    ] as const
  )
    .filter(([, value]) => !String(value).trim())
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `The warehouse address is incomplete — set ${missing.join(", ")} in .env. A return cannot be booked without somewhere to deliver it back to.`,
    );
  }

  return address;
};
