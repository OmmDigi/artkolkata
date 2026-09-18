import { Router } from "express";
import {
  viewPngVariant,
  viewPrivateFile,
} from "../controllers/view.controller";

export const viewRoute = Router();

viewRoute.get("/private/*", viewPrivateFile)

// public, like the folder it reads from
viewRoute.get("/png/*", viewPngVariant)
