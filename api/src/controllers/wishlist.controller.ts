import { pool } from "..";
import { REVIEW_STATUS_APPROVED } from "../constant";
import asyncErrorHandler from "../middleware/asyncErrorHandler";
import { getProductsVariants } from "../services/product.service";
import {
  MAX_PRICE_EXPR,
  MIN_PRICE_EXPR,
  PRODUCT_PRICE_JOIN,
} from "../services/productFilter.service";
import { CustomRequest } from "../types";
import { doValidate } from "../utils/doValidate";
import { ErrorHandler } from "../utils/ErrorHandler";
import { httpResponse } from "../utils/httpResponse";
import { parsePagination } from "../utils/parsePagination";
import {
  VAddToWishlist,
  VMergeWishlist,
} from "../validator/wishlist.validator";

// a product pulled out of a private state should not keep showing up in the wishlist
const PUBLIC_PRODUCT_STATUS = 1;

/**
 * The wishlist rows as the storefront reads them : public products only, newest
 * first. `limitClause` is the pagination tail, empty for "everything", and
 * `withVariants` attaches each product's variants the way the product cards
 * expect them.
 */
const readWishlist = async (
  userId: number | undefined,
  { limitClause = "", withVariants = false } = {},
) => {
  const { rows } = await pool.query(
    `
      SELECT
        p.id,
        p.sku_id,
        p.name,
        p.category_id,
        p.price,
        p.compare_at_price,
        p.status,
        p.slug,
        p.position,
        p.tags,
        w.id AS wishlist_id,
        w.created_at AS added_at,
        c.slug AS category_slug,
        c.name AS category_name,
        ${MIN_PRICE_EXPR} AS min_price,
        ${MAX_PRICE_EXPR} AS max_price,
        COALESCE(JSON_AGG(pi ORDER BY pi.position ASC) FILTER (WHERE pi.id IS NOT NULL), '[]'::json) AS images,
        COALESCE(AVG(r.stars), 0.0) AS rating,
        COUNT(DISTINCT r.id) AS total_ratings
      FROM wishlist w

      INNER JOIN products p
      ON p.id = w.product_id

      LEFT JOIN product_images pi
      ON pi.product_id = p.id

      LEFT JOIN categories c
      ON c.id = p.category_id

      LEFT JOIN reviews r
      ON r.product_id = p.id AND r.status = ${REVIEW_STATUS_APPROVED}

      ${PRODUCT_PRICE_JOIN}

      WHERE w.user_id = $1 AND p.status = ${PUBLIC_PRODUCT_STATUS}

      GROUP BY w.id, p.id, c.id, vp.min_price, vp.max_price

      ORDER BY w.created_at DESC, w.id DESC

      ${limitClause}
      `,
    [userId],
  );

  if (withVariants) {
    const variantsByProduct = await getProductsVariants(
      rows.map((row) => row.id),
    );

    rows.forEach((row) => {
      row.variants = variantsByProduct[row.id] ?? [];
    });
  }

  return rows;
};

