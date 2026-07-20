import { Router } from "express";
import { upload } from "../middleware/upload";
import {
  uploadMultipleFile,
  uploadSingleFile,
} from "../controllers/upload.controller";

const router = Router();

router.post("/single", upload.single("file"), uploadSingleFile);

router.post("/multiple", upload.array("files", 10), uploadMultipleFile);

export default router;
