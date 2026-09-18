import { pool } from "..";
import asyncErrorHandler from "../middleware/asyncErrorHandler";
import { CustomRequest } from "../types";
import { checkPermission } from "../utils/checkPermissions";
import { deleteFile } from "../utils/deleteFile";
import { doValidate } from "../utils/doValidate";
import { ErrorHandler } from "../utils/ErrorHandler";
import { httpResponse } from "../utils/httpResponse";
import {
  CACHE_TAGS,
  invalidateCache,
} from "../services/cache.service";
import { toIst } from "../utils/toIst";
import {
  VCreateBanner,
  VCreateShippingRule,
  VReorderBanners,
  VSaveSiteInfo,
  VUpdateBanner,
  VUpdateShippingRule,
} from "../validator/settings.validator";

// GST is not configurable: it is a fixed rate already inside every product
// price (see GST_PERCENTAGE), so there is no setting for it. Delivery is
// configurable again — see the shipping charge rules at the bottom of this file.

/* -------------------------------------------------------------------------- */
/*                                  Site info                                 */
/* -------------------------------------------------------------------------- */

const SITE_INFO_KEYS = [
  "site_logo",
  "site_logo_alt",
  "contact_emails",
  "contact_phones",
  "site_addresses",
  "ribbon_section",
  "payment_methods",
  "guest_checkout",
] as const;
type SiteInfoKey = (typeof SITE_INFO_KEYS)[number];

export interface IContactEntry {
  label: string;
  value: string;
  is_primary: boolean;
}

export interface IAddressEntry {
  label: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  map_url: string;
  is_primary: boolean;
}

// short promo strip shown across the storefront, the link is optional and
// stays null when the CMS leaves it empty
export interface IRibbonSection {
  text: string;
  link: string | null;
}

// Which checkout payment methods the store owner wants offered. Both default
// to on, and the validator refuses to save them both off — a storefront with
// no way to pay is never a state the CMS can produce.
export interface IPaymentMethodSettings {
  cod_enabled: boolean;
  online_enabled: boolean;
}

/**
 * Whether checkout takes an order from someone who is not logged in.
 *
 * Off is the pre-guest-checkout behaviour: the storefront sends the customer to
 * log in first. On is the default, because a store that has just been upgraded
 * should not silently lose a feature it was given.
 */
export interface IGuestCheckoutSettings {
  enabled: boolean;
}

export interface ISiteInfo {
  site_logo: string;
  site_logo_alt: string;
  contact_emails: IContactEntry[];
  contact_phones: IContactEntry[];
  site_addresses: IAddressEntry[];
  ribbon_section: IRibbonSection;
  payment_methods: IPaymentMethodSettings;
  guest_checkout: IGuestCheckoutSettings;
}

const SITE_INFO_DEFAULTS: ISiteInfo = {
  site_logo: "",
  site_logo_alt: "",
  contact_emails: [],
  contact_phones: [],
  site_addresses: [],
  ribbon_section: { text: "", link: null },
  payment_methods: { cod_enabled: true, online_enabled: true },
  guest_checkout: { enabled: true },
};

