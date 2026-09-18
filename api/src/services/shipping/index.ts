import { BigshipPartner } from "./bigship.partner";
import { NonePartner } from "./none.partner";
import { ShiprocketPartner } from "./shiprocket.partner";
import { IShippingPartner, ShippingPartnerName } from "./shipping.partner";

export * from "./shipping.partner";
export * from "./shipmentBoxes";
export { EWAYBILL_THRESHOLD } from "./bigship.client";

/**
 * The live shipping partner, built once when the server starts.
 *
 * Constructing it at boot rather than per request means a misconfigured
 * partner is a loud startup failure instead of an admin watching a confirm
 * fail, and every call site then reads the same object.
 */
let partner: IShippingPartner | null = null;

const SUPPORTED: ShippingPartnerName[] = ["shiprocket", "bigship", "none"];

const build = (name: ShippingPartnerName): IShippingPartner => {
  if (name === "none") return new NonePartner();
  if (name === "bigship") return new BigshipPartner();
  return new ShiprocketPartner();
};

/**
 * Reads SHIPPING_PARTNER and stands the partner up. Call once, from index.ts,
 * after dotenv has run.
 *
 * Throws on an unknown name instead of quietly falling back. A typo that fell
 * back would book live orders with the wrong courier account, and nobody would
 * notice until the parcels did not arrive; a refusal to start is visible in the
 * first second and fixed by editing one line of env.
 */
export const initShippingPartner = (): IShippingPartner => {
  // SHIPPING_PROVIDER is the name this used to be called. Still read so an
  // existing deployment's env keeps working.
  const configured = (
    process.env.SHIPPING_PARTNER ??
    process.env.SHIPPING_PROVIDER ??
    "shiprocket"
  )
    .trim()
    .toLowerCase() as ShippingPartnerName;

  if (!SUPPORTED.includes(configured))
    throw new Error(
      `SHIPPING_PARTNER "${configured}" is not supported. Use one of: ${SUPPORTED.join(", ")}`,
    );

  partner = build(configured);

  // Nothing to reach out to when shipping is off, and a probe would only print
  // a reassuring line about a partner that does not exist.
  if (partner.name !== "none") {
    partner
      .checkShipment({
        pincode: process.env.WAREHOUSE_PINCODE ?? "700074",
      })
      .catch((e) => {
        console.log("Error while checking shipping partner connection");
      });
  }

  console.log(`Shipping partner: ${partner.label}`);

  return partner;
};

/**
 * Is there a courier integration at all?
 *
 * getShippingPartner() always returns something, so this is the question the
 * call sites that have to *word* themselves differently ask — the admin
 * confirming an order should not be told "no shipment was booked" by a shop
 * that never books shipments. The call sites that merely act, rather than
 * report, go straight through the partner and get a harmless no-op.
 */
export const isShippingEnabled = (): boolean =>
  getShippingPartner().name !== "none";

/** The active partner. Every shipping call site goes through this. */
export const getShippingPartner = (): IShippingPartner => {
  if (!partner)
    throw new Error(
      "Shipping partner is not initialized — call initShippingPartner() at startup",
    );

  return partner;
};
