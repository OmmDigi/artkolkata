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
  let subTotal = 0;

  let varientsInfo: IVarients[] = [];
  let productsInfo: IProducts[] = [];

  await doTransition(async (client) => {
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
            COALESCE(JSON_AGG(pvi) FILTER (WHERE pvi.product_variant_id IS NOT NULL), '[]'::json) AS images
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
          priceAfterDiscount += (parseFloat(varient.price) * userRequireQuanity);
          continue;
        }

        const result = discountCategoryList.find(
          (disCat) => disCat == varient.product_category_id.toString()
        );
        if (result != undefined) {
          priceAfterDiscount += (parseFloat(varient.price) * userRequireQuanity);
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
          priceAfterDiscount += (parseFloat(product.price) * userRequireQuanity);
          continue;
        }

        const result = discountCategoryList.find(
          (disCat) => disCat == product.category_id.toString()
        );
        if (result != undefined) {
          priceAfterDiscount += (parseFloat(product.price) * userRequireQuanity);
        }
      }
    }

    if (discount_code) {
      // if the total varient price is < discount minium price throw error
      const discountMinPrice = parseFloat(minAmountToSelect);
      if (priceAfterDiscount < discountMinPrice) {
        throw new ErrorHandler(
          400,
          `You have to purchase product of minimum ₹${discountMinPrice}`
        );
      }

      // now check if the discount is percentage base of not if yes give percentage amount
      if (discountType === "percentage") {
        const amountToCut =
          (parseInt(discountTypeValue) / 100) * priceAfterDiscount;
        priceAfterDiscount -= amountToCut;
      } else {
        priceAfterDiscount -= parseFloat(discountTypeValue);
      }
    }
  }, client);

  return {
    subTotal,
    priceAfterDiscount,
    varientsInfo,
    productsInfo,
  };
};
