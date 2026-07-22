import { Router } from "express";
import {
  addEnquiry,
  getEnquiry,
  getSiteMapList,
} from "../controllers/website.controller";

export const websiteRoute = Router();

websiteRoute
  .get("/enquiry", getEnquiry)
  .post("/enquiry", addEnquiry)
  .get("/sitemap.xml", getSiteMapList);
