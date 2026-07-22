import { Router } from "express";
import {
  createBlog,
  deleteBlog,
  getBlogList,
  getSingleBlog,
  updateBlog,
} from "../controllers/blog.controller";
import { checkUser } from "../middleware/checkUser";
import { isAuthorizedV2 } from "../middleware/isAuthorizedV2";

export const blogRoutes = Router();

blogRoutes
  .get("/", checkUser, getBlogList)
  .post("/", isAuthorizedV2(["1-14"]), createBlog)
  .put("/:id", isAuthorizedV2(["1-14"]), updateBlog)
  .delete("/:id", isAuthorizedV2(["1-14"]), deleteBlog)
  .get("/:blog", checkUser, getSingleBlog);
