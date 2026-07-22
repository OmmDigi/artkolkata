import { Router } from "express";
import { checkServiceability } from "../controllers/shipping.controller";

export const shippingRoutes = Router();

shippingRoutes.get("/check-serviceability", checkServiceability);
