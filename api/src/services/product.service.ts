import { REVIEW_STATUS_APPROVED } from "../constant";
import { Role } from "../types";
import { doTransition } from "../utils/doTransition";
import { ErrorHandler } from "../utils/ErrorHandler";
import { isNumber } from "../utils/isNumber";

export const getSingleProduct = async (productIdSlug: any, userRole : Role) => {

  const key = isNumber(productIdSlug) ? "p.id" : "p.slug";

  let productsResToReturn: any = {};

  let filter = `WHERE ${key} = $1`;
  let filterValues : (string | number)[] = [productIdSlug];
  let paramCount = 2;

  if(userRole === "User") {
    filter += ` AND p.status = $${paramCount++}`;
    filterValues.push(1);
  }

  await doTransition(async (client) => {
    // 1. Get product info
    const productResult = await client.query(
      `
       WITH product_reviews AS (
          SELECT
            product_id,
            COALESCE(AVG(stars), 0.0) AS rating,
            COUNT(id) AS total_ratings
          FROM reviews
          WHERE status = ${REVIEW_STATUS_APPROVED}
          GROUP BY product_id
        )
        SELECT 
          p.*,
          c.slug AS category_slug,
          COALESCE(JSON_AGG(pi ORDER BY pi.position ASC) FILTER (WHERE pi.id IS NOT NULL), '[]'::json) AS images,
          MAX(pr.rating) AS rating,
          MAX(pr.total_ratings) AS total_ratings
        FROM products p
        LEFT JOIN product_images pi ON pi.product_id = p.id
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN product_reviews pr ON pr.product_id = p.id
        ${filter}
        GROUP BY p.id, c.id
      `,
      filterValues
    );

    if (productResult.rows.length === 0) {
      throw new ErrorHandler(404, "Product not found");
    }

    const product = productResult.rows[0];
    const productId = product.id;

    // 2. Get options with their values
    const optionsResult = await client.query(
      `
                SELECT 
                    po.id as option_id,
                    po.name as option_name,
                    po.position as option_position,
                    pov.id as value_id,
                    pov.value as value_name,
                    pov.position as value_position
                FROM product_options po
                LEFT JOIN product_option_values pov ON po.id = pov.option_id
                WHERE po.product_id = $1
                ORDER BY po.position, pov.position
            `,
      [productId]
    );

    // Structure options
    const optionsMap = new Map<number, any>(); // Option

    optionsResult.rows.forEach((row) => {
      if (!optionsMap.has(row.option_id)) {
        optionsMap.set(row.option_id, {
          id: row.option_id,
          name: row.option_name,
          values: [],
        });
      }

      if (row.value_id) {
        optionsMap.get(row.option_id)?.values.push({
          id: row.value_id,
          value: row.value_name,
        });
      }
    });

    const options = Array.from(optionsMap.values());

    // 3. Get variants with their option values
    const variantsResult = await client.query(
      `
       SELECT 
        pv.id,
        pv.sku,
        pv.price,
        pv.compare_at_price,
        pv.quantity,
        pv.available,
        pov.value as option_value,
        po.name as option_name,
        po.position as option_position,
        COALESCE(JSON_AGG(
          JSON_BUILD_OBJECT(
            'image', pvi.image,
            'alt_tag', pvi.alt_tag,
            'position', pvi.position,
            'type', COALESCE(pvi.type, 'image')
          )
          ORDER BY pvi.position ASC
        ) FILTER (WHERE pvi.image IS NOT NULL), '[]'::json) AS vareient_images
        FROM product_variants pv
        LEFT JOIN variant_option_values vov ON pv.id = vov.variant_id
        LEFT JOIN product_option_values pov ON vov.option_value_id = pov.id
        LEFT JOIN product_options po ON pov.option_id = po.id

        LEFT JOIN product_variant_images pvi ON pvi.product_variant_id = vov.variant_id

        WHERE pv.product_id = $1

        GROUP BY pv.id, pov.id, po.id

        ORDER BY pv.id, po.position        
      `,
      [productId]
    );

    // Structure variants
    const variantsMap = new Map<number, any>();

    variantsResult.rows.forEach((row) => {
      if (!variantsMap.has(row.id)) {
        variantsMap.set(row.id, {
          id: row.id,
          sku: row.sku,
          price: row.price.toString(),
          compareAtPrice: row.compare_at_price
            ? row.compare_at_price.toString()
            : "",
          quantity: row.quantity.toString(),
          available: row.available,
          combination: [],
          images : row.vareient_images ?? []
        });
      }

      if (row.option_value) {
        variantsMap.get(row.id).combination.push(row.option_value);
      }

      if(row.vareient_images) {
        variantsMap.get(row.id).images = row.vareient_images;
      }
    });

    const variants = Array.from(variantsMap.values());

    product.variants = variants;
    product.options = options;
    productsResToReturn = product;
  });

  return productsResToReturn;
};