// values are stored as JSON text so a bad/legacy row never takes the endpoint down
const parseSetting = <T>(raw: string | undefined, fallback: T): T => {
  if (raw === undefined || raw === null || raw === "") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const getSiteInfo = asyncErrorHandler(async (_req, res) => {
  httpResponse(res, 200, "Site info", await fetchSiteInfoFromDb());
});

export const saveSiteInfo = asyncErrorHandler(async (req, res) => {
  const value = doValidate<ISiteInfo>(VSaveSiteInfo, req.body ?? {});

  const entries: [SiteInfoKey, string][] = SITE_INFO_KEYS.map((key) => [
    key,
    JSON.stringify(value[key] ?? SITE_INFO_DEFAULTS[key]),
  ]);

  await Promise.all(
    entries.map(([key, val]) =>
      pool.query(
        `INSERT INTO store_settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, val],
      ),
    ),
  );

  await invalidateCache(CACHE_TAGS.SITE_INFO);
  httpResponse(res, 200, "Site info saved successfully");
});

export async function fetchSiteInfoFromDb(): Promise<ISiteInfo> {
  const { rows } = await pool.query<{ key: string; value: string }>(
    `SELECT key, value FROM store_settings WHERE key = ANY($1)`,
    [SITE_INFO_KEYS],
  );

  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;

  return {
    site_logo: parseSetting(map["site_logo"], SITE_INFO_DEFAULTS.site_logo),
    site_logo_alt: parseSetting(
      map["site_logo_alt"],
      SITE_INFO_DEFAULTS.site_logo_alt,
    ),
    contact_emails: parseSetting(map["contact_emails"], [] as IContactEntry[]),
    contact_phones: parseSetting(map["contact_phones"], [] as IContactEntry[]),
    site_addresses: parseSetting(map["site_addresses"], [] as IAddressEntry[]),
    ribbon_section: parseSetting(
      map["ribbon_section"],
      SITE_INFO_DEFAULTS.ribbon_section,
    ),
    payment_methods: parseSetting(
      map["payment_methods"],
      SITE_INFO_DEFAULTS.payment_methods,
    ),
    guest_checkout: parseSetting(
      map["guest_checkout"],
      SITE_INFO_DEFAULTS.guest_checkout,
    ),
  };
}

/**
 * The checkout-side read of the same setting. Nothing trusts the browser here:
 * the storefront hides a disabled method, this is what makes hiding it more
 * than a suggestion.
 */
export async function fetchPaymentMethodSettings(): Promise<IPaymentMethodSettings> {
  const { rows } = await pool.query<{ value: string }>(
    `SELECT value FROM store_settings WHERE key = 'payment_methods'`,
  );

  return parseSetting(rows[0]?.value, SITE_INFO_DEFAULTS.payment_methods);
}

/** Throws when the customer picked a method the store has switched off. */
export async function assertPaymentMethodEnabled(
  paymentMethod: "ONLINE" | "COD",
): Promise<void> {
  const methods = await fetchPaymentMethodSettings();

  const enabled =
    paymentMethod === "COD" ? methods.cod_enabled : methods.online_enabled;

  if (!enabled) {
    throw new ErrorHandler(
      400,
      paymentMethod === "COD"
        ? "Cash on delivery is currently unavailable"
        : "Online payment is currently unavailable",
    );
  }
}

/**
 * The checkout-side read of the guest setting, the same shape as the payment
 * one above. The storefront hides the guest option when this is off; this is
 * what makes hiding it more than a suggestion.
 */
export async function fetchGuestCheckoutSettings(): Promise<IGuestCheckoutSettings> {
  const { rows } = await pool.query<{ value: string }>(
    `SELECT value FROM store_settings WHERE key = 'guest_checkout'`,
  );

  return parseSetting(rows[0]?.value, SITE_INFO_DEFAULTS.guest_checkout);
}

/** Throws when an order arrives without a session and the store wants accounts. */
export async function assertGuestCheckoutEnabled(): Promise<void> {
  const { enabled } = await fetchGuestCheckoutSettings();

  if (!enabled) {
    throw new ErrorHandler(
      401,
      "Please log in to place your order",
      // Same key the existing-account conflict uses, because the storefront
      // does the same thing with both: show the login step.
      ["ACCOUNT_EXISTS"],
    );
  }
}

/* -------------------------------------------------------------------------- */
/*                                   Banners                                  */
/* -------------------------------------------------------------------------- */

export interface IBanner {
  id: number;
  image_url: string;
  // device specific artwork, both optional : image_url is used when they are empty
  mobile_image_url: string | null;
  tablet_image_url: string | null;
  alt_text: string | null;
  link_url: string | null;
  position: number;
  is_active: boolean;
}

export const getBanners = asyncErrorHandler(async (req, res) => {
  // the storefront asks for ?active=true, the CMS lists everything
  const onlyActive = req.query.active === "true";

  const { rows } = await pool.query<IBanner>(
    `SELECT id, image_url, mobile_image_url, tablet_image_url,
            alt_text, link_url, position, is_active
     FROM site_banners
     ${onlyActive ? "WHERE is_active = TRUE" : ""}
     ORDER BY position ASC, id ASC`,
  );

  httpResponse(res, 200, "Banner list", rows);
});

export const createBanner = asyncErrorHandler(async (req, res) => {
  const value = doValidate<Omit<IBanner, "id">>(VCreateBanner, req.body ?? {});

  const { rows } = await pool.query<IBanner>(
    `INSERT INTO site_banners (image_url, mobile_image_url, tablet_image_url, alt_text, link_url, position, is_active)
     VALUES ($1, $2, $3, $4, $5, COALESCE(NULLIF($6::int, 0), (SELECT COALESCE(MAX(position), 0) + 1 FROM site_banners)), $7)
     RETURNING id, image_url, mobile_image_url, tablet_image_url, alt_text, link_url, position, is_active`,
    [
      value.image_url,
      value.mobile_image_url || null,
      value.tablet_image_url || null,
      value.alt_text || null,
      value.link_url || null,
      value.position,
      value.is_active,
    ],
  );

  await invalidateCache(CACHE_TAGS.BANNERS);
  httpResponse(res, 201, "Banner has been added", rows[0]);
});

export const updateBanner = asyncErrorHandler(async (req, res) => {
  const value = doValidate<IBanner>(VUpdateBanner, {
    ...req.body,
    id: Number(req.params.banner_id),
  });

  const nextMobile = value.mobile_image_url || null;
  const nextTablet = value.tablet_image_url || null;

  // the CTE reads the pre-update snapshot, so it hands back the images we replaced
  const { rowCount, rows } = await pool.query<{
    previous_image: string | null;
    previous_mobile_image: string | null;
    previous_tablet_image: string | null;
  }>(
    `WITH previous AS (
       SELECT image_url, mobile_image_url, tablet_image_url
       FROM site_banners WHERE id = $8
     )
     UPDATE site_banners
     SET image_url = $1, mobile_image_url = $2, tablet_image_url = $3,
         alt_text = $4, link_url = $5, position = $6,
         is_active = $7, updated_at = NOW()
     WHERE id = $8
     RETURNING (SELECT image_url FROM previous) AS previous_image,
               (SELECT mobile_image_url FROM previous) AS previous_mobile_image,
               (SELECT tablet_image_url FROM previous) AS previous_tablet_image`,
    [
      value.image_url,
      nextMobile,
      nextTablet,
      value.alt_text || null,
      value.link_url || null,
      value.position,
      value.is_active,
      value.id,
    ],
  );

  if (rowCount === 0) throw new ErrorHandler(404, "No banner found with this id");

  // drop the old files from the upload server when an image was swapped out or cleared
  const replaced: [string | null | undefined, string | null][] = [
    [rows[0]?.previous_image, value.image_url],
    [rows[0]?.previous_mobile_image, nextMobile],
    [rows[0]?.previous_tablet_image, nextTablet],
  ];

  for (const [previous, next] of replaced) {
    if (previous && previous !== next) deleteFile(previous);
  }

  await invalidateCache(CACHE_TAGS.BANNERS);
  httpResponse(res, 200, "Banner has been updated");
});

export const deleteBanner = asyncErrorHandler(async (req, res) => {
  const bannerId = Number(req.params.banner_id);
  if (!Number.isInteger(bannerId)) throw new ErrorHandler(400, "Invalid banner id");

  const { rowCount, rows } = await pool.query<{
    image_url: string;
    mobile_image_url: string | null;
    tablet_image_url: string | null;
  }>(
    `DELETE FROM site_banners WHERE id = $1
     RETURNING image_url, mobile_image_url, tablet_image_url`,
    [bannerId],
  );

  if (rowCount === 0) throw new ErrorHandler(404, "No banner found with this id");

  for (const url of [
    rows[0].image_url,
    rows[0].mobile_image_url,
    rows[0].tablet_image_url,
  ]) {
    if (url) deleteFile(url);
  }

  await invalidateCache(CACHE_TAGS.BANNERS);
  httpResponse(res, 200, "Banner has been deleted");
});

export const reorderBanners = asyncErrorHandler(async (req, res) => {
  const value = doValidate<{ banners: { id: number; position: number }[] }>(
    VReorderBanners,
    req.body ?? {},
  );

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const banner of value.banners) {
      await client.query(
        `UPDATE site_banners SET position = $1, updated_at = NOW() WHERE id = $2`,
        [banner.position, banner.id],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  await invalidateCache(CACHE_TAGS.BANNERS);
  httpResponse(res, 200, "Banner order has been updated");
});

/* -------------------------------------------------------------------------- */
/*                           Shipping charge rules                            */
/* -------------------------------------------------------------------------- */

// Slabs that decide what delivery costs. calculateShippingCharge is what reads
// them at checkout; everything here is the CMS editing side.
//
// min_order_amount is inclusive and max_order_amount is exclusive, so the usual
// setup is one row (0 → 1000, flat ₹99) and one row (1000 → ∞, free) with no
// gap between them. An empty table means delivery is free.

const emptyToNull = (value?: number | string | null) =>
  value === "" || value === null || value === undefined ? null : value;

const toIstOrNull = (dateString?: string | null) =>
  dateString ? toIst(dateString) : null;

export const getShippingRules = asyncErrorHandler(
  async (req: CustomRequest, res) => {
    // the storefront only sees what is live right now, the CMS sees everything
    const isAdmin = checkPermission(req.token_info?.permissions ?? null, [
      "1-13",
    ]);

    const { rows } = await pool.query(
      `
      SELECT
        *,
        TO_CHAR(starts_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI') AS starts_at,
        TO_CHAR(ends_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI') AS ends_at
      FROM shipping_charge_rules
      ${
        isAdmin
          ? ""
          : `WHERE status = 'active'
               AND (starts_at IS NULL OR starts_at <= NOW())
               AND (ends_at IS NULL OR ends_at >= NOW())`
      }
      ORDER BY priority DESC, min_order_amount ASC, id ASC
      `,
    );

    httpResponse(res, 200, "Shipping charge rules", rows);
  },
);

export const getSingleShippingRule = asyncErrorHandler(async (req, res) => {
  const { rows, rowCount } = await pool.query(
    `
    SELECT
      *,
      TO_CHAR(starts_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI') AS starts_at,
      TO_CHAR(ends_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI') AS ends_at
    FROM shipping_charge_rules
    WHERE id = $1
    `,
    [req.params.id],
  );

  if (rowCount === 0) throw new ErrorHandler(404, "No shipping rule found");

  httpResponse(res, 200, "Single shipping charge rule", rows[0]);
});

export const createShippingRule = asyncErrorHandler(async (req, res) => {
  const value = doValidate<any>(VCreateShippingRule, req.body ?? {});

  const { rows } = await pool.query(
    `
    INSERT INTO shipping_charge_rules
      (title, min_order_amount, max_order_amount, type, value, max_charge_amount,
       payment_method, status, priority, starts_at, ends_at)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING id
    `,
    [
      value.title,
      value.min_order_amount,
      emptyToNull(value.max_order_amount),
      value.type,
      value.value,
      emptyToNull(value.max_charge_amount),
      value.payment_method,
      value.status,
      value.priority,
      toIstOrNull(value.starts_at),
      toIstOrNull(value.ends_at),
    ],
  );

  await invalidateCache(CACHE_TAGS.SHIPPING_RULES);
  httpResponse(res, 201, "New shipping rule has been created", rows[0]);
});

export const updateShippingRule = asyncErrorHandler(async (req, res) => {
  const value = doValidate<any>(VUpdateShippingRule, {
    ...req.body,
    ...req.params,
  });

  const { rowCount } = await pool.query(
    `
    UPDATE shipping_charge_rules SET
      title = $1,
      min_order_amount = $2,
      max_order_amount = $3,
      type = $4,
      value = $5,
      max_charge_amount = $6,
      payment_method = $7,
      status = $8,
      priority = $9,
      starts_at = $10,
      ends_at = $11,
      updated_at = NOW()
    WHERE id = $12
    `,
    [
      value.title,
      value.min_order_amount,
      emptyToNull(value.max_order_amount),
      value.type,
      value.value,
      emptyToNull(value.max_charge_amount),
      value.payment_method,
      value.status,
      value.priority,
      toIstOrNull(value.starts_at),
      toIstOrNull(value.ends_at),
      value.id,
    ],
  );

  if (rowCount === 0) throw new ErrorHandler(404, "No shipping rule found");

  await invalidateCache(CACHE_TAGS.SHIPPING_RULES);
  httpResponse(res, 200, "Shipping rule has been updated");
});

export const deleteShippingRule = asyncErrorHandler(async (req, res) => {
  const { rowCount } = await pool.query(
    "DELETE FROM shipping_charge_rules WHERE id = $1",
    [req.params.id],
  );

  if (rowCount === 0) throw new ErrorHandler(404, "No shipping rule found");

  await invalidateCache(CACHE_TAGS.SHIPPING_RULES);
  httpResponse(res, 200, "Shipping rule has been removed");
});
