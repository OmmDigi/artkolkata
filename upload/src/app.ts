import express from "express";
import uploadRoutes from "./routes/upload.routes";
import path from "path";
import { globalErrorController } from "./controllers/error.controller";
import { PUBLIC_FOLDER_NAME } from "./constant";
import dotenv from "dotenv";
import { viewRoute } from "./routes/view.routes";
import cors from "cors";
import { manageRoutes } from "./routes/manage.routes";

// Load environment variables based on NODE_ENV
dotenv.config({
  path: process.env.NODE_ENV === "development" ? ".env.local" : ".env",
});

const app = express();

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:3000", "http://localhost:3001"];

if (process.env.NODE_ENV === "development") {
  app.use(
    cors({
      origin: (_, callback) => {
        callback(null, true); // allow every origin
      },
      credentials: true,
    })
  );
} else {
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || ALLOWED_ORIGINS.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      },
      credentials: true,
    })
  );
}

app.use(express.json());

app.use(
  `/${PUBLIC_FOLDER_NAME}`,
  express.static(path.join(__dirname, `../${PUBLIC_FOLDER_NAME}`))
);

app.get("/", (req, res) => {
  res.send("Ok Upload Server Is Working");
});

app.use("/api/v1/upload", uploadRoutes);
app.use("/api/v1/view", viewRoute);
app.use("/api/v1/manage", manageRoutes);

app.use(globalErrorController);

export default app;
