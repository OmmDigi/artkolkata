import { pool } from "..";
import asyncErrorHandler from "../middleware/asyncErrorHandler";
import { CustomRequest } from "../types";
import { doValidate } from "../utils/doValidate";
import { ErrorHandler } from "../utils/ErrorHandler";
import { httpResponse } from "../utils/httpResponse";
import {
  CART_MAX_QUANTITY,
  VAddToCart,
  VMergeCart,
  VRemoveCartItem,
  VUpdateCartItem,
} from "../validator/cart.validator";

// a product pulled out of a private state should not keep sitting in the cart
const PUBLIC_PRODUCT_STATUS = 1;

/**
 * The cart is stored thin — product, variant, quantity — and everything the
 * storefront paints is read live here, so a price edit or a new image in the
 * CMS is reflected in a cart that was filled last week.
 */
const CART_SELECT = `
  SELECT
    c.id AS cart_id,
    c.quantity,
    c.created_at AS added_at,
    c.updated_at,

    p.id AS product_id,
    p.name,
    p.slug,
    p.status,
    p.sku_id,
    p.price AS product_price,
    p.compare_at_price AS product_compare_at_price,
    p.available_quantity,

    c.variant_id,
    pv.sku AS variant_sku,
    pv.price AS variant_price,
    pv.compare_at_price AS variant_compare_at_price,
    pv.quantity AS variant_quantity,
    pv.available AS variant_available,

    cat.name AS category_name,
    cat.slug AS category_slug,

    COALESCE((
      SELECT JSON_AGG(
        JSON_BUILD_OBJECT(
          'image', pi.image,
          'alt_tag', pi.alt_tag,
          'position', pi.position,
          'type', COALESCE(pi.type, 'image')
        ) ORDER BY pi.position ASC
      )
      FROM product_images pi
      WHERE pi.product_id = p.id
    ), '[]'::json) AS product_images,

    COALESCE((
      SELECT JSON_AGG(
        JSON_BUILD_OBJECT(
          'image', pvi.image,
          'alt_tag', pvi.alt_tag,
          'position', pvi.position,
          'type', COALESCE(pvi.type, 'image')
        ) ORDER BY pvi.position ASC
      )
      FROM product_variant_images pvi
      WHERE pvi.product_variant_id = pv.id
    ), '[]'::json) AS variant_images,

    COALESCE((
      SELECT JSON_AGG(
        JSON_BUILD_OBJECT('name', po.name, 'value', pov.value)
        ORDER BY po.position ASC
      )
      FROM variant_option_values vov
      INNER JOIN product_option_values pov ON pov.id = vov.option_value_id
      INNER JOIN product_options po ON po.id = pov.option_id
      WHERE vov.variant_id = pv.id
    ), '[]'::json) AS variations

  FROM cart c

  INNER JOIN products p
  ON p.id = c.product_id

  LEFT JOIN product_variants pv
  ON pv.id = c.variant_id

  LEFT JOIN categories cat
  ON cat.id = p.category_id
`;

/**
 * The storefront store keeps its items as { id, variantId, quantity, product },
 * so the rows are reshaped into exactly that here and the client does not have
 * to know two different cart shapes.
 */
const toCartItem = (row: any) => {
  const price = Number(row.variant_price ?? row.product_price ?? 0);
  const compareAtPrice = Number(
    row.variant_compare_at_price ?? row.product_compare_at_price ?? 0,
  );

  const variantImages = row.variant_images ?? [];
  const images = variantImages.length > 0 ? variantImages : (row.product_images ?? []);

  return {
    cart_id: row.cart_id,
    id: row.product_id,
    variantId: row.variant_id ?? null,
    quantity: row.quantity,
    added_at: row.added_at,
    product: {
      id: row.product_id,
      name: row.name,
      slug: row.slug,
      status: row.status,
      sku: row.variant_sku ?? row.sku_id,
      variant_id: row.variant_id ?? null,
      price,
      compare_at_price: compareAtPrice,
      // what the customer can still order of this exact line
      stock: Number(row.variant_quantity ?? row.available_quantity ?? 0),
      available: row.variant_id ? row.variant_available !== false : true,
      images,
      variations: row.variations ?? [],
      category_name: row.category_name,
      category_slug: row.category_slug,
    },
  };
};

// isAuthenticated has already run on every storefront route, so this only
// narrows the type — a missing id there would be a broken token, not a guest.
const requireUserId = (req: CustomRequest) => {
  const userId = req.token_info?.id;
  if (!userId) throw new ErrorHandler(401, "Please login to use the cart");
  return userId;
};

