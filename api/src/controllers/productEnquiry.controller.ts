import { pool } from "..";
import asyncErrorHandler from "../middleware/asyncErrorHandler";
import { normalizeIndianPhone } from "../services/sms";
import { doValidate } from "../utils/doValidate";
import { ErrorHandler } from "../utils/ErrorHandler";
import { httpResponse } from "../utils/httpResponse";
import logger from "../utils/logger";
import { parsePagination } from "../utils/parsePagination";
import { sendEmail } from "../utils/sendEmail";
import {
  PRODUCT_ENQUIRY_TYPE_LABELS,
  TProductEnquiryStatus,
  TProductEnquiryType,
  VAddProductEnquiry,
  VProductEnquiryFilters,
  VProductEnquiryId,
  VProductEnquiryStatus,
} from "../validator/website.validator";

// An empty string from the form is "not set", not a value worth storing.
const orNull = (value?: string | null) =>
  value === undefined || value === null || value.trim() === ""
    ? null
    : value.trim();

// the date staff read in the CMS and in the email, in India time
const RECEIVED_AT_LABEL = `TO_CHAR(pe.created_at AT TIME ZONE 'Asia/Kolkata', 'DD Mon YYYY, HH12:MI AM')`;

// LIKE treats % and _ as wildcards; a search for "50%" must match the text "50%"
const escapeLike = (text: string) => text.replace(/[\\%_]/g, "\\$&");

/** public: the storefront's "enquire about a product" form */
export const addProductEnquiry = asyncErrorHandler(async (req, res) => {
  const value = doValidate<{
    name: string;
    phone: string;
    enquiry_type: TProductEnquiryType;
    category_id: number;
    quantity?: string | null;
    message?: string | null;
  }>(VAddProductEnquiry, req.body ?? {});

  const phone = normalizeIndianPhone(value.phone);
  if (!phone) {
    throw new ErrorHandler(400, "Please enter a valid 10-digit mobile number", [
      "phone",
    ]);
  }

  // inserting from the categories table checks the category exists and takes
  // a snapshot of its name in the same statement
  const { rows } = await pool.query<{
    id: number;
    category_name: string;
    received_at: string;
  }>(
    `INSERT INTO product_enquiries (name, phone, category_id, category_name, quantity, message, enquiry_type)
     SELECT $1, $2, c.id, c.name, $4, $5, $6
     FROM categories c
     WHERE c.id = $3
     RETURNING id, category_name,
       TO_CHAR(created_at AT TIME ZONE 'Asia/Kolkata', 'DD Mon YYYY, HH12:MI AM') AS received_at`,
    [
      value.name,
      phone,
      value.category_id,
      orNull(value.quantity),
      orNull(value.message),
      value.enquiry_type,
    ],
  );

  if (rows.length === 0) {
    throw new ErrorHandler(400, "Please choose a valid product category", [
      "category_id",
    ]);
  }

  const sendTo = (process.env.SEND_ENQUIRY_TO_EMAIL ?? "")
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean);

  if (sendTo.length > 0) {
    const cmsHost = (process.env.CMS_HOST_URL ?? "").replace(/\/+$/, "");
    // not awaited: the customer should not wait on the mail server, and a
    // failed alert must not fail an enquiry that is already saved
    sendEmail(sendTo, "PRODUCT-ENQUIRY", {
      timestamp: rows[0].received_at,
      cmsUrl: cmsHost ? `${cmsHost}/contact-list?tab=product` : "",
      enquiry: {
        name: value.name,
        phone,
        type: PRODUCT_ENQUIRY_TYPE_LABELS[value.enquiry_type],
        category: rows[0].category_name,
        quantity: orNull(value.quantity),
        message: orNull(value.message),
      },
    }).then((result) => {
      if (!result.ok) {
        logger.error({
          message: "Product enquiry saved but the alert email failed",
          enquiryId: rows[0].id,
        });
      }
    });
  }

  httpResponse(
    res,
    201,
    "Thank you! We have received your enquiry and will contact you soon.",
  );
});

