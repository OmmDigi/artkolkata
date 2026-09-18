import { PoolClient } from "pg";
import { pool } from "..";
import asyncErrorHandler from "../middleware/asyncErrorHandler";
import { CustomRequest } from "../types";
import { checkPermission } from "../utils/checkPermissions";
import { doTransition } from "../utils/doTransition";
import { doValidate } from "../utils/doValidate";
import { ErrorHandler } from "../utils/ErrorHandler";
import { httpResponse } from "../utils/httpResponse";
import {
  CACHE_TAGS,
  invalidateCache,
} from "../services/cache.service";
import { parsePagination } from "../utils/parsePagination";
import {
  VCreateBlog,
  VCreateBlogAuthor,
  VUpdateBlog,
  VUpdateBlogAuthor,
} from "../validator/blog.validator";

/**
 * A post is public only when it is published AND its publish moment has
 * arrived. There is nothing flipping a flag in the background: the clock is
 * read on every request, so a post dated for next Tuesday starts answering on
 * Tuesday by itself.
 *
 * A row written before published_at existed has none, and it was already live,
 * so an empty published_at counts as "now".
 */
const PUBLIC_GATE =
  "b.status = 'published' AND COALESCE(b.published_at, b.created_at) <= NOW()";

/**
 * The CMS must see drafts and scheduled posts, a shopper must not. Same test
 * cacheResponse uses to decide a request is privileged, so the two can never
 * disagree and cache an admin's view of the list for the public.
 */
const canSeeUnpublished = (req: CustomRequest) => {
  const tokenInfo = req.token_info;
  if (!tokenInfo) return false;
  if (tokenInfo.role && tokenInfo.role !== "User") return true;
  return checkPermission(tokenInfo.permissions ?? null, ["1-14"], "or");
};

// Media comes back as an ordered array on the post itself, so the CMS can hand
// it straight to MediaManager and the website can render a gallery without a
// second request.
const MEDIA_JSON = `
  COALESCE(
    (SELECT json_agg(
        json_build_object(
          'id', m.id,
          'image', m.image,
          'alt_tag', m.alt_tag,
          'type', m.type,
          'position', m.position
        ) ORDER BY m.position ASC, m.id ASC
      )
     FROM blog_media m WHERE m.blog_id = b.id),
    '[]'::json
  ) AS media`;

// The byline as the website prints it. Deliberately without the author's
// email: that is a contact detail the CMS keeps, not something to hand to
// every anonymous reader of a public post.
const AUTHOR_JSON = `
  CASE WHEN a.id IS NULL THEN NULL ELSE
    json_build_object(
      'id', a.id,
      'name', a.name,
      'designation', a.designation,
      'bio', a.bio,
      'image', a.image,
      'website_url', a.website_url
    )
  END AS author`;

/**
 * What the share card should actually say. The columns stay raw so the CMS
 * form edits exactly what is stored, and these resolved values sit beside them
 * for the website to print — an empty OG field falls back to the page's own
 * meta, then to the title and cover image, so a post nobody filled this in for
 * still shares correctly.
 */
const SEO_JSON = `
  json_build_object(
    'og_title', COALESCE(NULLIF(b.og_title, ''), NULLIF(b.meta_title, ''), b.title),
    'og_description', COALESCE(NULLIF(b.og_description, ''), NULLIF(b.meta_description, ''), NULLIF(b.excerpt, '')),
    'og_image', COALESCE(NULLIF(b.og_image, ''), NULLIF(b.cover_image, '')),
    'og_type', COALESCE(NULLIF(b.og_type, ''), 'article'),
    'canonical_url', NULLIF(b.canonical_url, ''),
    'twitter_card', COALESCE(NULLIF(b.twitter_card, ''), 'summary_large_image'),
    'twitter_title', COALESCE(NULLIF(b.twitter_title, ''), NULLIF(b.og_title, ''), NULLIF(b.meta_title, ''), b.title),
    'twitter_description', COALESCE(NULLIF(b.twitter_description, ''), NULLIF(b.og_description, ''), NULLIF(b.meta_description, ''), NULLIF(b.excerpt, '')),
    'twitter_image', COALESCE(NULLIF(b.twitter_image, ''), NULLIF(b.og_image, ''), NULLIF(b.cover_image, ''))
  ) AS seo`;

