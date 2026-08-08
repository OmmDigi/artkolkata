import { pool } from "..";
import asyncErrorHandler from "../middleware/asyncErrorHandler";
import { CustomRequest } from "../types";
import { calcluteCartAmounts } from "../utils/calcluteCartAmounts";
import { calculateAutoDiscount } from "../utils/calculateAutoDiscount";
import { checkPermission } from "../utils/checkPermissions";
import { doValidate } from "../utils/doValidate";
import { ErrorHandler } from "../utils/ErrorHandler";
import { httpResponse } from "../utils/httpResponse";
import { parsePagination } from "../utils/parsePagination";
import { toIst } from "../utils/toIst";
import {
  VCreateAutoDiscountRule,
  VCreateDiscount,
  VUpdateAutoDiscountRule,
  VUpdateDiscount,
  VValidateDiscount,
} from "../validator/discount.validator";

export const deleteDiscount = asyncErrorHandler(async (req, res) => {
  await pool.query("DELETE FROM discount WHERE id = $1", [req.params.id]);
  httpResponse(res, 200, "Coupon successfully removed");
});

export const getDiscountList = asyncErrorHandler(async (req : CustomRequest, res) => {
  const { TO_STRING } = parsePagination(req);

  let filter = "WHERE 1=1";
  // let placeholder = 1;
  // const filterValues : string[] = [];

  if(!checkPermission(req.token_info?.permissions ?? null, ["1-4"])) {
    filter += ` AND ends_at > (NOW() AT TIME ZONE 'Asia/Kolkata') AND status = 'active'`
  }

  const { rows } = await pool.query(
    `
    SELECT 
      *, 
      TO_CHAR(ends_at AT TIME ZONE 'Asia/Kolkata', 'DD FMMonth YYYY HH12:MIam') AS expire_at
    FROM discount
    ${filter}

    ${TO_STRING}
    `
  );

  httpResponse(res, 200, "Discount coupon list", rows);
});

export const createDiscount = asyncErrorHandler(async (req, res) => {
  const value = doValidate(VCreateDiscount, req.body ?? {});

  const { rowCount } = await pool.query(
    `
    INSERT INTO discount 
      (code, title, type, value, status, starts_at, ends_at, condition_type, target_ids)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (code) DO NOTHING
  `,
    [
      value.code,
      value.title,
      value.type,
      value.value,
      value.status,
      toIst(value.starts_at),
      toIst(value.ends_at),
      value?.categories ? "categories" : null,
      value?.categories ?? null,
    ]
  );

  if (rowCount === 0)
    throw new ErrorHandler(
      400,
      `This code ${value.code} is already being used please try another one`
    );

  httpResponse(res, 201, "New discount offer has successfully created");
});

export const validateDiscount = asyncErrorHandler(async (req, res) => {
  const value = doValidate<{
    code: string;
    varient_ids: { id: number; quantity: number }[];
    product_ids: { id: number; quantity: number }[];
  }>(VValidateDiscount, req.body ?? {});

  const { priceAfterDiscount, couponDiscount, subTotal } =
    await calcluteCartAmounts(value.varient_ids, value.product_ids, value.code);

  // the automatic rule is quoted on top of the coupon so the cart shows the
  // same numbers the order will be created with
  const autoDiscount = await calculateAutoDiscount(priceAfterDiscount, true);

  httpResponse(res, 200, "Discount applied successfully", {
    subTotal,
    priceAfterDiscount: parseFloat(
      (priceAfterDiscount - autoDiscount.amount).toFixed(2)
    ),
    coupon_discount: couponDiscount,
    auto_discount: autoDiscount.amount,
    auto_discount_rule: autoDiscount.rule,
  });
});

export const getSingleDiscount = asyncErrorHandler(async (req, res) => {
  const { rows, rowCount } = await pool.query(
    `SELECT 
      *, 
      TO_CHAR(ends_at AT TIME ZONE 'Asia/Kolkata', 'DD FMMonth YYYY HH12:MIam') AS expire_at,
      TO_CHAR(starts_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI') AS starts_at,
      TO_CHAR(ends_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI') AS ends_at
      FROM discount WHERE id = $1`,
    [req.params.id]
  );
  if (rowCount === 0) throw new ErrorHandler(404, "No coupon found");

  rows[0][rows[0].condition_type] = rows[0].target_ids?.split(",");
  httpResponse(res, 200, "Single Discount coupon", rows[0]);
});

/* -------------------------------------------------------------------------- */
/*                   Automatic discounts (no coupon code)                     */
/* -------------------------------------------------------------------------- */

