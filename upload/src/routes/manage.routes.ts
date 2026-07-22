import { Router } from "express";
import { deleteFile } from "../controllers/manage.controller";

export const manageRoutes = Router();

manageRoutes.delete("/delete", deleteFile)