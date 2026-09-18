import { PoolClient } from "pg";
import { IProducts, IVarients } from "../types";
import { doTransition } from "./doTransition";
import { ErrorHandler } from "./ErrorHandler";

export const calcluteCartAmounts = async (
  varient_ids: { id: number; quantity: number }[],
  product_ids: { id: number; quantity: number }[],
  discount_code?: string,
  client?: PoolClient
) => {
  let priceAfterDiscount = 0;
  let couponDiscount = 0;
  let subTotal = 0;

  let varientsInfo: IVarients[] = [];
  let productsInfo: IProducts[] = [];

  await doTransition(async (client) => {
    // cart value the coupon is allowed to discount. same as subTotal for a
    // normal coupon, only the matching items when the coupon targets categories
    let eligibleAmount = 0;
    let discountCategoryList: string[] = [];
    let minAmountToSelect: string = "0";
    let discountType = "";
    let discountTypeValue = "";

    if (discount_code) {
      const { rows, rowCount } = await client.query(
        `
       SELECT *
        FROM discount
        WHERE code = $1 
          AND status = 'active'
          AND starts_at <= NOW()
          AND ends_at >= NOW();
      `,
        [discount_code]
      );

      if (rowCount === 0) throw new ErrorHandler(400, "Invalid coupon");

      minAmountToSelect = rows[0].min_amount_to_select;

      discountCategoryList = (rows[0].target_ids?.split(",") as string[]) ?? [];

      discountType = rows[0].type;
      discountTypeValue = rows[0].value;
    }

    if (varient_ids.length === 0 && product_ids.length === 0)
      throw new ErrorHandler(400, "Please choose product first");

    if (varient_ids.length !== 0) {
      const varientPlaceholders = varient_ids
        .map((_, index) => `$${index + 1}`)
        .join(",");
      const varients = await client.query<IVarients>(
        `SELECT
            pv.id,
            pv.product_id,
            pv.sku,
            pv.quantity,
            pv.price,
            p.name AS product_name,
            p.category_id AS product_category_id,
            p.name AS product_name,
            -- snapshotted into variant_info so an order line can be linked back
            -- to its product page
            p.slug AS product_slug,
            p.weight_kg,
            p.length_cm,
            p.breadth_cm,
            p.height_cm,
            COALESCE(JSON_AGG(pvi ORDER BY pvi.position ASC) FILTER (WHERE pvi.product_variant_id IS NOT NULL AND COALESCE(pvi.type, 'image') = 'image'), '[]'::json) AS images
           FROM product_variants pv
  
           LEFT JOIN products p
           ON p.id = pv.product_id

           LEFT JOIN product_variant_images pvi
           ON pvi.product_variant_id = pv.id

           WHERE pv.id IN (${varientPlaceholders})

           GROUP BY pv.id, p.id
           
           `,
        varient_ids.flatMap((item) => [item.id])
      );

      varientsInfo = varients.rows;

      for (const varient of varients.rows) {
        let indexOf = -1;
        const userRequireQuanity = varient_ids.find((item, index) => {
          if (item.id == varient.id) {
            indexOf = index;
            return true;
          }
          return false;
        })?.quantity;
        if (!userRequireQuanity)
          throw new ErrorHandler(400, "Unable to find the varient id");

        if (userRequireQuanity > varient.quantity)
          throw new ErrorHandler(
            400,
            `${varient.product_name}(${varient.sku}) quantity not avilable`,
            [{ varient_id: varient.id }]
          );

        subTotal += (parseFloat(varient.price) * userRequireQuanity);

        if (discountCategoryList.length == 0) {
          eligibleAmount += (parseFloat(varient.price) * userRequireQuanity);
          continue;
        }

        const result = discountCategoryList.find(
          (disCat) => disCat == varient.product_category_id.toString()
        );
        if (result != undefined) {
          eligibleAmount += (parseFloat(varient.price) * userRequireQuanity);
        }
      }
    }

    if (product_ids.length !== 0) {
      const productPlaceholers = product_ids
        .map((_, index) => `$${index + 1}`)
        .join(",");
      const products = await client.query<IProducts>(
        `
          SELECT
            p.sku_id,
            p.id,
            p.name,
            p.price,
            p.available_quantity,
            p.slug,
            p.category_id,
            p.weight_kg,
            p.length_cm,
            p.breadth_cm,
            p.height_cm,
            COALESCE(JSON_AGG(pi) FILTER (WHERE pi.id IS NOT NULL), '[]'::json) AS images
          FROM products p

          LEFT JOIN product_images pi
          ON pi.product_id = p.id

          WHERE p.id IN (${productPlaceholers})

          GROUP BY p.id
          
          `,
        product_ids.flatMap((item) => [item.id])
      );

      productsInfo = products.rows;

      for (const product of products.rows) {
        let indexOf = -1;
        const userRequireQuanity = product_ids.find((item, index) => {
          if (item.id == product.id) {
            indexOf = index;
            return true;
          }
          return false;
        })?.quantity;

        if (!userRequireQuanity)
          throw new ErrorHandler(400, "Unable to find the product id");

        if (userRequireQuanity > product.available_quantity)
          throw new ErrorHandler(
            400,
            `${product.name}(${product.sku_id}) quantity not avilable`,
            [{ product_id: product.id }]
          );

        subTotal += (parseFloat(product.price) * userRequireQuanity);

        if (discountCategoryList.length == 0) {
          eligibleAmount += (parseFloat(product.price) * userRequireQuanity);
          continue;
        }

        const result = discountCategoryList.find(
          (disCat) => disCat == product.category_id.toString()
        );
        if (result != undefined) {
          eligibleAmount += (parseFloat(product.price) * userRequireQuanity);
        }
      }
    }

    // ------------------------------------------------------------
    // COMBO CONTENTS
    //
    // A combo is an ordinary product that also ships other products inside it.
    // Two things need to know that here, and both need it before the order row
    // is written:
    //
    //  - the contents are attached to the item below and travel into
    //    order_items.product_info / variant_info with everything else. Frozen,
    //    on purpose: the packing slip printed next month must list what the
    //    combo held on the day it sold, not what it holds now, and the stock
    //    put back by a cancellation must be the stock that was taken.
    //
    //  - selling a combo consumes its children, so their stock is checked here.
    //    Demand is summed across the whole cart first — two different combos
    //    can contain the same lip balm, and a customer can have that lip balm
    //    in the cart on its own as well. Checking each line separately would
    //    wave through a cart that empties the shelf between them.
    // ------------------------------------------------------------
    const parentProductIds = [
      ...new Set([
        ...varientsInfo.map((item) => item.product_id),
        ...productsInfo.map((item) => item.id),
      ]),
    ];

    if (parentProductIds.length !== 0) {
      const { rows: bundleRows } = await client.query(
        `
         SELECT
          b.parent_product_id,
          b.child_product_id,
          b.child_variant_id,
          b.quantity,
          cp.name AS product_name,
          cp.available_quantity AS product_available_quantity,
          cp.sku_id AS product_sku,
          cv.sku AS variant_sku,
          cv.quantity AS variant_available_quantity,
          (
            SELECT STRING_AGG(pov.value, ' / ' ORDER BY po.position ASC)
            FROM variant_option_values vov
            JOIN product_option_values pov ON pov.id = vov.option_value_id
            JOIN product_options po ON po.id = pov.option_id
            WHERE vov.variant_id = cv.id
          ) AS variant_label
         FROM product_bundle_items b
         JOIN products cp ON cp.id = b.child_product_id
         LEFT JOIN product_variants cv ON cv.id = b.child_variant_id
         WHERE b.parent_product_id = ANY($1::int[])
         ORDER BY b.position ASC, b.id ASC
        `,
        [parentProductIds],
      );

      if (bundleRows.length !== 0) {
        const bundlesByParent = new Map<number, any[]>();
        for (const row of bundleRows) {
          const list = bundlesByParent.get(row.parent_product_id) ?? [];
          list.push(row);
          bundlesByParent.set(row.parent_product_id, list);
        }

        // a child is identified the same way an order line is: a variant when
        // one was chosen, otherwise the product itself
        const keyOf = (productId: number, variantId: number | null) =>
          variantId == null ? `p:${productId}` : `v:${variantId}`;

        const demand = new Map<
          string,
          { label: string; required: number; available: number }
        >();

        const addDemand = (
          key: string,
          label: string,
          available: number,
          quantity: number,
        ) => {
          const existing = demand.get(key);
          if (existing) {
            existing.required += quantity;
            return;
          }
          demand.set(key, { label, required: quantity, available });
        };

        // what the cart already takes off the shelf on its own, so a combo
        // cannot be sold out of stock its own cart has spoken for
        for (const varient of varient_ids) {
          const info = varientsInfo.find((item) => item.id == varient.id);
          if (!info) continue;
          addDemand(
            keyOf(info.product_id, info.id),
            `${info.product_name}${info.sku ? ` (${info.sku})` : ""}`,
            Number(info.quantity),
            varient.quantity,
          );
        }

        for (const product of product_ids) {
          const info = productsInfo.find((item) => item.id == product.id);
          if (!info) continue;
          addDemand(
            keyOf(info.id, null),
            info.name,
            Number(info.available_quantity),
            product.quantity,
          );
        }

        // then what the combos in the cart take
        const attachBundle = (
          parentProductId: number,
          orderedQuantity: number,
        ) => {
          const rows = bundlesByParent.get(parentProductId);
          if (!rows) return [];

          return rows.map((row: any) => {
            const isVariant = row.child_variant_id != null;
            const available = Number(
              isVariant
                ? row.variant_available_quantity
                : row.product_available_quantity,
            );
            const sku = (isVariant ? row.variant_sku : row.product_sku) ?? null;
            const label = `${row.product_name}${
              row.variant_label ? ` (${row.variant_label})` : ""
            }`;

            addDemand(
              keyOf(row.child_product_id, row.child_variant_id),
              label,
              available,
              row.quantity * orderedQuantity,
            );

            // the snapshot that rides along on the order line
            return {
              product_id: row.child_product_id,
              variant_id: row.child_variant_id,
              quantity: row.quantity,
              name: row.product_name,
              variant_label: row.variant_label ?? null,
              sku,
            };
          });
        };

        for (const varient of varient_ids) {
          const info = varientsInfo.find((item) => item.id == varient.id);
          if (!info) continue;
          (info as any).bundle_items = attachBundle(
            info.product_id,
            varient.quantity,
          );
        }

        for (const product of product_ids) {
          const info = productsInfo.find((item) => item.id == product.id);
          if (!info) continue;
          (info as any).bundle_items = attachBundle(info.id, product.quantity);
        }

        for (const item of demand.values()) {
          if (item.required > item.available)
            throw new ErrorHandler(
              400,
              `${item.label} quantity not avilable`,
            );
        }
      }
    }

    if (discount_code) {
      // a category coupon with nothing matching in the cart discounts nothing
      if (discountCategoryList.length !== 0 && eligibleAmount === 0) {
        throw new ErrorHandler(
          400,
          "This coupon is not valid for the products in your cart"
        );
      }

      // if the total varient price is < discount minium price throw error
      const discountMinPrice = parseFloat(minAmountToSelect);
      if (eligibleAmount < discountMinPrice) {
        throw new ErrorHandler(
          400,
          `You have to purchase product of minimum ₹${discountMinPrice}`
        );
      }

      // now check if the discount is percentage base of not if yes give percentage amount
      const value = parseFloat(discountTypeValue);
      const discountValue = Number.isFinite(value) ? value : 0;

      if (discountType === "percentage") {
        couponDiscount = (discountValue / 100) * eligibleAmount;
      } else {
        couponDiscount = discountValue;
      }

      // the coupon only ever eats into the items it applies to, the rest of the
      // cart is still charged in full
      couponDiscount = parseFloat(
        Math.min(Math.max(couponDiscount, 0), eligibleAmount).toFixed(2)
      );
    }

    priceAfterDiscount = parseFloat((subTotal - couponDiscount).toFixed(2));
  }, client);

  return {
    subTotal,
    priceAfterDiscount,
    couponDiscount,
    varientsInfo,
    productsInfo,
  };
};
