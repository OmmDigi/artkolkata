import { Router } from "express";
import {
  addBlogAuthor,
  createBlog,
  deleteBlog,
  deleteBlogAuthor,
  getBlogAuthorList,
  getBlogList,
  getSingleBlog,
  updateBlog,
  updateBlogAuthor,
} from "../controllers/blog.controller";
import { checkUser } from "../middleware/checkUser";
import { isAuthorizedV2 } from "../middleware/isAuthorizedV2";
import { cacheResponse } from "../middleware/cacheResponse";
import { CACHE_TAGS } from "../services/cache.service";
import { rateLimits } from "../middleware/rateLimits";

export const blogRoutes = Router();

blogRoutes
  .get(
    "/",
    rateLimits.publicRead,
    checkUser,
    cacheResponse({
      tags: [CACHE_TAGS.BLOGS],
      adminPermissions: ["1-14"],
      // a scheduled post goes live on a clock, not on a write, so nothing
      // invalidates the cache at that moment. A short ttl is what bounds how
      // late it can appear.
      ttl: 60,
    }),
    getBlogList,
  )
  .post("/", rateLimits.adminWrite, isAuthorizedV2(["1-14"]), createBlog)
  // authors are declared before "/:id" and "/:blog", otherwise "authors" is
  // read as a slug and never reaches these handlers
  .get(
    "/authors",
    rateLimits.adminWrite,
    isAuthorizedV2(["1-14"]),
    getBlogAuthorList,
  )
  .post(
    "/authors",
    rateLimits.adminWrite,
    isAuthorizedV2(["1-14"]),
    addBlogAuthor,
  )
  .put(
    "/authors/:id",
    rateLimits.adminWrite,
    isAuthorizedV2(["1-14"]),
    updateBlogAuthor,
  )
  .delete(
    "/authors/:id",
    rateLimits.adminWrite,
    isAuthorizedV2(["1-14"]),
    deleteBlogAuthor,
  )
  .put("/:id", rateLimits.adminWrite, isAuthorizedV2(["1-14"]), updateBlog)
  .delete("/:id", rateLimits.adminWrite, isAuthorizedV2(["1-14"]), deleteBlog)
  .get(
    "/:blog",
    rateLimits.publicRead,
    checkUser,
    cacheResponse({
      tags: [CACHE_TAGS.BLOGS],
      adminPermissions: ["1-14"],
      // a scheduled post goes live on a clock, not on a write, so nothing
      // invalidates the cache at that moment. A short ttl is what bounds how
      // late it can appear.
      ttl: 60,
    }),
    getSingleBlog,
  );
