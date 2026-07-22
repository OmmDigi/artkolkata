import { pool } from "..";
import asyncErrorHandler from "../middleware/asyncErrorHandler";
import { CustomRequest } from "../types";
import { calcluteCartAmounts } from "../utils/calcluteCartAmounts";
import { checkPermission } from "../utils/checkPermissions";
import { doValidate } from "../utils/doValidate";
import { ErrorHandler } from "../utils/ErrorHandler";
import { httpResponse } from "../utils/httpResponse";
import { parsePagination } from "../utils/parsePagination";
import { toIst } from "../utils/toIst";
import {
  VCreateDiscount,
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

  const { priceAfterDiscount, subTotal } = await calcluteCartAmounts(
    value.varient_ids,
    value.product_ids,
    value.code
  );

  httpResponse(res, 200, "Discount applied successfully", {
    subTotal,
    priceAfterDiscount,
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