// "published" alone does not tell an admin whether the post is actually
// readable — a future published_at means it is still waiting.
const SCHEDULE_COLUMNS = `
  b.published_at,
  TO_CHAR(b.published_at AT TIME ZONE 'Asia/Kolkata', 'DD FMMonth YYYY, HH12:MI AM') AS published_at_label,
  (b.status = 'published' AND b.published_at IS NOT NULL AND b.published_at > NOW()) AS is_scheduled,
  (${PUBLIC_GATE}) AS is_live`;

// An empty string from the form is "not set", not a value worth storing.
const orNull = (value: unknown) =>
  value === undefined || value === null || value === "" ? null : value;

/**
 * The cover is the first image in the gallery. blogs.cover_image is written
 * from it on every save so the listing, the sitemap and the share card keep
 * reading one column while the admin only ever manages the gallery.
 */
const resolveCover = (
  media: { image: string; alt_tag?: string | null; type?: string }[],
  fallbackImage?: string | null,
  fallbackAlt?: string | null,
) => {
  const firstImage = media.find((item) => (item.type ?? "image") === "image");

  if (!firstImage) {
    return { cover_image: orNull(fallbackImage), cover_image_alt: orNull(fallbackAlt) };
  }

  return {
    cover_image: firstImage.image,
    cover_image_alt: orNull(firstImage.alt_tag ?? fallbackAlt),
  };
};

const replaceBlogMedia = async (
  client: PoolClient,
  blogId: number,
  media: { image: string; alt_tag?: string | null; type?: string }[],
) => {
  await client.query("DELETE FROM blog_media WHERE blog_id = $1", [blogId]);

  if (media.length === 0) return;

  await client.query(
    `INSERT INTO blog_media (blog_id, image, alt_tag, type, position)
     SELECT $1, item.image, NULLIF(item.alt_tag, ''), item.type, item.position
     FROM jsonb_to_recordset($2::jsonb)
       AS item(image TEXT, alt_tag TEXT, type TEXT, position INTEGER)`,
    [
      blogId,
      JSON.stringify(
        media.map((item, index) => ({
          image: item.image.trim(),
          alt_tag: item.alt_tag ?? null,
          type: item.type ?? "image",
          position: index,
        })),
      ),
    ],
  );
};