// blank date input means "no boundary", stored as NULL
const toIstOrNull = (dateString?: string | null) =>
  dateString ? toIst(dateString) : null;

const emptyToNull = (value?: number | string | null) =>
  value === "" || value === null || value === undefined ? null : value;

export const getAutoDiscountRules = asyncErrorHandler(
  async (req: CustomRequest, res) => {
    // storefront only sees the rules that are live right now, the CMS sees all
    const isAdmin = checkPermission(req.token_info?.permissions ?? null, ["1-4"]);

    const { rows } = await pool.query(
      `
      SELECT
        *,
        TO_CHAR(starts_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI') AS starts_at,
        TO_CHAR(ends_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI') AS ends_at
      FROM auto_discount_rules
      ${
        isAdmin
          ? ""
          : `WHERE status = 'active'
               AND (starts_at IS NULL OR starts_at <= NOW())
               AND (ends_at IS NULL OR ends_at >= NOW())`
      }
      ORDER BY priority DESC, min_order_amount ASC, id ASC
      `
    );

    httpResponse(res, 200, "Automatic discount rules", rows);
  }
);

export const getSingleAutoDiscountRule = asyncErrorHandler(async (req, res) => {
  const { rows, rowCount } = await pool.query(
    `
    SELECT
      *,
      TO_CHAR(starts_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI') AS starts_at,
      TO_CHAR(ends_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI') AS ends_at
    FROM auto_discount_rules
    WHERE id = $1
    `,
    [req.params.id]
  );

  if (rowCount === 0) throw new ErrorHandler(404, "No automatic discount found");

  httpResponse(res, 200, "Single automatic discount rule", rows[0]);
});

export const createAutoDiscountRule = asyncErrorHandler(async (req, res) => {
  const value = doValidate(VCreateAutoDiscountRule, req.body ?? {});

  const { rows } = await pool.query(
    `
    INSERT INTO auto_discount_rules
      (title, min_order_amount, type, value, max_discount_amount,
       stackable_with_coupon, status, priority, starts_at, ends_at)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING id
    `,
    [
      value.title,
      value.min_order_amount,
      value.type,
      value.value,
      emptyToNull(value.max_discount_amount),
      value.stackable_with_coupon,
      value.status,
      value.priority,
      toIstOrNull(value.starts_at),
      toIstOrNull(value.ends_at),
    ]
  );

  httpResponse(res, 201, "New automatic discount has been created", rows[0]);
});

export const updateAutoDiscountRule = asyncErrorHandler(async (req, res) => {
  const value = doValidate(VUpdateAutoDiscountRule, {
    ...req.body,
    ...req.params,
  });

  const { rowCount } = await pool.query(
    `
    UPDATE auto_discount_rules SET
      title = $1,
      min_order_amount = $2,
      type = $3,
      value = $4,
      max_discount_amount = $5,
      stackable_with_coupon = $6,
      status = $7,
      priority = $8,
      starts_at = $9,
      ends_at = $10,
      updated_at = NOW()
    WHERE id = $11
    `,
    [
      value.title,
      value.min_order_amount,
      value.type,
      value.value,
      emptyToNull(value.max_discount_amount),
      value.stackable_with_coupon,
      value.status,
      value.priority,
      toIstOrNull(value.starts_at),
      toIstOrNull(value.ends_at),
      value.id,
    ]
  );

  if (rowCount === 0) throw new ErrorHandler(404, "No automatic discount found");

  httpResponse(res, 200, "Automatic discount has been updated");
});

export const deleteAutoDiscountRule = asyncErrorHandler(async (req, res) => {
  const { rowCount } = await pool.query(
    "DELETE FROM auto_discount_rules WHERE id = $1",
    [req.params.id]
  );

  if (rowCount === 0) throw new ErrorHandler(404, "No automatic discount found");

  httpResponse(res, 200, "Automatic discount has been removed");
});

export const updateDiscount = asyncErrorHandler(async (req, res) => {
  const value = doValidate(VUpdateDiscount, { ...req.body, ...req.params });

  await pool.query(
    `UPDATE discount SET 
      code = $1, 
      title = $2, 
      type = $3, 
      value = $4, 
      min_amount_to_select = $5, 
      starts_at = $6, 
      ends_at = $7, 
      status = $8, 
      condition_type = $9, 
      target_ids = $10 
    WHERE id = $11`,
    [
      value.code,
      value.title,
      value.type,
      value.value,
      value.min_amount_to_select,
      toIst(value.starts_at),
      toIst(value.ends_at),
      value.status,
      value?.categories ? "categories" : null,
      value?.categories ?? null,
      value.id,
    ]
  );

  httpResponse(res, 200, "Update single discount info");
});
