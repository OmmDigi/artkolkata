import { pool } from "..";
import asyncErrorHandler from "../middleware/asyncErrorHandler";
import { deleteFile } from "../utils/deleteFile";
import { doValidate } from "../utils/doValidate";
import { ErrorHandler } from "../utils/ErrorHandler";
import { httpResponse } from "../utils/httpResponse";
import {
  VCreateBanner,
  VReorderBanners,
  VSaveSiteInfo,
  VUpdateBanner,
} from "../validator/settings.validator";

// Order charges are no longer configurable. GST is a fixed 18% already inside
// every product price (see GST_PERCENTAGE) and delivery is never billed to the
// customer, so the gst_percentage / shipping_charge settings are gone along
// with the endpoints that edited them.

/* -------------------------------------------------------------------------- */
/*                                  Site info                                 */
/* -------------------------------------------------------------------------- */

const SITE_INFO_KEYS = [
  "site_logo",
  "site_logo_alt",
  "contact_emails",
  "contact_phones",
  "site_addresses",
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

export interface ISiteInfo {
  site_logo: string;
  site_logo_alt: string;
  contact_emails: IContactEntry[];
  contact_phones: IContactEntry[];
  site_addresses: IAddressEntry[];
}

const SITE_INFO_DEFAULTS: ISiteInfo = {
  site_logo: "",
  site_logo_alt: "",
  contact_emails: [],
  contact_phones: [],
  site_addresses: [],
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
  };
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

  httpResponse(res, 200, "Banner order has been updated");
});
