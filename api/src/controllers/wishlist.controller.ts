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
import { VAddToWishlist } from "../validator/wishlist.validator";

// a product pulled out of a private state should not keep showing up in the wishlist
const PUBLIC_PRODUCT_STATUS = 1;

export const getWishlist = asyncErrorHandler(
  async (req: CustomRequest, res) => {
    const { TO_STRING } = parsePagination(req);
    const userId = req.token_info?.id;

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

      ${TO_STRING}
      `,
      [userId],
    );

    if (req.query.variants === "true") {
      const variantsByProduct = await getProductsVariants(
        rows.map((row) => row.id),
      );

      rows.forEach((row) => {
        row.variants = variantsByProduct[row.id] ?? [];
      });
    }

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
