import { pool } from "..";
import { CustomRequest } from "../types";
import { checkPermission } from "../utils/checkPermissions";
import {
  buildProductFilter,
  MAX_PRICE_EXPR,
  MIN_PRICE_EXPR,
  PRODUCT_PRICE_JOIN,
  ProductFilterKey,
} from "./productFilter.service";

/**
 * `base` holds the products the current query matches. Every facet query counts on top
 * of it, so a facet can never offer a value that leads to an empty product list.
 */
const withBase = (where: string, facetQuery: string) => `
  WITH base AS (
    SELECT
      p.id AS product_id,
      ${MIN_PRICE_EXPR} AS min_price,
      ${MAX_PRICE_EXPR} AS max_price
    FROM products p

    LEFT JOIN categories c
    ON c.id = p.category_id

    LEFT JOIN sub_categories sc
    ON sc.id = p.sub_category_id

    ${PRODUCT_PRICE_JOIN}

    ${where}
  )
  ${facetQuery}
`;

export const getProductFilters = async (req: CustomRequest) => {
  const isAdmin = checkPermission(req.token_info?.permissions ?? null, ["1-3"]);

  // each facet ignores its own selection, so picking "Red" still leaves "Blue" pickable
  const scoped = (skip: ProductFilterKey[]) => buildProductFilter(req, skip);

  const categoryFilter = scoped(["category", "sub_category"]);
  const optionFilter = scoped(["option"]);
  const tagFilter = scoped(["tag"]);
  const priceFilter = scoped(["price"]);
  const totalFilter = scoped([]);

  const [categoryRes, optionRes, tagRes, priceRes, totalRes] = await Promise.all([
    pool.query(
      withBase(
        categoryFilter.where,
        `
        SELECT
          c.id AS category_id,
          c.name AS category_name,
          c.slug AS category_slug,
          c.image AS category_image,
          c.position AS category_position,
          sc.id AS sub_category_id,
          sc.name AS sub_category_name,
          sc.slug AS sub_category_slug,
          sc.position AS sub_category_position,
          COUNT(DISTINCT b.product_id) AS product_count
        FROM base b

        JOIN products p
        ON p.id = b.product_id

        JOIN categories c
        ON c.id = p.category_id

        LEFT JOIN sub_categories sc
        ON sc.id = p.sub_category_id

        ${isAdmin ? "" : "WHERE c.is_visible = TRUE"}

        GROUP BY c.id, sc.id

        ORDER BY c.position ASC, c.id ASC, sc.position ASC, sc.id ASC
      `,
      ),
      categoryFilter.values,
    ),

    pool.query(
      withBase(
        optionFilter.where,
        `
        SELECT
          LOWER(po.name) AS option_key,
          LOWER(pov.value) AS value_key,
          MIN(po.name) AS option_name,
          MIN(pov.value) AS option_value,
          MIN(po.position) AS option_position,
          COUNT(DISTINCT b.product_id) AS product_count
        FROM base b

        JOIN product_options po
        ON po.product_id = b.product_id

        JOIN product_option_values pov
        ON pov.option_id = po.id

        GROUP BY LOWER(po.name), LOWER(pov.value)

        ORDER BY MIN(po.position) ASC, LOWER(po.name) ASC, LOWER(pov.value) ASC
      `,
      ),
      optionFilter.values,
    ),

    pool.query(
      withBase(
        tagFilter.where,
        `
        SELECT
          t.tag AS tag,
          COUNT(DISTINCT b.product_id) AS product_count
        FROM base b

        JOIN products p
        ON p.id = b.product_id

        CROSS JOIN LATERAL jsonb_object_keys(COALESCE(p.tags, '{}'::jsonb)) AS t(tag)

        GROUP BY t.tag

        ORDER BY COUNT(DISTINCT b.product_id) DESC, t.tag ASC
      `,
      ),
      tagFilter.values,
    ),

    pool.query(
      withBase(
        priceFilter.where,
        `
        SELECT
          COALESCE(MIN(b.min_price), 0) AS min_price,
          COALESCE(MAX(b.max_price), 0) AS max_price
        FROM base b
      `,
      ),
      priceFilter.values,
    ),

    pool.query(
      withBase(
        totalFilter.where,
        "SELECT COUNT(DISTINCT b.product_id) AS total_products FROM base b",
      ),
      totalFilter.values,
    ),
  ]);

  // categories arrive as one row per (category, sub category) pair
  const categoryMap = new Map<number, any>();
  categoryRes.rows.forEach((row) => {
    if (!categoryMap.has(row.category_id)) {
      categoryMap.set(row.category_id, {
        id: row.category_id,
        name: row.category_name,
        slug: row.category_slug,
        image: row.category_image,
        product_count: 0,
        sub_categories: [],
      });
    }

    const category = categoryMap.get(row.category_id);
    // a product belongs to exactly one (category, sub category) pair, so summing is safe
    category.product_count += Number(row.product_count);

    if (row.sub_category_id) {
      category.sub_categories.push({
        id: row.sub_category_id,
        name: row.sub_category_name,
        slug: row.sub_category_slug,
        product_count: Number(row.product_count),
      });
    }
  });

  const optionMap = new Map<string, any>();
  optionRes.rows.forEach((row) => {
    if (!optionMap.has(row.option_key)) {
      optionMap.set(row.option_key, {
        name: row.option_name,
        key: row.option_key,
        values: [],
      });
    }

    const option = optionMap.get(row.option_key);
    option.values.push({
      value: row.option_value,
      // what the website has to send back as ?option=<name>:<value>, always spelled with
      // the option's display name so every value of one option reads the same way
      query: `${option.name}:${row.option_value}`,
      product_count: Number(row.product_count),
    });
  });

  const priceRow = priceRes.rows[0] ?? { min_price: 0, max_price: 0 };

  return {
    total_products: Number(totalRes.rows[0]?.total_products ?? 0),
    categories: Array.from(categoryMap.values()),
    options: Array.from(optionMap.values()),
    tags: tagRes.rows.map((row) => ({
      tag: row.tag,
      product_count: Number(row.product_count),
    })),
    price_range: {
      min: Number(priceRow.min_price),
      max: Number(priceRow.max_price),
    },
  };
};
