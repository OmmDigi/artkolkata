import { pool } from "..";
import asyncErrorHandler from "../middleware/asyncErrorHandler";
import { doValidate } from "../utils/doValidate";
import { ErrorHandler } from "../utils/ErrorHandler";
import { fetchAllBlogSlugs } from "../utils/fetchAllBlogSlugs";
import { httpResponse } from "../utils/httpResponse";
import { objectToSqlInsert } from "../utils/objectToSql";
import { parsePagination } from "../utils/parsePagination";
import { sendEmail } from "../utils/sendEmail";
import { VAddEnquiry } from "../validator/website.validator";

//Enquiry
export const addEnquiry = asyncErrorHandler(async (req, res) => {
  const value = doValidate(VAddEnquiry, req.body);

  const { columns, params, values } = objectToSqlInsert(req.body);
  const { rowCount, rows } = await pool.query(
    `INSERT INTO enquiry_form ${columns} VALUES ${params} RETURNING TO_CHAR(created_at, 'DD Month, YYYY') AS created_at`,
    values,
  );

  const sendEmailTo = process.env.SEND_ENQUIRY_TO_EMAIL?.split(",");
  if (sendEmailTo && rowCount !== 0) {
    const dataToSend = {
      timestamp: rows[0].created_at,
      adminName: "Art Kolkata",
      inquiry: {
        message: value?.message,
        name: value.name,
        email: value.email,
        phone: value?.phone,
        business_name: value?.business_name,
        quantity: value?.quantity,
      },
    };
    sendEmail(sendEmailTo, "INQUIRY-FORM", dataToSend).catch((error) => {
      console.log("Unable To Send Inquiry Email To Admin, ERROR : ", error);
    });
  }

  httpResponse(
    res,
    201,
    "Your enquiry has successfully submitted. we will contact you very soon",
  );
});

export const getEnquiry = asyncErrorHandler(async (req, res) => {
  const { LIMIT, OFFSET } = parsePagination(req);
  const { rows } = await pool.query(
    `
    WITH product_info AS (
      SELECT
        p.id,
        p.name,
        JSON_AGG(pi.* ORDER BY pi.position ASC) AS product_images
      FROM products AS p

      LEFT JOIN product_images pi
      ON pi.product_id = p.id AND COALESCE(pi.type, 'image') = 'image'

      GROUP BY p.id
    )
    
    SELECT 
      ef.*,
      pi.name AS product_name,
      pi.product_images,
      TO_CHAR(ef.created_at, 'DD Month, YYYY') AS created_at
     FROM enquiry_form ef

     LEFT JOIN product_info pi
     ON pi.id = ef.product_id

     ORDER BY ef.id DESC 
     LIMIT ${LIMIT} OFFSET ${OFFSET}`,
  );

  httpResponse(res, 200, "Enquiry List", rows);
});

// sitemap
export const getSiteMapList = asyncErrorHandler(async (req, res) => {
  const frontendDomain = process.env.FRONTEND_HOST_URL;

  const productSqlPromise = pool.query(
    "SELECT slug FROM products WHERE product_for = 'both' OR product_for = 'b2c'",
  );

  const [blogs, products] = await Promise.all([
    fetchAllBlogSlugs(),
    productSqlPromise,
  ]);

  let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

  ["", "about-us", "contact-us", "blogs", "our-products", "business"].forEach(
    (slug) => {
      sitemap += `<url><loc>${frontendDomain}/${slug}</loc></url>\n`;
    },
  );

  products.rows.forEach((product: { slug: string }) => {
    const productUrl = `${frontendDomain}/our-products/${product.slug}`;
    sitemap += `<url><loc>${productUrl}</loc></url>\n`;
  });

  blogs.forEach((slug) => {
    const blogUrl = `${frontendDomain}/blogs/${slug}`;
    sitemap += `<url><loc>${blogUrl}</loc></url>\n`;
  });

  sitemap += `</urlset>`;

  res.header("Content-Type", "application/xml");
  res.send(sitemap);
});