export const getWishlist = asyncErrorHandler(
  async (req: CustomRequest, res) => {
    const { TO_STRING } = parsePagination(req);
    const userId = req.token_info?.id;

    const rows = await readWishlist(userId, {
      limitClause: TO_STRING,
      withVariants: req.query.variants === "true",
    });

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) FROM wishlist w
       INNER JOIN products p ON p.id = w.product_id
       WHERE w.user_id = $1 AND p.status = ${PUBLIC_PRODUCT_STATUS}`,
      [userId],
    );

    const total = parseInt(countRows[0].count);
    const limit = parseInt(req.query.limit?.toString() || "10");
    const totalPage = limit > 0 ? Math.ceil(total / limit) : 0;

    httpResponse(res, 200, "Wishlist", rows, [], totalPage);
  },
);

// the website only needs the ids to paint the wishlist icon on a product card
export const getWishlistProductIds = asyncErrorHandler(
  async (req: CustomRequest, res) => {
    const { rows } = await pool.query(
      `SELECT product_id FROM wishlist WHERE user_id = $1`,
      [req.token_info?.id],
    );

    httpResponse(
      res,
      200,
      "Wishlist product ids",
      rows.map((row) => row.product_id),
    );
  },
);

export const addToWishlist = asyncErrorHandler(
  async (req: CustomRequest, res) => {
    const value = doValidate(VAddToWishlist, req.body ?? {});
    const userId = req.token_info?.id;

    const { rowCount: productCount } = await pool.query(
      `SELECT id FROM products WHERE id = $1`,
      [value.product_id],
    );

    if (productCount === 0) throw new ErrorHandler(404, "Product not found");

    // the pair is unique, so a second add for the same product is silently ignored
    const { rowCount } = await pool.query(
      `INSERT INTO wishlist (user_id, product_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, product_id) DO NOTHING`,
      [userId, value.product_id],
    );

    httpResponse(
      res,
      200,
      rowCount === 0 ? "Product is already in the wishlist" : "Added to wishlist",
    );
  },
);

export const removeFromWishlist = asyncErrorHandler(
  async (req: CustomRequest, res) => {
    const productId = parseInt(req.params.product_id?.toString() ?? "");

    if (isNaN(productId)) throw new ErrorHandler(400, "Invalid product id");

    await pool.query(
      `DELETE FROM wishlist WHERE user_id = $1 AND product_id = $2`,
      [req.token_info?.id, productId],
    );

    httpResponse(res, 200, "Removed from wishlist");
  },
);

/**
 * The guest wishlist handed over at login. The two lists are unioned : a
 * product the account already had stays, and one saved in this browser before
 * signing in is added. Nothing is ever removed, and unknown product ids are
 * skipped rather than failing the whole hand-over, because a wishlist saved
 * months ago can name a product that no longer exists.
 */
export const mergeWishlist = asyncErrorHandler(
  async (req: CustomRequest, res) => {
    const value = doValidate(VMergeWishlist, req.body ?? {});
    const userId = req.token_info?.id;

    if (value.product_ids.length > 0) {
      await pool.query(
        `INSERT INTO wishlist (user_id, product_id)
         SELECT $1, p.id
         FROM products p
         WHERE p.id = ANY($2::int[])
         ON CONFLICT (user_id, product_id) DO NOTHING`,
        [userId, value.product_ids],
      );
    }

    httpResponse(
      res,
      200,
      "Wishlist merged",
      await readWishlist(userId, { withVariants: true }),
    );
  },
);

export const clearWishlist = asyncErrorHandler(
  async (req: CustomRequest, res) => {
    await pool.query(`DELETE FROM wishlist WHERE user_id = $1`, [
      req.token_info?.id,
    ]);

    httpResponse(res, 200, "Wishlist cleared");
  },
);

// admin panel view : the wishlist of any user, read by whoever holds the
// "Registered Users" permission. Private products stay visible here on purpose,
// the admin should see the row exactly as it is stored.
export const getUserWishlist = asyncErrorHandler(async (req, res) => {
  const userId = parseInt(req.params.user_id?.toString() ?? "");

  if (isNaN(userId)) throw new ErrorHandler(400, "Invalid user id");

  const { rows } = await pool.query(
    `
    SELECT
      w.id AS wishlist_id,
      w.created_at AS added_at,
      p.id AS product_id,
      p.name AS product_name,
      p.slug AS product_slug,
      p.status AS product_status,
      c.name AS category_name,
      ${MIN_PRICE_EXPR} AS min_price,
      ${MAX_PRICE_EXPR} AS max_price,
      (
        SELECT pi.image
        FROM product_images pi
        WHERE pi.product_id = p.id AND pi.type = 'image'
        ORDER BY pi.position ASC
        LIMIT 1
      ) AS image
    FROM wishlist w

    INNER JOIN products p
    ON p.id = w.product_id

    LEFT JOIN categories c
    ON c.id = p.category_id

    ${PRODUCT_PRICE_JOIN}

    WHERE w.user_id = $1

    ORDER BY w.created_at DESC, w.id DESC
    `,
    [userId],
  );

  httpResponse(res, 200, "User wishlist", rows);
});
