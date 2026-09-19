import { pool } from "..";
import asyncErrorHandler from "../middleware/asyncErrorHandler";
import { CustomRequest } from "../types";
import { checkPermission } from "../utils/checkPermissions";
import { doValidate } from "../utils/doValidate";
import { ErrorHandler } from "../utils/ErrorHandler";
import { httpResponse } from "../utils/httpResponse";
import { CACHE_TAGS, invalidateCache } from "../services/cache.service";
import { VUpdateSitePage } from "../validator/page.validator";

/**
 * The store's legal pages: terms, privacy, returns and refunds.
 *
 * The set is fixed. The rows are seeded by database.sql and there is no create
 * or delete endpoint, so every slug the storefront links to in its footer is a
 * row that exists — an admin can empty a page, but never remove it.
 */
export const SITE_PAGE_SLUGS = [
  "terms-and-conditions",
  "privacy-policy",
  "return-and-refund-policy",
] as const;

export type TSitePageSlug = (typeof SITE_PAGE_SLUGS)[number];

/**
 * A page is public only when it is published. Draft is the state a long legal
 * document sits in while it is being rewritten — the CMS still sees it, a
 * shopper gets a 404 instead of half a policy.
 */
const PUBLIC_GATE = "status = 'published'";

/**
 * The CMS must see drafts, a shopper must not. Same test cacheResponse uses to
 * decide a request is privileged, so the two can never disagree and cache an
 * admin's view of a draft for the public.
 */
const canSeeUnpublished = (req: CustomRequest) => {
  const tokenInfo = req.token_info;
  if (!tokenInfo) return false;
  if (tokenInfo.role && tokenInfo.role !== "User") return true;
  return checkPermission(tokenInfo.permissions ?? null, ["1-13"], "or");
};

// An empty string from the form is "not set", not a value worth storing.
const orNull = (value: unknown) =>
  value === undefined || value === null || value === "" ? null : value;

/**
 * What every read returns. meta_title falls back to the page title so a page
 * nobody filled the SEO fields in for still has a usable <title>.
 */
const PAGE_COLUMNS = `
  id,
  slug,
  title,
  content_json,
  meta_title,
  meta_description,
  status,
  COALESCE(NULLIF(meta_title, ''), title) AS resolved_meta_title,
  updated_at,
  TO_CHAR(updated_at AT TIME ZONE 'Asia/Kolkata', 'DD FMMonth YYYY, HH12:MI AM') AS updated_at_label`;

/**
 * The whole set in one call — the CMS settings tab renders every page from
 * this, and the storefront footer can build its links from it without three
 * requests.
 */
export const getSitePageList = asyncErrorHandler(
  async (req: CustomRequest, res) => {
    const filter = canSeeUnpublished(req) ? "" : `WHERE ${PUBLIC_GATE}`;

    const { rows } = await pool.query(
      `SELECT ${PAGE_COLUMNS} FROM site_pages ${filter} ORDER BY id ASC`,
    );

    httpResponse(res, 200, "Site pages", rows);
  },
);

export const getSitePage = asyncErrorHandler(async (req: CustomRequest, res) => {
  const slug = req.params.slug;

  const filter = canSeeUnpublished(req) ? "" : `AND ${PUBLIC_GATE}`;

  const { rows } = await pool.query(
    `SELECT ${PAGE_COLUMNS} FROM site_pages WHERE slug = $1 ${filter}`,
    [slug],
  );

  if (rows.length === 0) throw new ErrorHandler(404, "Page not found");

  httpResponse(res, 200, "Site page", rows[0]);
});

/**
 * Edits the content of a page that already exists. An unknown slug is a 404
 * and never an insert: the set of pages is decided by the schema, not by
 * whatever a request asks for.
 */
export const updateSitePage = asyncErrorHandler(async (req, res) => {
  const slug = req.params.slug;

  const value = doValidate(VUpdateSitePage, req.body ?? {});

  const { rows } = await pool.query(
    `UPDATE site_pages
       SET content_json = $1,
           meta_title = $2,
           meta_description = $3,
           status = $4,
           updated_at = NOW()
     WHERE slug = $5
     RETURNING ${PAGE_COLUMNS}`,
    [
      value.content_json ? JSON.stringify(value.content_json) : null,
      orNull(value.meta_title),
      orNull(value.meta_description),
      value.status,
      slug,
    ],
  );

  if (rows.length === 0) throw new ErrorHandler(404, "Page not found");

  await invalidateCache(CACHE_TAGS.SITE_PAGES);

  httpResponse(res, 200, "Page saved successfully", rows[0]);
});
