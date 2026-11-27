import { Router } from "express";
import { upload, uploadSingleVideo } from "../middleware/upload";
import {
  uploadMultipleFile,
  uploadSingleFile,
} from "../controllers/upload.controller";

const router = Router();

router.post("/single", upload.single("file"), uploadSingleFile);

router.post("/multiple", upload.array("files", 5), uploadMultipleFile);

// a video is not an image, so uploadSingleFile stores it as is with no variants
router.post("/video", uploadSingleVideo, uploadSingleFile);

export default router;
