import path from "path";
import fs from "fs";
import { pool } from "..";
// type-only: importing the settings controller for real would close a require
// cycle (controller -> index -> routes -> controller) and leave the settings
// routes holding undefined handlers. The shapes are still its to define.
import type {
  IAddressEntry,
  IContactEntry,
} from "../controllers/settings.controller";
import logger from "./logger";

// The header block printed on every generated document. The parts the store
// owner maintains — logo, phone, email, address — are read from Site Info in
// the CMS, so changing them there changes the next invoice. Only the two things
// Site Info has no field for stay in the environment: the registered company
// name and the GST number, which are legal identity rather than contact
// details and should not be editable from a settings page.
//
// Every Site Info value falls back to its COMPANY_* env var, so a store that
// has not filled the settings page in still prints a correct letterhead.
export interface IPdfImage {
  data: Buffer;
  format: "png" | "jpg";
}

export interface ICompanyInfo {
  name: string;
  // already filtered: blank values never reach the PDF
  addressLines: string[];
  gst: string | null;
  phone: string | null;
  email: string | null;
  // decoded bytes rather than a url — see loadLogo
  logo: IPdfImage | null;
}

const clean = (value?: string | null) => {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
};

// Site Info holds several phones and emails; the one flagged primary is the one
// the store answers on, and the first entry is the sensible stand-in when
// nobody flagged one.
const pickContact = (entries: IContactEntry[]): string | null => {
  const primary = entries.find((entry) => entry.is_primary) ?? entries[0];
  return clean(primary?.value);
};

const pickAddress = (entries: IAddressEntry[]): IAddressEntry | null =>
  entries.find((entry) => entry.is_primary) ?? entries[0] ?? null;

const addressToLines = (address: IAddressEntry): string[] =>
  [
    clean(address.line1),
    clean(address.line2),
    [clean(address.city), clean(address.pincode)].filter(Boolean).join(" ") ||
      null,
    [clean(address.state), clean(address.country)].filter(Boolean).join(", ") ||
      null,
  ].filter((line): line is string => Boolean(line));

const envAddressLines = (): string[] =>
  [
    clean(process.env.COMPANY_ADDRESS_LINE1),
    clean(process.env.COMPANY_ADDRESS_LINE2),
    [clean(process.env.COMPANY_CITY), clean(process.env.COMPANY_PINCODE)]
      .filter(Boolean)
      .join(" ") || null,
    [clean(process.env.COMPANY_STATE), clean(process.env.COMPANY_COUNTRY)]
      .filter(Boolean)
      .join(", ") || null,
  ].filter((line): line is string => Boolean(line));

/* -------------------------------------------------------------------------- */
/*                                    Logo                                    */
/* -------------------------------------------------------------------------- */

// react-pdf draws PNG and JPEG and nothing else. The site logo is whatever the
// admin uploaded — usually webp, which the upload server also produces for its
// responsive variants — so the bytes are sniffed here and a webp is swapped for
// the png the upload server renders on request. Doing it by magic number rather
// than by file extension means a mislabelled file is still handled correctly.
const sniffFormat = (bytes: Buffer): "png" | "jpg" | null => {
  if (bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return "png";
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8) return "jpg";
  return null;
};

// One logo, fetched over the network on every generate, would be a pointless
// round trip — it changes when the admin changes it, which is close to never.
// Keyed by source so changing the logo in the CMS picks up the new file.
const logoCache = new Map<string, IPdfImage>();

const uploadBase = () => (process.env.UPLOAD_LOCAL_BASE_API ?? "").replace(/\/+$/, "");

const readBytes = async (source: string): Promise<Buffer> => {
  if (/^https?:\/\//i.test(source)) {
    const response = await fetch(source);
    if (!response.ok)
      throw new Error(`${response.status} while reading ${source}`);
    return Buffer.from(await response.arrayBuffer());
  }

  return fs.promises.readFile(source);
};

/**
 * Resolves the configured logo to drawable bytes.
 *
 * `source` is either a path stored by Site Info (`/uploads/site/logo.webp`), an
 * absolute url, or a file shipped in the api's own public folder. Anything that
 * is not already a PNG or a JPEG is re-requested from the upload server's png
 * route, which converts it with the sharp it already runs for image variants —
 * nothing is decoded in the api.
 *
 * Never throws: a letterhead without a logo prints the company name instead,
 * and an invoice is not worth failing over a picture.
 */
