import { DatabaseError } from "pg";
import { pool } from "..";
import asyncErrorHandler from "../middleware/asyncErrorHandler";
import { doValidate } from "../utils/doValidate";
import { httpResponse } from "../utils/httpResponse";
import {
  VAddCategory,
  VAddNewRecipent,
  VAddProducts,
  VAddReview,
  VAddSubCategory,
  VCopyProduct,
  VDeleteReview,
  VUpdateCategory,
  VUpdateProducts,
  VUpdateRecipent,
  VUpdateReviewStatus,
  VUpdateSubCategory,
} from "../validator/product.validator";
import { ErrorHandler } from "../utils/ErrorHandler";
import { parsePagination } from "../utils/parsePagination";
import { doTransition } from "../utils/doTransition";
import { generatePlaceholders } from "../utils/generatePlaceholders";
import { getSingleProduct } from "../services/product.service";
import { isNumber } from "../utils/isNumber";
import { CustomRequest } from "../types";
import { REVIEW_STATUS_APPROVED } from "../constant";
import { checkPermission } from "../utils/checkPermissions";
import { runEditorParser } from "../utils/runEditorParser";

// category tool
export const createNewCategory = asyncErrorHandler(async (req, res) => {
  const value = doValidate(VAddCategory, req.body ?? {});

  try {
    await pool.query(
      "INSERT INTO categories (name, slug, image, alt_tag, position, is_visible) VALUES ($1, $2, $3, $4, $5, $6)",
      [
        value.name,
        value.slug,
        value.image,
        value.alt_tag ?? null,
        value.position ?? 0,
        value.is_visible ?? true,
      ],
    );

    httpResponse(res, 201, "New category successfully created");
  } catch (error) {
    const err = error as DatabaseError;
    if (err.code === "23505" && err.detail?.includes("slug")) {
      throw new ErrorHandler(
        400,
        `"${value.slug}" This slug is already in use. Please choose a different one`,
      );
    }
    throw new ErrorHandler(400, err.message);
  }
});

export const getCategoryList = asyncErrorHandler(
  async (req: CustomRequest, res) => {
    const { TO_STRING } = parsePagination(req);

    // only admin can see the private (hidden) categories, everyone else gets the public one
    let filter = "";
    if (!checkPermission(req.token_info?.permissions ?? null, ["1-3"])) {
      filter = "WHERE c.is_visible = TRUE";
    }

    const { rows } = await pool.query(
      `
    SELECT
      c.*,
      COALESCE(JSON_AGG(sc) FILTER (WHERE sc.id IS NOT NULL), '[]'::json) AS sub_categories
    FROM categories c

    LEFT JOIN sub_categories sc
    ON sc.category_id = c.id

    ${filter}

    GROUP BY c.id

    ORDER BY c.position ASC, c.id DESC ${TO_STRING}
    `,
    );

    httpResponse(res, 200, "Category list", rows);
  },
);

export const updateCateogry = asyncErrorHandler(async (req, res) => {
  const value = doValidate(VUpdateCategory, req.body ?? {});

  try {
    await pool.query(
      "UPDATE categories SET name = $1, slug = $2, image = $3, alt_tag = $4, position = $5, is_visible = $6 WHERE id = $7",
      [
        value.name,
        value.slug,
        value.image,
        value.alt_tag ?? null,
        value.position ?? 0,
        value.is_visible ?? true,
        value.id,
      ],
    );

    httpResponse(res, 200, "Category successfully updated");
  } catch (error) {
    const err = error as DatabaseError;

    if (err.code === "23505" && err.detail?.includes("slug")) {
      throw new ErrorHandler(
        400,
        `"${value.slug}" This slug is already in use. Please choose a different one.`,
      );
    }

    throw new ErrorHandler(400, err.message);
  }
});

