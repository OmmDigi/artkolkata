import { Router } from "express";
import { viewPrivateFile } from "../controllers/view.controller";

export const viewRoute = Router();

viewRoute.get("/private/*", viewPrivateFile)