const readCart = async (userId: number) => {
  const { rows } = await pool.query(
    `${CART_SELECT}
     WHERE c.user_id = $1 AND p.status = ${PUBLIC_PRODUCT_STATUS}
     ORDER BY c.created_at DESC, c.id DESC`,
    [userId],
  );

  return rows.map(toCartItem);
};

/**
 * A variant id that belongs to another product would quietly price the line
 * from the wrong row, so the pair is checked before anything is written.
 */
const assertSellableItem = async (productId: number, variantId: number | null) => {
  const { rows } = await pool.query(
    `SELECT status FROM products WHERE id = $1`,
    [productId],
  );

  if (rows.length === 0) throw new ErrorHandler(404, "Product not found");
  if (rows[0].status !== PUBLIC_PRODUCT_STATUS)
    throw new ErrorHandler(400, "This product is not available");

  if (variantId === null) return;

  const { rows: variantRows } = await pool.query(
    `SELECT id FROM product_variants WHERE id = $1 AND product_id = $2`,
    [variantId, productId],
  );

  if (variantRows.length === 0)
    throw new ErrorHandler(404, "Product variant not found");
};

export const getCart = asyncErrorHandler(async (req: CustomRequest, res) => {
  const items = await readCart(requireUserId(req));

  httpResponse(res, 200, "Cart", items);
});

// the navbar badge only needs the numbers, not the whole cart
export const getCartSummary = asyncErrorHandler(
  async (req: CustomRequest, res) => {
    const { rows } = await pool.query(
      `SELECT
         COUNT(*)::int AS total_items,
         COALESCE(SUM(c.quantity), 0)::int AS total_quantity,
         COALESCE(SUM(c.quantity * COALESCE(pv.price, p.price)), 0) AS cart_total
       FROM cart c
       INNER JOIN products p ON p.id = c.product_id
       LEFT JOIN product_variants pv ON pv.id = c.variant_id
       WHERE c.user_id = $1 AND p.status = ${PUBLIC_PRODUCT_STATUS}`,
      [requireUserId(req)],
    );

    httpResponse(res, 200, "Cart summary", {
      total_items: rows[0].total_items,
      total_quantity: rows[0].total_quantity,
      cart_total: Number(rows[0].cart_total),
    });
  },
);

/**
 * Adding a line that is already there adds to its quantity, the way pressing
 * "Add to cart" twice on the same page behaves on the storefront.
 */
export const addToCart = asyncErrorHandler(async (req: CustomRequest, res) => {
  const value = doValidate(VAddToCart, req.body ?? {});
  const userId = requireUserId(req);
  const variantId = value.variant_id ?? null;

  await assertSellableItem(value.product_id, variantId);

  await pool.query(
    `INSERT INTO cart (user_id, product_id, variant_id, quantity)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, product_id, COALESCE(variant_id, 0))
     DO UPDATE SET
       quantity = LEAST(cart.quantity + EXCLUDED.quantity, ${CART_MAX_QUANTITY}),
       updated_at = NOW()`,
    [userId, value.product_id, variantId, value.quantity],
  );

  httpResponse(res, 200, "Added to cart", await readCart(userId));
});

/**
 * The quantity stepper sends the number it wants, not a delta, so this
 * overwrites. Zero is how the last "minus" press removes the line.
 */
export const updateCartItem = asyncErrorHandler(
  async (req: CustomRequest, res) => {
    const value = doValidate(VUpdateCartItem, req.body ?? {});
    const userId = requireUserId(req);
    const variantId = value.variant_id ?? null;

    if (value.quantity === 0) {
      await pool.query(
        `DELETE FROM cart
         WHERE user_id = $1 AND product_id = $2
         AND COALESCE(variant_id, 0) = COALESCE($3::int, 0)`,
        [userId, value.product_id, variantId],
      );

      return httpResponse(res, 200, "Removed from cart", await readCart(userId));
    }

    await assertSellableItem(value.product_id, variantId);

    // a quantity update for a line that is no longer there is an add, which is
    // what a stepper pressed on a stale page should do rather than fail
    await pool.query(
      `INSERT INTO cart (user_id, product_id, variant_id, quantity)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, product_id, COALESCE(variant_id, 0))
       DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = NOW()`,
      [userId, value.product_id, variantId, value.quantity],
    );

    httpResponse(res, 200, "Cart updated", await readCart(userId));
  },
);