export const getSingleCategory = asyncErrorHandler(
  async (req: CustomRequest, res) => {
    let filter = "";
    let placeholdernum = 1;
    const filterValues: any[] = [];

    if (req.params.id) {
      if (filter === "") {
        filter = `WHERE c.id = $${placeholdernum++}`;
      } else {
        filter += ` AND c.id = $${placeholdernum++}`;
      }

      filterValues.push(req.params.id.toString());
    }

    if (req.query.slug) {
      if (filter === "") {
        filter = `WHERE c.slug = $${placeholdernum++}`;
      } else {
        filter += ` AND c.slug = $${placeholdernum++}`;
      }

      filterValues.push(req.query.slug);
    }

    // a private category can only be fetched by the admin
    if (!checkPermission(req.token_info?.permissions ?? null, ["1-3"])) {
      if (filter === "") {
        filter = `WHERE c.is_visible = TRUE`;
      } else {
        filter += ` AND c.is_visible = TRUE`;
      }
    }

    const { rows } = await pool.query(
      `
    SELECT
     c.*
    FROM categories c
    ${filter}
  `,
      filterValues,
    );

    return httpResponse(res, 200, "Single category", rows[0]);
  },
);

export const deleteSingleCategory = asyncErrorHandler(async (req, res) => {
  await pool.query("DELETE FROM categories WHERE id = $1", [req.params.id]);
  httpResponse(res, 200, "Category successfully removed");
});

//recipient
export const addNewRecipient = asyncErrorHandler(async (req, res) => {
  const value = doValidate(VAddNewRecipent, req.body ?? {});
  await pool.query(
    "INSERT INTO recipient (tag_name, image, alt_tag, status) VALUES ($1, $2, $3, $4)",
    [value.tag_name, value.image, value.alt_tag ?? null, value.status],
  );
  httpResponse(res, 201, "New Item Successfully Created");
});

export const getRecipientList = asyncErrorHandler(
  async (req: CustomRequest, res) => {
    let filter = "WHERE 1=1";
    // let placeholder = 1;
    // const filterValues : string[] = [];

    if (!checkPermission(req.token_info?.permissions ?? null, ["1-7"])) {
      filter += ` AND r.status = 1`;
    }

    const { rows } = await pool.query(
      `
    SELECT 
      r.*
    FROM recipient r

    ${filter}

    ORDER BY r.id DESC
    `,
    );

    httpResponse(res, 200, "Recipient list", rows);
  },
);

export const getSingleRecipientList = asyncErrorHandler(
  async (req: CustomRequest, res) => {
    const id = req.params.id as string;

    let filter = "WHERE id = $1";
    // let placeholder = 2;
    const filterValues: string[] = [id];

    if (!checkPermission(req.token_info?.permissions ?? null, ["1-7"])) {
      filter += ` AND r.status = 1`;
    }

    const { rows, rowCount } = await pool.query(
      `
    SELECT 
      r.*
    FROM recipient r
    ${filter}
    `,
      filterValues,
    );

    if (rowCount == 0) throw new ErrorHandler(404, "Item not found");

    httpResponse(res, 200, "Recipient list", rows[0]);
  },
);

export const updateRecipient = asyncErrorHandler(async (req, res) => {
  const value = doValidate(VUpdateRecipent, req.body ?? {});
  await pool.query(
    "UPDATE recipient SET tag_name = $1, image = $2, alt_tag = $3, status = $4 WHERE id = $5",
    [
      value.tag_name,
      value.image,
      value.alt_tag ?? null,
      value.status,
      value.id,
    ],
  );

  httpResponse(res, 200, "Item successfully updated");
});

export const deleteRecipient = asyncErrorHandler(async (req, res) => {
  await pool.query("DELETE FROM recipient WHERE id = $1", [req.params.id]);
  httpResponse(res, 200, "Item successfully removed");
});

