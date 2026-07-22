import { Router } from "express";
import { getSettings, saveSettings } from "../controllers/settings.controller";
import { isAuthorizedV2 } from "../middleware/isAuthorizedV2";

export const settingsRoute = Router();

settingsRoute
  .get("/", getSettings)
  .post("/", isAuthorizedV2(["1-1"]), saveSettings);
