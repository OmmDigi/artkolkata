import { pool } from "..";
import asyncErrorHandler from "../middleware/asyncErrorHandler";
import { CustomRequest } from "../types";
import { doValidate } from "../utils/doValidate";
import { ErrorHandler } from "../utils/ErrorHandler";
import { httpResponse } from "../utils/httpResponse";
import { parsePagination } from "../utils/parsePagination";
import { VCreateBlog, VUpdateBlog } from "../validator/blog.validator";

export const getBlogList = asyncErrorHandler(async (req, res) => {
  const { TO_STRING } = parsePagination(req);

  let filter = "WHERE 1=1";
  const values: any[] = [];
  let placeholder = 1;

  if (req.query.status) {
    filter += ` AND status = $${placeholder++}`;
    values.push(req.query.status as string);
  }

  const { rows } = await pool.query(
    `SELECT
      id, title, slug, excerpt, cover_image, cover_image_alt,
      tags, status, meta_title, meta_description, author_id,
      TO_CHAR(created_at AT TIME ZONE 'Asia/Kolkata', 'DD FMMonth YYYY') AS created_at,
      TO_CHAR(updated_at AT TIME ZONE 'Asia/Kolkata', 'DD FMMonth YYYY') AS updated_at
    FROM blogs
    ${filter}
    ORDER BY created_at DESC
    ${TO_STRING}`,
    values,
  );

  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) FROM blogs ${filter}`,
    values,
  );

  const total = parseInt(countRows[0].count);
  const limit = 10;
  const totalPage = Math.ceil(total / limit);

  httpResponse(res, 200, "Blog list", rows, [], totalPage);
});

export const getSingleBlog = asyncErrorHandler(async (req, res) => {
  const identifier = req.params.blog as string;
  const isId = /^\d+$/.test(identifier);

  const { rows, rowCount } = await pool.query(
    `SELECT * FROM blogs WHERE ${isId ? "id" : "slug"} = $1`,
    [identifier],
  );

  if (rowCount === 0) throw new ErrorHandler(404, "Blog post not found");

  httpResponse(res, 200, "Single blog post", rows[0]);
});

export const createBlog = asyncErrorHandler(async (req: CustomRequest, res) => {
  const value = doValidate(VCreateBlog, req.body ?? {});

  const { rowCount } = await pool.query(
    `INSERT INTO blogs
      (title, slug, excerpt, content_json, cover_image, cover_image_alt, tags, status, meta_title, meta_description, author_id)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (slug) DO NOTHING`,
    [
      value.title,
      value.slug,
      value.excerpt ?? null,
      value.content_json,
      value.cover_image ?? null,
      value.cover_image_alt ?? null,
      value.tags ?? null,
      value.status,
      value.meta_title ?? null,
      value.meta_description ?? null,
      req.token_info?.id ?? null,
    ],
  );

  if (rowCount === 0)
    throw new ErrorHandler(
      400,
      `Slug "${value.slug}" is already in use. Try a different slug.`,
    );

  httpResponse(res, 201, "Blog post created successfully");
});

export const updateBlog = asyncErrorHandler(async (req, res) => {
  const value = doValidate(VUpdateBlog, { ...req.body, ...req.params });

  const { rowCount } = await pool.query(
    `UPDATE blogs SET
      title = $1,
      slug = $2,
      excerpt = $3,
      content_json = $4,
      cover_image = $5,
      cover_image_alt = $6,
      tags = $7,
      status = $8,
      meta_title = $9,
      meta_description = $10,
      updated_at = NOW()
    WHERE id = $11`,
    [
      value.title,
      value.slug,
      value.excerpt ?? null,
      value.content_json,
      value.cover_image ?? null,
      value.cover_image_alt ?? null,
      value.tags ?? null,
      value.status,
      value.meta_title ?? null,
      value.meta_description ?? null,
      value.id,
    ],
  );

  if (rowCount === 0) throw new ErrorHandler(404, "Blog post not found");

  httpResponse(res, 200, "Blog post updated successfully");
});

export const deleteBlog = asyncErrorHandler(async (req, res) => {
  const { rowCount } = await pool.query("DELETE FROM blogs WHERE id = $1", [
    req.params.id,
  ]);

  if (rowCount === 0) throw new ErrorHandler(404, "Blog post not found");

  httpResponse(res, 200, "Blog post deleted successfully");
});