const loadLogo = async (source: string): Promise<IPdfImage | null> => {
  // COMPANY_LOGO_BG is part of the key: changing it must not serve the logo
  // that was cached against the old colour.
  const background = clean(process.env.COMPANY_LOGO_BG)?.replace(/^#/, "") ?? null;
  const cacheKey = `${source}|${background ?? ""}`;

  const cached = logoCache.get(cacheKey);
  if (cached) return cached;

  try {
    const isRemotePath = source.startsWith("/") && !fs.existsSync(source);

    const target = /^https?:\/\//i.test(source)
      ? source
      : isRemotePath
        ? `${uploadBase()}${source}`
        : path.resolve(__dirname, "../../public", source.replace(/^\/+/, ""));

    // A background can only be painted in by the converter, so asking for one
    // skips the straight read even when the source is already a png.
    let bytes = background ? Buffer.alloc(0) : await readBytes(target);
    let format = sniffFormat(bytes);

    if (!format) {
      // e.g. /uploads/site/logo.webp -> {upload}/api/v1/view/png/site/logo.webp
      const storedPath = source.replace(/^https?:\/\/[^/]+/i, "");
      const withoutFolder = storedPath.replace(/^\/*uploads\//, "");

      bytes = await readBytes(
        `${uploadBase()}/api/v1/view/png/${withoutFolder}${
          background ? `?bg=${background}` : ""
        }`,
      );
      format = sniffFormat(bytes);
    }

    if (!format) throw new Error("logo is not a png or jpeg after conversion");

    const image: IPdfImage = { data: bytes, format };
    logoCache.set(cacheKey, image);
    return image;
  } catch (error) {
    logger.warn("Could not load the company logo for a generated document", {
      source,
      error: error instanceof Error ? error.message : error,
    });
    return null;
  }
};

/* -------------------------------------------------------------------------- */

interface ILetterheadSettings {
  site_logo: string;
  contact_phones: IContactEntry[];
  contact_emails: IContactEntry[];
  site_addresses: IAddressEntry[];
}

// Site Info values are stored as JSON text, and a legacy or hand-edited row
// must not be able to take a generate down — a bad value reads as absent and
// the env fallback takes over.
const parseSetting = <T>(raw: string | undefined, fallback: T): T => {
  if (raw === undefined || raw === null || raw === "") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

// The four letterhead keys out of the Site Info the CMS maintains. Read here
// rather than through settings.controller's fetchSiteInfoFromDb for the reason
// given on the import above.
const fetchLetterheadSettings = async (): Promise<ILetterheadSettings> => {
  const { rows } = await pool.query<{ key: string; value: string }>(
    `SELECT key, value FROM store_settings
     WHERE key = ANY($1)`,
    [["site_logo", "contact_phones", "contact_emails", "site_addresses"]],
  );

  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;

  return {
    site_logo: parseSetting(map["site_logo"], ""),
    contact_phones: parseSetting(map["contact_phones"], [] as IContactEntry[]),
    contact_emails: parseSetting(map["contact_emails"], [] as IContactEntry[]),
    site_addresses: parseSetting(map["site_addresses"], [] as IAddressEntry[]),
  };
};

export const getCompanyInfo = async (): Promise<ICompanyInfo> => {
  // A generate is an admin action a few times a day, so this reads the settings
  // straight from the db rather than through a cache — the document should show
  // what the CMS shows right now.
  const siteInfo = await fetchLetterheadSettings().catch((error) => {
    logger.warn("Falling back to COMPANY_* env values for a document header", {
      error: error instanceof Error ? error.message : error,
    });
    return null;
  });

  const address = pickAddress(siteInfo?.site_addresses ?? []);

  const addressLines = address ? addressToLines(address) : [];

  const logoSource =
    clean(siteInfo?.site_logo) ?? clean(process.env.COMPANY_LOGO_URL);

  return {
    name: clean(process.env.COMPANY_NAME) ?? "",
    addressLines: addressLines.length > 0 ? addressLines : envAddressLines(),
    gst: clean(process.env.COMPANY_GST),
    phone:
      pickContact(siteInfo?.contact_phones ?? []) ??
      clean(process.env.COMPANY_PHONE),
    email:
      pickContact(siteInfo?.contact_emails ?? []) ??
      clean(process.env.COMPANY_EMAIL),
    logo: logoSource ? await loadLogo(logoSource) : null,
  };
};