// products
export const getProductList = asyncErrorHandler(
  async (req: CustomRequest, res) => {
    if (req.query.product_id) {
      const singleProduct = await getSingleProduct(
        parseInt(req.query.product_id.toString()),
        req.token_info?.role ?? "User",
      );
      httpResponse(res, 200, "Single Product", [singleProduct]);
      return;
    }

    const { TO_STRING } = parsePagination(req);

    let filter = "";
    let placeholdernum = 1;
    const filterValues: any[] = [];

    if (req.query.category) {
      // const categories = req.query.category.split(",");
      let keys = new Array();
      if(Array.isArray(req.query.category)) {
        req.query.category.forEach(item => {
          keys.push(item);
          filterValues.push(item);
        })
        keys = [...req.query.category];
        placeholdernum += keys.length;
      } else {
        keys = [req.query.category]
        filterValues.push(keys[0]);
      }
      let placeholders = generatePlaceholders(1, keys.length);
      const key = isNumber(keys[0]) ? "p.category_id" : "c.slug";

      if (filter === "") {
        if (keys.length == 0) {
          filter = `WHERE ${key} = $${placeholdernum++}`;
        } else {
          filter = `WHERE ${key} IN ${placeholders}`;
          placeholdernum += keys.length;
        }
      } else {
        if (keys.length == 0) {
          filter = ` AND ${key} = $${placeholdernum++}`;
        } else {
          filter += ` AND ${key} IN ${placeholders}`;
          placeholdernum += keys.length;
        }
      }
    }

    if (req.query.sub_category) {
      const key = isNumber(req.query.sub_category) ? "sc.id" : "sc.slug";

      if (filter === "") {
        filter = `WHERE ${key} = $${placeholdernum++}`;
      } else {
        filter += ` AND ${key} = $${placeholdernum++}`;
      }

      filterValues.push(req.query.sub_category);
    }

    if (req.query.tag) {
      if (filter === "") {
        filter = `WHERE p.tags ? $${placeholdernum++}`;
      } else {
        filter += ` AND p.tags ? $${placeholdernum++}`;
      }

      filterValues.push(req.query.tag);
    }

    if (req.query.search) {
      if (filter === "") {
        filter = `WHERE p.name ILIKE '%' || $${placeholdernum++} || '%'`;
      } else {
        filter += ` AND p.name ILIKE '%' || $${placeholdernum++} || '%'`;
      }

      filterValues.push(req.query.search);
    }

    if (req.query.status && checkPermission(req.token_info?.permissions ?? null, ["1-6"]) == true) {
      // check is the request is comming form the admin if yes any status can see but if not only public product will visiable
      if (filter === "") {
        filter = `WHERE p.status = $${placeholdernum++}`;
      } else {
        filter += ` AND p.status = $${placeholdernum++}`;
      }
      filterValues.push(req.query.status);
    } else {
      if (!checkPermission(req.token_info?.permissions ?? null, ["1-3"])) {
        if (filter === "") {
          filter = `WHERE p.status = 1`;
        } else {
          filter += ` AND p.status = 1`;
        }
      }
    }

    const { rows } = await pool.query(
      `
    SELECT 
     p.*,
     c.slug AS category_slug,
     c.name AS category_name,
     TO_CHAR(p.updated_at, 'DD Mon YYYY') AS updated_at,
     COALESCE(JSON_AGG(pi ORDER BY pi.position ASC) FILTER (WHERE pi.id IS NOT NULL), '[]'::json) as images,
     COALESCE(AVG(r.stars), 0.0) AS rating,
     COUNT(DISTINCT r.id) AS total_ratings
    FROM products p

    LEFT JOIN product_images pi
    ON pi.product_id = p.id

    LEFT JOIN categories c
    ON c.id = p.category_id

    LEFT JOIN sub_categories sc
    ON sc.id = p.sub_category_id

    LEFT JOIN reviews r
    ON r.product_id = p.id AND r.status = ${REVIEW_STATUS_APPROVED}

    ${filter}

    GROUP BY p.id, c.id

    ORDER BY p.position ASC, p.id DESC

    ${TO_STRING}
  `,
      filterValues,
    );

    httpResponse(res, 200, "Product List", rows);
  },
);