export const removeFromCart = asyncErrorHandler(
  async (req: CustomRequest, res) => {
    const value = doValidate(VRemoveCartItem, {
      product_id: Number(req.params.product_id),
      variant_id:
        req.query.variant_id === undefined || req.query.variant_id === ""
          ? null
          : Number(req.query.variant_id),
    });

    const userId = requireUserId(req);

    await pool.query(
      `DELETE FROM cart
       WHERE user_id = $1 AND product_id = $2
       AND COALESCE(variant_id, 0) = COALESCE($3::int, 0)`,
      [userId, value.product_id, value.variant_id ?? null],
    );

    httpResponse(res, 200, "Removed from cart", await readCart(userId));
  },
);

export const clearCart = asyncErrorHandler(async (req: CustomRequest, res) => {
  await pool.query(`DELETE FROM cart WHERE user_id = $1`, [requireUserId(req)]);

  httpResponse(res, 200, "Cart cleared", []);
});

/**
 * Login hand-over : whatever the customer collected as a guest is folded into
 * the account cart. Quantities are summed rather than replaced, so a product
 * added on the phone and again on the desktop ends up as one line with both.
 * Unknown or private products are skipped instead of failing the whole merge,
 * because this runs inside the login flow and must not block it.
 */
export const mergeCart = asyncErrorHandler(async (req: CustomRequest, res) => {
  const value = doValidate(VMergeCart, req.body ?? {});
  const userId = requireUserId(req);

  for (const item of value.items) {
    const variantId = item.variant_id ?? null;

    try {
      await assertSellableItem(item.product_id, variantId);
    } catch {
      continue;
    }

    await pool.query(
      `INSERT INTO cart (user_id, product_id, variant_id, quantity)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, product_id, COALESCE(variant_id, 0))
       DO UPDATE SET
         quantity = LEAST(cart.quantity + EXCLUDED.quantity, ${CART_MAX_QUANTITY}),
         updated_at = NOW()`,
      [userId, item.product_id, variantId, item.quantity],
    );
  }

  httpResponse(res, 200, "Cart merged", await readCart(userId));
});

/**
 * Admin panel view : the cart of any user, read by whoever holds the
 * "Registered Users" permission. Private products stay visible here on purpose,
 * the admin should see the line exactly as it is stored.
 */
export const getUserCart = asyncErrorHandler(async (req, res) => {
  const userId = parseInt(req.params.user_id?.toString() ?? "");

  if (isNaN(userId)) throw new ErrorHandler(400, "Invalid user id");

  const { rows } = await pool.query(
    `
    SELECT
      c.id AS cart_id,
      c.quantity,
      c.created_at AS added_at,
      c.updated_at,
      c.variant_id,
      p.id AS product_id,
      p.name AS product_name,
      p.slug AS product_slug,
      p.status AS product_status,
      pv.sku AS variant_sku,
      COALESCE(pv.price, p.price) AS unit_price,
      (c.quantity * COALESCE(pv.price, p.price)) AS line_total,
      cat.name AS category_name,
      COALESCE((
        SELECT JSON_AGG(
          JSON_BUILD_OBJECT('name', po.name, 'value', pov.value)
          ORDER BY po.position ASC
        )
        FROM variant_option_values vov
        INNER JOIN product_option_values pov ON pov.id = vov.option_value_id
        INNER JOIN product_options po ON po.id = pov.option_id
        WHERE vov.variant_id = pv.id
      ), '[]'::json) AS variations,
      COALESCE(
        (
          SELECT pvi.image
          FROM product_variant_images pvi
          WHERE pvi.product_variant_id = pv.id AND pvi.type = 'image'
          ORDER BY pvi.position ASC
          LIMIT 1
        ),
        (
          SELECT pi.image
          FROM product_images pi
          WHERE pi.product_id = p.id AND pi.type = 'image'
          ORDER BY pi.position ASC
          LIMIT 1
        )
      ) AS image

    FROM cart c

    INNER JOIN products p
    ON p.id = c.product_id

    LEFT JOIN product_variants pv
    ON pv.id = c.variant_id

    LEFT JOIN categories cat
    ON cat.id = p.category_id

    WHERE c.user_id = $1

    ORDER BY c.created_at DESC, c.id DESC
    `,
    [userId],
  );

  const items = rows.map((row) => ({
    ...row,
    unit_price: Number(row.unit_price),
    line_total: Number(row.line_total),
  }));

  httpResponse(res, 200, "User cart", {
    items,
    total_items: items.length,
    total_quantity: items.reduce((sum, item) => sum + item.quantity, 0),
    cart_total: items.reduce((sum, item) => sum + item.line_total, 0),
  });
});