export const getBlogList = asyncErrorHandler(async (req: CustomRequest, res) => {
  const { TO_STRING } = parsePagination(req);

  let filter = "WHERE 1=1";
  const values: any[] = [];
  let placeholder = 1;

  if (req.query.status) {
    filter += ` AND b.status = $${placeholder++}`;
    values.push(req.query.status as string);
  }

  if (!canSeeUnpublished(req)) filter += ` AND ${PUBLIC_GATE}`;

  const { rows } = await pool.query(
    `SELECT
      b.id, b.title, b.slug, b.excerpt, b.cover_image, b.cover_image_alt,
      b.tags, b.status, b.meta_title, b.meta_description, b.author_id,
      b.blog_author_id,
      ${SCHEDULE_COLUMNS},
      ${AUTHOR_JSON},
      TO_CHAR(b.created_at AT TIME ZONE 'Asia/Kolkata', 'DD FMMonth YYYY') AS created_at,
      TO_CHAR(b.updated_at AT TIME ZONE 'Asia/Kolkata', 'DD FMMonth YYYY') AS updated_at
    FROM blogs b
    LEFT JOIN blog_authors a ON a.id = b.blog_author_id
    ${filter}
    ORDER BY COALESCE(b.published_at, b.created_at) DESC
    ${TO_STRING}`,
    values,
  );

  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) FROM blogs b ${filter}`,
    values,
  );

  const total = parseInt(countRows[0].count);
  const limit = 10;
  const totalPage = Math.ceil(total / limit);

  httpResponse(res, 200, "Blog list", rows, [], totalPage);
});

export const getSingleBlog = asyncErrorHandler(async (req: CustomRequest, res) => {
  const identifier = req.params.blog as string;
  const isId = /^\d+$/.test(identifier);

  const gate = canSeeUnpublished(req) ? "" : `AND ${PUBLIC_GATE}`;

  const { rows, rowCount } = await pool.query(
    `SELECT
      b.*,
      ${SCHEDULE_COLUMNS},
      ${MEDIA_JSON},
      ${AUTHOR_JSON},
      ${SEO_JSON}
    FROM blogs b
    LEFT JOIN blog_authors a ON a.id = b.blog_author_id
    WHERE b.${isId ? "id" : "slug"} = $1 ${gate}`,
    [identifier],
  );

  if (rowCount === 0) throw new ErrorHandler(404, "Blog post not found");

  httpResponse(res, 200, "Single blog post", rows[0]);
});

export const createBlog = asyncErrorHandler(async (req: CustomRequest, res) => {
  const value = doValidate(VCreateBlog, req.body ?? {});

  const media = value.media ?? [];
  const cover = resolveCover(media, value.cover_image, value.cover_image_alt);

  await doTransition(async (client) => {
    const { rows, rowCount } = await client.query(
      `INSERT INTO blogs
        (title, slug, excerpt, content_json, cover_image, cover_image_alt, tags,
         status, published_at, blog_author_id, meta_title, meta_description,
         og_title, og_description, og_image, og_type, canonical_url,
         twitter_card, twitter_title, twitter_description, twitter_image,
         author_id)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
         $17, $18, $19, $20, $21, $22)
      ON CONFLICT (slug) DO NOTHING
      RETURNING id`,
      [
        value.title,
        value.slug,
        orNull(value.excerpt),
        value.content_json,
        cover.cover_image,
        cover.cover_image_alt,
        orNull(value.tags),
        value.status,
        // published now unless a date was given, so a post published without
        // touching the schedule field behaves exactly as it did before
        orNull(value.published_at) ??
          (value.status === "published" ? new Date() : null),
        orNull(value.blog_author_id),
        orNull(value.meta_title),
        orNull(value.meta_description),
        orNull(value.og_title),
        orNull(value.og_description),
        orNull(value.og_image),
        orNull(value.og_type),
        orNull(value.canonical_url),
        orNull(value.twitter_card),
        orNull(value.twitter_title),
        orNull(value.twitter_description),
        orNull(value.twitter_image),
        req.token_info?.id ?? null,
      ],
    );

    if (rowCount === 0)
      throw new ErrorHandler(
        400,
        `Slug "${value.slug}" is already in use. Try a different slug.`,
      );

    await replaceBlogMedia(client, rows[0].id, media);
  });

  await invalidateCache(CACHE_TAGS.BLOGS);
  httpResponse(res, 201, "Blog post created successfully");
});

export const updateBlog = asyncErrorHandler(async (req, res) => {
  const value = doValidate(VUpdateBlog, { ...req.body, ...req.params });

  const media = value.media ?? [];
  const cover = resolveCover(media, value.cover_image, value.cover_image_alt);

  await doTransition(async (client) => {
    const { rowCount } = await client.query(
      `UPDATE blogs SET
        title = $1,
        slug = $2,
        excerpt = $3,
        content_json = $4,
        cover_image = $5,
        cover_image_alt = $6,
        tags = $7,
        status = $8,
        -- an explicit date wins; otherwise a post being published keeps the
        -- date it already had and only gets stamped the first time, so editing
        -- a live post never quietly moves its publish date
        published_at = CASE
          WHEN $9::timestamptz IS NOT NULL THEN $9::timestamptz
          WHEN $8 = 'published' THEN COALESCE(published_at, NOW())
          ELSE published_at
        END,
        blog_author_id = $10,
        meta_title = $11,
        meta_description = $12,
        og_title = $13,
        og_description = $14,
        og_image = $15,
        og_type = $16,
        canonical_url = $17,
        twitter_card = $18,
        twitter_title = $19,
        twitter_description = $20,
        twitter_image = $21,
        updated_at = NOW()
      WHERE id = $22`,
      [
        value.title,
        value.slug,
        orNull(value.excerpt),
        value.content_json,
        cover.cover_image,
        cover.cover_image_alt,
        orNull(value.tags),
        value.status,
        orNull(value.published_at),
        orNull(value.blog_author_id),
        orNull(value.meta_title),
        orNull(value.meta_description),
        orNull(value.og_title),
        orNull(value.og_description),
        orNull(value.og_image),
        orNull(value.og_type),
        orNull(value.canonical_url),
        orNull(value.twitter_card),
        orNull(value.twitter_title),
        orNull(value.twitter_description),
        orNull(value.twitter_image),
        value.id,
      ],
    );

    if (rowCount === 0) throw new ErrorHandler(404, "Blog post not found");

    await replaceBlogMedia(client, Number(value.id), media);
  });

  await invalidateCache(CACHE_TAGS.BLOGS);
  httpResponse(res, 200, "Blog post updated successfully");
});

export const deleteBlog = asyncErrorHandler(async (req, res) => {
  const { rowCount } = await pool.query("DELETE FROM blogs WHERE id = $1", [
    req.params.id,
  ]);

  if (rowCount === 0) throw new ErrorHandler(404, "Blog post not found");

  await invalidateCache(CACHE_TAGS.BLOGS);
  httpResponse(res, 200, "Blog post deleted successfully");
});

// blog authors
//
// The byline is a row of its own so the same person can be attached to many
// posts and edited in one place. The CMS creates them from inside the post
// form, the same way product tags are created from inside the product form.

// admin only, unlike the byline embedded in a post: this one carries the
// author's email
export const getBlogAuthorList = asyncErrorHandler(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, designation, bio, image, email, website_url
     FROM blog_authors
     ORDER BY name ASC`,
  );

  httpResponse(res, 200, "Blog author list", rows);
});