/** CMS: newest first, filtered by status, type, category and a name or phone search */
export const getProductEnquiries = asyncErrorHandler(async (req, res) => {
  const filters = doValidate<{
    status?: TProductEnquiryStatus | "";
    enquiry_type?: TProductEnquiryType | "";
    category_id?: number | "";
    search?: string;
  }>(
    VProductEnquiryFilters,
    {
      status: req.query.status,
      enquiry_type: req.query.enquiry_type,
      category_id: req.query.category_id,
      search: req.query.search,
    },
    { stripUnknown: true },
  );

  const where: string[] = [];
  const params: unknown[] = [];

  if (filters.status) {
    params.push(filters.status);
    where.push(`pe.status = $${params.length}`);
  }

  if (filters.enquiry_type) {
    params.push(filters.enquiry_type);
    where.push(`pe.enquiry_type = $${params.length}`);
  }

  if (filters.category_id) {
    params.push(filters.category_id);
    where.push(`pe.category_id = $${params.length}`);
  }

  if (filters.search) {
    params.push(`%${escapeLike(filters.search)}%`);
    const nameMatch = `pe.name ILIKE $${params.length}`;

    // phones are stored as 10 digits without the country code, so "+91 98765"
    // is searched as "98765" and "09876543210" as its last 10 digits
    let digits = filters.search.replace(/\D/g, "");
    if (/^\s*\+\s*91/.test(filters.search)) digits = digits.slice(2);
    else if (digits.length > 10) digits = digits.slice(-10);
    if (digits) {
      params.push(`%${digits}%`);
      where.push(`(${nameMatch} OR pe.phone LIKE $${params.length})`);
    } else {
      where.push(nameMatch);
    }
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const { LIMIT, OFFSET } = parsePagination(req);
  const pageSql = LIMIT === "" ? "" : `LIMIT ${LIMIT} OFFSET ${OFFSET}`;

  const [list, count] = await Promise.all([
    pool.query(
      `SELECT pe.id, pe.name, pe.phone, pe.enquiry_type, pe.category_id,
              -- the category's current name, or the snapshot once it is deleted
              COALESCE(c.name, pe.category_name) AS category_name,
              pe.quantity, pe.message, pe.status,
              pe.created_at, pe.updated_at,
              ${RECEIVED_AT_LABEL} AS received_at
       FROM product_enquiries pe
       LEFT JOIN categories c ON c.id = pe.category_id
       ${whereSql}
       ORDER BY pe.id DESC
       ${pageSql}`,
      params,
    ),
    pool.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM product_enquiries pe ${whereSql}`,
      params,
    ),
  ]);

  const total = count.rows[0]?.total ?? 0;
  const totalPage = LIMIT === "" ? 1 : Math.ceil(total / Number(LIMIT));

  httpResponse(res, 200, "Product enquiry list", list.rows, [], totalPage);
});

/** CMS: new -> contacted -> closed, in any direction */
export const updateProductEnquiryStatus = asyncErrorHandler(async (req, res) => {
  const value = doValidate<{ id: number; status: TProductEnquiryStatus }>(
    VProductEnquiryStatus,
    { id: req.params.id, status: req.body?.status },
  );

  const { rowCount } = await pool.query(
    `UPDATE product_enquiries SET status = $1, updated_at = NOW() WHERE id = $2`,
    [value.status, value.id],
  );

  if (!rowCount) throw new ErrorHandler(404, "No enquiry found with this id");

  httpResponse(res, 200, "Enquiry status has been updated");
});

/** CMS: for spam and test entries */
export const deleteProductEnquiry = asyncErrorHandler(async (req, res) => {
  const { id } = doValidate<{ id: number }>(VProductEnquiryId, {
    id: req.params.id,
  });

  const { rowCount } = await pool.query(
    `DELETE FROM product_enquiries WHERE id = $1`,
    [id],
  );

  if (!rowCount) throw new ErrorHandler(404, "No enquiry found with this id");

  httpResponse(res, 200, "Enquiry has been deleted");
});