export const addNewProduct = asyncErrorHandler(async (req, res) => {
  const value = doValidate(VAddProducts, req.body ?? {});

  // const html_description = editorJsonToHtml(value.description_json);
  const html_description = await runEditorParser(value.description_json);

  await doTransition(async (client) => {
    const { rowCount, rows } = await client.query(
      `INSERT INTO products
        (sku_id, name, description, description_json, category_id, price, compare_at_price, available_quantity, meta_title, meta_description, status, tags, slug, sub_category_id, product_for, position, weight_kg, length_cm, breadth_cm, height_cm)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
       RETURNING id
      `,
      [
        value.sku_id,
        value.name,
        html_description,
        value.description_json,
        value.category_id,
        value.price,
        value.compare_at_price,
        value.available_quantity ?? 0,
        value.meta_title,
        value.meta_description,
        value.status,
        JSON.stringify(Object.fromEntries((value.tags ?? []).map((t: string) => [t, true]))),
        value.slug,
        value.sub_category_id ?? null,
        value.product_for,
        value.position ?? 0,
        value.weight_kg,
        value.length_cm,
        value.breadth_cm,
        value.height_cm,
      ],
    );
    if (rowCount == 0) throw new ErrorHandler(400, "Unable to add product");

    const productId = rows[0].id;

    // 2. insert multiple images/videos of the inserted product
    const imagePlaceholder = generatePlaceholders(value.images.length, 5);
    await client.query(
      `INSERT INTO product_images (image, alt_tag, product_id, position, type) VALUES ${imagePlaceholder}`,
      value.images.flatMap((image: any) => [
        image.image,
        image.alt_tag,
        productId,
        image.position,
        image.type ?? "image",
      ]),
    );

    // 3. Insert options and their values
    const optionMap = new Map<string, number>(); // Map option name to id
    const valueMap = new Map<string, number>(); // Map "optionName:value" to value id

    const { options, variants } = value;

    console.log(options)
    console.log(variants)
    console.log(options[0].values)

    if (options && variants) {
      for (let i = 0; i < options.length; i++) {
        const option = options[i];

        // Insert option
        const optionResult = await client.query(
          "INSERT INTO product_options (product_id, name, position) VALUES ($1, $2, $3) RETURNING id",
          [productId, option.name, i],
        );
        const optionId = optionResult.rows[0].id;
        optionMap.set(option.name, optionId);

        // Insert option values
        for (let j = 0; j < option.values.length; j++) {
          const value = option.values[j];
          const valueResult = await client.query(
            "INSERT INTO product_option_values (option_id, value, position) VALUES ($1, $2, $3) RETURNING id",
            [optionId, value.value, j],
          );
          const valueId = valueResult.rows[0].id;
          valueMap.set(`${option.name}:${value.value}`, valueId);
        }
      }

      // 4. Insert variants
      for (const variant of variants) {
        const variantResult = await client.query(
          `INSERT INTO product_variants 
                (product_id, sku, price, compare_at_price, quantity, available) 
                VALUES ($1, $2, $3, $4, $5, $6) 
                RETURNING id`,
          [
            productId,
            variant.sku || null,
            parseFloat(variant.price),
            variant.compareAtPrice ? parseFloat(variant.compareAtPrice) : null,
            parseInt(variant.quantity),
            variant.available,
          ],
        );
        const variantId = variantResult.rows[0].id;

        // Add varient images/videos
        if (variant.images?.length != 0) {
          const variantPlaceholder = generatePlaceholders(
            variant.images.length,
            5,
          );
          await client.query(
            `INSERT INTO product_variant_images (product_variant_id, image, alt_tag, position, type) VALUES ${variantPlaceholder}`,
            variant.images.flatMap((image: any) => [
              variantId,
              image.image,
              image.alt_tag,
              image.position,
              image.type ?? "image",
            ]),
          );
        }

        // Link variant to option values
        for (let i = 0; i < variant.combination.length; i++) {
          const optionName = options[i].name;
          const valueName = variant.combination[i];
          const valueId = valueMap.get(`${optionName}:${valueName}`);

          if (valueId) {
            await client.query(
              "INSERT INTO variant_option_values (variant_id, option_value_id) VALUES ($1, $2)",
              [variantId, valueId],
            );
          }
        }
      }
    }
  });

  httpResponse(res, 201, "New Product Successfully Added");
});

