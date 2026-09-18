import { PoolClient } from "pg";
import { IShippingAddress } from "../types";
import logger from "./logger";

// Keeps the customer's address book in sync with what they typed at checkout.
// The order itself already stores a JSON snapshot, this is the reusable copy the
// user sees on the next checkout / in their profile.
//
// Every parameter is cast explicitly: without the casts the INSERT column type
// (varchar) and the TRIM() calls below (text) deduce two different types for the
// same parameter and Postgres rejects the statement with 42P08.
//
// Values are clamped to the column widths first. Checkout only validates that
// the fields are present, so a customer typing an email into the phone box sends
// 21 characters into phone VARCHAR(20) and the whole insert dies with 22001 --
// the order snapshot keeps the untouched value either way.
//
// Runs inside the order transaction, so it is wrapped in a SAVEPOINT: anything
// still rejected here rolls back only this insert and never kills the order that
// is being placed.

// widths come from the addresses table in config/database.sql
const clamp = (value: string | null | undefined, maxLength: number) =>
  (value ?? "").trim().slice(0, maxLength);

export const saveOrderAddress = async (
  client: PoolClient,
  userId: number,
  shipping: IShippingAddress,
) => {
  try {
    await client.query("SAVEPOINT save_order_address");

    // Only insert when the user does not already have the same address, so
    // repeat orders from one address don't pile up duplicate rows.
    await client.query(
      `
      INSERT INTO addresses
        (name, phone, email, address_line1, address_line2, city, state, pincode, user_id)
      SELECT $1::text, $2::text, $3::text, $4::text, $4::text, $5::text, $6::text, $7::text, $8::int
      WHERE NOT EXISTS (
        SELECT 1 FROM addresses
        WHERE user_id = $8::int
          AND LOWER(TRIM(address_line1)) = LOWER(TRIM($4::text))
          AND LOWER(TRIM(COALESCE(city, ''))) = LOWER(TRIM($5::text))
          AND LOWER(TRIM(COALESCE(state, ''))) = LOWER(TRIM($6::text))
          AND TRIM(COALESCE(pincode, '')) = TRIM($7::text)
      )
      `,
      [
        clamp(shipping.fullName, 150),
        clamp(shipping.phone, 20),
        clamp(shipping.email, 120),
        shipping.address, // address_line1 is TEXT, nothing to clamp
        clamp(shipping.city, 120),
        clamp(shipping.state, 120),
        clamp(shipping.pincode, 10),
        userId,
      ],
    );

    await client.query("RELEASE SAVEPOINT save_order_address");
  } catch (error) {
    await client.query("ROLLBACK TO SAVEPOINT save_order_address");
    logger.error({
      message: "saveOrderAddress failed, order continues without saving it",
      userId,
      error,
    });
  }
};