export const addBlogAuthor = asyncErrorHandler(async (req, res) => {
  const value = doValidate(VCreateBlogAuthor, req.body ?? {});

  const { rows, rowCount } = await pool.query(
    `INSERT INTO blog_authors (name, designation, bio, image, email, website_url)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT DO NOTHING
     RETURNING id, name, designation, bio, image, email, website_url`,
    [
      value.name,
      orNull(value.designation),
      orNull(value.bio),
      orNull(value.image),
      orNull(value.email),
      orNull(value.website_url),
    ],
  );

  // the unique index is on LOWER(name): a conflict means this author already
  // exists under some casing, and the CMS only wants one it can select
  if (rowCount === 0) {
    const { rows: existing } = await pool.query(
      `SELECT id, name, designation, bio, image, email, website_url
       FROM blog_authors WHERE LOWER(name) = LOWER($1)`,
      [value.name],
    );

    return httpResponse(res, 200, "Author already exists", existing[0]);
  }

  httpResponse(res, 201, "Author successfully created", rows[0]);
});

export const updateBlogAuthor = asyncErrorHandler(async (req, res) => {
  const value = doValidate(VUpdateBlogAuthor, { ...req.body, ...req.params });

  const { rowCount } = await pool.query(
    `UPDATE blog_authors SET
      name = $1, designation = $2, bio = $3, image = $4, email = $5, website_url = $6
     WHERE id = $7`,
    [
      value.name,
      orNull(value.designation),
      orNull(value.bio),
      orNull(value.image),
      orNull(value.email),
      orNull(value.website_url),
      value.id,
    ],
  );

  if (rowCount === 0) throw new ErrorHandler(404, "Author not found");

  // the byline is printed with every post that author wrote, so those
  // responses are stale the moment the author changes
  await invalidateCache(CACHE_TAGS.BLOGS);
  httpResponse(res, 200, "Author successfully updated");
});

export const deleteBlogAuthor = asyncErrorHandler(async (req, res) => {
  // blogs.blog_author_id is ON DELETE SET NULL, so the posts survive without a
  // byline rather than disappearing with the author
  const { rowCount } = await pool.query(
    "DELETE FROM blog_authors WHERE id = $1",
    [req.params.id],
  );

  if (rowCount === 0) throw new ErrorHandler(404, "Author not found");

  await invalidateCache(CACHE_TAGS.BLOGS);
  httpResponse(res, 200, "Author successfully removed");
});