export const updateProduct = asyncErrorHandler(async (req, res) => {
  const value = doValidate(VUpdateProducts, req.body ?? {});

  const productId = value.id;

  const html_description = await runEditorParser(value.description_json);

  await doTransition(async (client) => {
    const { rowCount } = await client.query(
      `
      UPDATE products
      SET
        sku_id = $1,
        name = $2,
        description = $3,
        category_id = $4,
        price = $5,
        compare_at_price = $6,
        available_quantity = $7,
        meta_title = $8,
        meta_description = $9,
        status = $10,
        tags = $11,
        updated_at = NOW(),
        slug = $12,
        sub_category_id = $13,
        product_for = $14,
        description_json = $15,
        position = $16,
        weight_kg = $17,
        length_cm = $18,
        breadth_cm = $19,
        height_cm = $20
      WHERE id = $21
      `,
      [
        value.sku_id,
        value.name,
        html_description,
        value.category_id,
        value.price,
        value.compare_at_price,
        value.available_quantity ?? 0,
        value.meta_title,
        value.meta_description,
        value.status,
        JSON.stringify(Object.fromEntries((value.tags ?? []).map((t: string) => [t, true]))),
        value.slug,
        value.sub_category_id ?? null,
        value.product_for,
        value.description_json,
        value.position ?? 0,
        value.weight_kg,
        value.length_cm,
        value.breadth_cm,
        value.height_cm,
        productId,
      ],
    );

    if (rowCount == 0) throw new ErrorHandler(400, "Unable to update product");

    // 1. Delete existing variants and options and product_images
    // await client.query("DELETE FROM product_variants WHERE product_id = $1", [
    //   productId,
    // ]);
    await client.query("DELETE FROM product_options WHERE product_id = $1", [
      productId,
    ]);
    await client.query("DELETE FROM product_images WHERE product_id = $1", [
      productId,
    ]);

    // 2. insert multiple images/videos of the inserted product
    const imagePlaceholder = generatePlaceholders(value.images.length, 5);
    await client.query(
      `INSERT INTO product_images (image, alt_tag, product_id, position, type) VALUES ${imagePlaceholder}`,
      value.images.flatMap((image: any) => [
        image.image,
        image.alt_tag,
        productId,
        image.position ?? 0,
        image.type ?? "image",
      ]),
    );

    // 3. Insert options and their values
    const optionMap = new Map<string, number>(); // Map option name to id
    const valueMap = new Map<string, number>(); // Map "optionName:value" to value id

    const { options, variants } = value;

    if (options && variants) {
      for (let i = 0; i < options.length; i++) {
        const option = options[i];

        // Insert option
        const optionResult = await client.query(
          "INSERT INTO product_options (product_id, name, position) VALUES ($1, $2, $3) RETURNING id",
          [productId, option.name, i],
        );
        const optionId = optionResult.rows[0].id;
        optionMap.set(option.name, optionId);

        // Insert option values
        for (let j = 0; j < option.values.length; j++) {
          const value = option.values[j];
          const valueResult = await client.query(
            "INSERT INTO product_option_values (option_id, value, position) VALUES ($1, $2, $3) RETURNING id",
            [optionId, value.value, j],
          );
          const valueId = valueResult.rows[0].id;
          valueMap.set(`${option.name}:${value.value}`, valueId);
        }
      }

      // 4. Insert variants
      let deleteVerientPlaceholder = "";
      let varientIds: number[] = [];
      let varientPlaceholderNum = 2;
      for (const variant of variants) {
        if (deleteVerientPlaceholder == "") {
          deleteVerientPlaceholder += `$${varientPlaceholderNum++}`;
        } else {
          deleteVerientPlaceholder += `,$${varientPlaceholderNum++}`;
        }

        let variantId = variant.id;

        // check user add a new varient or not if yes insert it else update the varient info via id
        if (variant.isNew) {
          const variantResult = await client.query(
            `INSERT INTO product_variants 
                (product_id, sku, price, compare_at_price, quantity, available) 
                VALUES ($1, $2, $3, $4, $5, $6) 
                RETURNING id`,
            [
              productId,
              variant.sku || null,
              parseFloat(variant.price),
              variant.compareAtPrice
                ? parseFloat(variant.compareAtPrice)
                : null,
              parseInt(variant.quantity),
              variant.available,
            ],
          );
          variantId = variantResult.rows[0].id;
          varientIds.push(variantResult.rows[0].id);
        } else {
          await client.query(
            `
            UPDATE product_variants 
                  SET product_id = $1, sku = $2, price = $3, compare_at_price = $4, quantity = $5, available = $6
            WHERE id = $7
            `,
            [
              productId,
              variant.sku || null,
              parseFloat(variant.price),
              variant.compareAtPrice
                ? parseFloat(variant.compareAtPrice)
                : null,
              parseInt(variant.quantity),
              variant.available,
              variantId,
            ],
          );
          varientIds.push(variantId);
        }

        // Add varient images/videos
        if (variant.images?.length != 0) {
          await client.query(
            "DELETE FROM product_variant_images WHERE product_variant_id = $1",
            [variantId],
          );
          const variantPlaceholder = generatePlaceholders(
            variant.images.length,
            5,
          );
          await client.query(
            `INSERT INTO product_variant_images (product_variant_id, image, alt_tag, position, type) VALUES ${variantPlaceholder}`,
            variant.images.flatMap((image: any) => [
              variantId,
              image.image,
              image.alt_tag,
              image.position,
              image.type ?? "image",
            ]),
          );
        }

        // Link variant to option values
        for (let i = 0; i < variant.combination.length; i++) {
          const optionName = options[i].name;
          const valueName = variant.combination[i];
          const valueId = valueMap.get(`${optionName}:${valueName}`);

          if (valueId) {
            await client.query(
              "INSERT INTO variant_option_values (variant_id, option_value_id) VALUES ($1, $2)",
              [variantId, valueId],
            );
          }
        }
      }

      // remove the variant which is present in the database of that product but not in the client sent variants list
      await client.query(
        `DELETE FROM product_variants WHERE product_id = $1 AND id NOT IN (${deleteVerientPlaceholder})`,
        [productId, ...varientIds],
      );
    }
  });

  httpResponse(res, 200, "Product Successfully Updated");
});

export const deleteProduct = asyncErrorHandler(async (req, res) => {
  await pool.query("DELETE FROM products WHERE id = $1", [req.params.id]);
  httpResponse(res, 200, "Product successfully removed");
});

export const getSingleProductWithId = asyncErrorHandler(
  async (req: CustomRequest, res) => {
    if (!req.params.product) {
      throw new ErrorHandler(400, "Product slug is required");
    }

    const singleProduct = await getSingleProduct(
      req.params.product,
      req.token_info?.role ?? "User",
    );
    httpResponse(res, 200, "Single Product", singleProduct);
  },
);

export const copyProduct = asyncErrorHandler(async (req, res) => {
  const value = doValidate<{ old_product_id: number }>(VCopyProduct, req.body);

  await doTransition(async (client) => {
    // 1️⃣ Copy product
    const { rowCount, rows } = await client.query(
      `
    INSERT INTO products (
      sku_id,
      name,
      description,
      description_json,
      category_id,
      price,
      compare_at_price,
      available_quantity,
      meta_title,
      meta_description,
      status,
      tags,
      slug,
      sub_category_id,
      product_for
    )
    SELECT
      sku_id || '-copy',
      name || ' (Copy)',
      description,
      description_json,
      category_id,
      price,
      compare_at_price,
      available_quantity,
      meta_title,
      meta_description,
      2,
      tags,
      slug || '-copy',
      sub_category_id,
      product_for
    FROM products
    WHERE id = $1
    RETURNING id
    `,
      [value.old_product_id],
    );

    if (rowCount === 0) throw new ErrorHandler(400, "Unable to copy product");

    const newProductId = rows[0].id;

    // 2️⃣ Copy product images
    await client.query(
      `
    INSERT INTO product_images (image, alt_tag, product_id, position, type)
    SELECT image, alt_tag, $2, position, type
    FROM product_images
    WHERE product_id = $1
    `,
      [value.old_product_id, newProductId],
    );

    // 3️⃣ Copy product options and store mapping
    const optionMap = new Map<number, number>();

    const oldOptions = await client.query(
      `SELECT id, name, position FROM product_options WHERE product_id = $1`,
      [value.old_product_id],
    );

    for (const option of oldOptions.rows) {
      const newOption = await client.query(
        `INSERT INTO product_options (product_id, name, position)
       VALUES ($1, $2, $3)
       RETURNING id`,
        [newProductId, option.name, option.position],
      );

      optionMap.set(option.id, newOption.rows[0].id);
    }

    // 4️⃣ Copy option values
    const valueMap = new Map<number, number>();

    const oldValues = await client.query(
      `SELECT id, option_id, value, position FROM product_option_values
     WHERE option_id = ANY($1::int[])`,
      [[...optionMap.keys()]],
    );

    for (const val of oldValues.rows) {
      const newValue = await client.query(
        `INSERT INTO product_option_values (option_id, value, position)
       VALUES ($1, $2, $3)
       RETURNING id`,
        [optionMap.get(val.option_id), val.value, val.position],
      );

      valueMap.set(val.id, newValue.rows[0].id);
    }

    // 5️⃣ Copy variants
    const variantMap = new Map<number, number>();

    const oldVariants = await client.query(
      `SELECT * FROM product_variants WHERE product_id = $1`,
      [value.old_product_id],
    );

    for (const variant of oldVariants.rows) {
      const newVariant = await client.query(
        `INSERT INTO product_variants
       (product_id, sku, price, compare_at_price, quantity, available)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
        [
          newProductId,
          variant.sku ? variant.sku + "-copy" : null,
          variant.price,
          variant.compare_at_price,
          variant.quantity,
          variant.available,
        ],
      );

      variantMap.set(variant.id, newVariant.rows[0].id);
    }

    // 6️⃣ Copy variant-option relationships
    const oldVariantLinks = await client.query(
      `SELECT variant_id, option_value_id
     FROM variant_option_values
     WHERE variant_id = ANY($1::int[])`,
      [[...variantMap.keys()]],
    );

    for (const link of oldVariantLinks.rows) {
      await client.query(
        `INSERT INTO variant_option_values (variant_id, option_value_id)
       VALUES ($1, $2)`,
        [variantMap.get(link.variant_id), valueMap.get(link.option_value_id)],
      );
    }

    // 7️⃣ Copy variant images
    const oldVariantImages = await client.query(
      `SELECT product_variant_id, image, alt_tag, position, type
     FROM product_variant_images
     WHERE product_variant_id = ANY($1::int[])`,
      [[...variantMap.keys()]],
    );

    for (const img of oldVariantImages.rows) {
      await client.query(
        `INSERT INTO product_variant_images
       (product_variant_id, image, alt_tag, position, type)
       VALUES ($1, $2, $3, $4, $5)`,
        [
          variantMap.get(img.product_variant_id),
          img.image,
          img.alt_tag,
          img.position,
          img.type ?? "image",
        ],
      );
    }
  });

  httpResponse(res, 201, "Product successfully copied and saved in private product list");
});

// sub category tool
export const createNewSubCategory = asyncErrorHandler(async (req, res) => {
  const value = doValidate(VAddSubCategory, req.body ?? {});

  try {
    await pool.query(
      "INSERT INTO sub_categories (category_id, name, slug, image, alt_tag, position) VALUES ($1, $2, $3, $4, $5, $6)",
      [
        value.category_id,
        value.name,
        value.slug,
        value.image,
        value.alt_tag ?? null,
        value.position ?? 0,
      ],
    );

    httpResponse(res, 201, "New sub category successfully created");
  } catch (error) {
    const err = error as DatabaseError;
    if (err.code === "23505" && err.detail?.includes("slug")) {
      throw new ErrorHandler(
        400,
        `"${value.slug}" This slug is already in use. Please choose a different one`,
      );
    }
    throw new ErrorHandler(400, err.message);
  }
});

export const getSubCategoryList = asyncErrorHandler(async (req, res) => {
  const { TO_STRING } = parsePagination(req);

  const { rows } = await pool.query(
    `
    SELECT 
      sc.*,
      c.name AS category
    FROM sub_categories sc

    LEFT JOIN categories c
    ON c.id = sc.category_id

    ORDER BY sc.position ASC, sc.id DESC ${TO_STRING}
    `,
  );

  httpResponse(res, 200, "Sub Category list", rows);
});

export const updateSubCateogry = asyncErrorHandler(async (req, res) => {
  const value = doValidate(VUpdateSubCategory, req.body ?? {});

  try {
    await pool.query(
      "UPDATE sub_categories SET name = $1, slug = $2, image = $3, alt_tag = $4, category_id = $5, position = $6 WHERE id = $7",
      [
        value.name,
        value.slug,
        value.image,
        value.alt_tag ?? null,
        value.category_id,
        value.position ?? 0,
        value.id,
      ],
    );

    httpResponse(res, 200, "Category successfully updated");
  } catch (error) {
    const err = error as DatabaseError;

    if (err.code === "23505" && err.detail?.includes("slug")) {
      throw new ErrorHandler(
        400,
        `"${value.slug}" This slug is already in use. Please choose a different one.`,
      );
    }

    throw new ErrorHandler(400, err.message);
  }
});

export const getSingleSubCategory = asyncErrorHandler(async (req, res) => {
  let filter = "";
  let placeholdernum = 1;
  const filterValues: any[] = [];

  if (req.params.id) {
    if (filter === "") {
      filter = `WHERE sc.id = $${placeholdernum++}`;
    } else {
      filter += ` AND sc.id = $${placeholdernum++}`;
    }

    filterValues.push(req.params.id.toString());
  }

  if (req.query.slug) {
    if (filter === "") {
      filter = `WHERE sc.slug = $${placeholdernum++}`;
    } else {
      filter += ` AND sc.slug = $${placeholdernum++}`;
    }

    filterValues.push(req.query.slug);
  }

  const { rows } = await pool.query(
    `
    SELECT 
     sc.*
    FROM sub_categories sc
    ${filter}
  `,
    filterValues,
  );

  return httpResponse(res, 200, "Single category", rows[0]);
});

export const deleteSingleSubCategory = asyncErrorHandler(async (req, res) => {
  await pool.query("DELETE FROM sub_categories WHERE id = $1", [req.params.id]);
  httpResponse(res, 200, "Category successfully removed");
});

// review
export const createNewReview = asyncErrorHandler(
  async (req: CustomRequest, res) => {
    const value = doValidate(VAddReview, req.body ?? {});

    const userId = req.token_info?.id;
    if (!userId) throw new ErrorHandler(401, "Unauthorize");

    await pool.query(
      "INSERT INTO reviews (user_id, stars, message, product_id, status) VALUES ($1, $2, $3, $4, 2)",
      [userId, value.stars, value.message ?? null, value.product_id],
    );

    httpResponse(res, 201, "Review request successfully sent");
  },
);

export const getReviewList = asyncErrorHandler(
  async (req: CustomRequest, res) => {
    const { TO_STRING } = parsePagination(req);

    let filter = `WHERE 1=1`;
    let placeholder = 1;
    const filterValues: any[] = [];

    if(!checkPermission(req.token_info?.permissions ?? null, ["1-6"])) {
      filter += ` AND r.status = $${placeholder++}`;
      filterValues.push(REVIEW_STATUS_APPROVED);
    }

    if (req.query.product_id) {
      filter += ` AND r.product_id = $${placeholder++}`;
      filterValues.push(req.query.product_id);
    }

    const { rows } = await pool.query(
      `
     SELECT
      r.*,
      u.name AS user_name,
      p.name AS product_name,
      TO_CHAR(r.created_at, 'DD Mon YYYY') AS created_at
     FROM reviews r

     LEFT JOIN users u
     ON u.id = r.user_id

     LEFT JOIN products p
     ON p.id = r.product_id

     ${filter}
     
     ORDER BY r.id DESC

     ${TO_STRING}
    `,
      filterValues,
    );

    httpResponse(res, 200, "Review list", rows);
  },
);

export const updateReviewStatus = asyncErrorHandler(async (req, res) => {
  const value = doValidate(VUpdateReviewStatus, { ...req.params, ...req.body });

  const { rowCount } = await pool.query(
    "UPDATE reviews SET status = $1 WHERE id = $2",
    [value.status, value.id],
  );
  if (rowCount == 0)
    throw new ErrorHandler(500, "Unable to update review status");

  httpResponse(res, 200, "Review status successfully updated");
});

export const deleteReview = asyncErrorHandler(async (req, res) => {
  const value = doValidate(VDeleteReview, req.params ?? {});

  const { rowCount } = await pool.query("DELETE reviews WHERE id = $1", [
    value.id,
  ]);
  if (rowCount == 0) throw new ErrorHandler(500, "Unable to delete review");

  httpResponse(res, 200, "Review successfully removed");
});
