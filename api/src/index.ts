import cookieParser from "cookie-parser";
import express from "express";
import { userRoute } from "./routes/user.routes";
import { globalErrorController } from "./controllers/error.controller";
import { Pool } from "pg";
import { configDb, createAdminUser } from "./config/db";
import path from "path";
import cors from "cors";
import fs from "fs";
import { mediaItem } from "./routes/media.routes";
import { productRoute } from "./routes/product.routes";
import { discountRoute } from "./routes/discount.routes";
import { orderRoutes } from "./routes/orders.routes";
import { paymentRoute } from "./routes/payment.routes";
import { webHookRoutes } from "./routes/webhook.routes";
import asyncErrorHandler from "./middleware/asyncErrorHandler";
import { ErrorHandler } from "./utils/ErrorHandler";
import { encrypt } from "./services/crypto";
import { websiteRoute } from "./routes/website.routes";
import { settingsRoute } from "./routes/settings.routes";
import { shippingRoutes } from "./routes/shipping.routes";
import { blogRoutes } from "./routes/blog.routes";
import { wishlistRoutes } from "./routes/wishlist.routes";
import { analyticsRoutes } from "./routes/analytics.routes";
import { initEmailProvider, supportEmail } from "./services/email";
import { rateLimits } from "./middleware/rateLimits";
import { initPaymentGateway } from "./services/payment";
import { initShippingPartner } from "./services/shipping";
import { loadEnv } from "./utils/loadEnv";

// Load environment variables based on NODE_ENV
loadEnv();

/**
 * Stand the payment gateway up once, here, right after dotenv — every call
 * site then reads the same object through getPaymentGateway(). A missing or
 * misspelt credential throws now, at boot, instead of at the moment a customer
 * tries to pay.
 */
initPaymentGateway();

/**
 * Same for the courier: one IShippingPartner, built here, read everywhere
 * through getShippingPartner(). A partner named wrong in the env stops the
 * server now instead of failing the first time an admin confirms an order.
 */
initShippingPartner();

/**
 * Same story for mail: one IEmailProvider, chosen by EMAIL_PROVIDER, built here
 * and read everywhere through getEmailProvider(). SMTP and the Brevo HTTP API
 * are the same object to every call site.
 */
initEmailProvider();

const app = express();

const API_PREFIX = "/api/v1";

export const pool = new Pool(configDb());

/**
 * Every request arrives through nginx, so the socket address is always the
 * proxy's. Without this express reports that one address as req.ip for the
 * entire internet, and every ip-keyed rate limit becomes a single shared
 * bucket that the first busy visitor empties for everyone else.
 *
 * The value is the number of proxies in front of this process — one nginx
 * today. It is an env var because putting a cdn in front later adds a hop,
 * and because setting it too high is its own bug: express would then believe
 * a client-supplied X-Forwarded-For entry and let an attacker forge a new ip,
 * and a new rate limit allowance, on every request.
 */
app.set("trust proxy", parseInt(process.env.TRUST_PROXY ?? "1"));

app.use(
  `${API_PREFIX}/webhook`,
  (_, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    next();
  },
  rateLimits.webhook,
  webHookRoutes,
);

/**
 * The storefront and cms origins, plus this api's own.
 *
 * The api renders the razorpay checkout page itself, and that page posts back
 * here to verify the payment. A POST carries an Origin header even when it is
 * same-origin, so without this the api's own page is rejected by its own cors
 * check and every card payment ends on the failure screen.
 */
const ALLOWED_ORIGINS = [
  ...(process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",")
    : ["http://localhost:3000", "http://localhost:3001", "http://localhost:8080"]),
  process.env.API_BASE_URL
    ? new URL(process.env.API_BASE_URL).origin // strips any path on the env value
    : "",
]
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

if (process.env.NODE_ENV === "production") {
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
    }),
  );
} else {
  app.use(
    cors({
      origin: (_, callback) => {
        callback(null, true); // allow every origin
      },
      credentials: true,
    }),
  );
}

app.use(express.static(path.resolve(path.join(process.cwd(), "public"))));
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));
app.use(cookieParser());

app.set("view engine", "ejs");
app.set("views", path.resolve(path.join(process.cwd(), "views")));
// company name and support address come from env so the branding and the
// contact details in every rendered view stay in one place
app.locals.companyName = process.env.COMPANY_NAME;
app.locals.supportEmail = supportEmail();

/**
 * The backstop for everything under the api prefix. Per-route limits below are
 * the ones that matter; this only catches the blunt case of a single machine
 * firing at the whole api at once.
 *
 * Mounted after the webhook router above, which is registered first and
 * therefore handles its own traffic before this is ever reached — gateway
 * callbacks are counted by their own, much higher limit instead.
 *
 * This is safe to key by ip only because both the storefront and the cms call
 * this api from the browser: every request carries a real visitor's address.
 * The day a page is rendered on the server instead, all of its api calls will
 * arrive from the one frontend container and share a single bucket, and this
 * limiter will have to learn to exempt that source.
 */
app.use(API_PREFIX, rateLimits.global);

app.use(`${API_PREFIX}/users`, userRoute);
app.use(`${API_PREFIX}/products`, productRoute);
app.use(`${API_PREFIX}/media-item`, mediaItem);
app.use(`${API_PREFIX}/discount`, discountRoute);
app.use(`${API_PREFIX}/orders`, orderRoutes);
app.use(`${API_PREFIX}/payments`, paymentRoute);
app.use(`${API_PREFIX}/website`, websiteRoute);
app.use(`${API_PREFIX}/settings`, settingsRoute);
app.use(`${API_PREFIX}/shipping`, shippingRoutes);
app.use(`${API_PREFIX}/blogs`, blogRoutes);
app.use(`${API_PREFIX}/wishlist`, wishlistRoutes);
app.use(`${API_PREFIX}/analytics`, analyticsRoutes);

app.get("/", (_, res) => {
  res.send("Api Server is running!");
});

app.get("/create-pass", rateLimits.maintenance, (req, res) => {
  res.send(encrypt(req.query.pass?.toString() ?? ""));
});

app.get(
  "/init-db",
  rateLimits.maintenance,
  asyncErrorHandler(async (req, res) => {
    if (!req.query.pass || req.query.pass !== process.env.INIT_SQL_PASSWORD)
      throw new ErrorHandler(403, "Forbidden");

    const SQL_PATH = path.resolve(__dirname, "./config/database.sql");
    const sql = fs.readFileSync(SQL_PATH, "utf-8");

    (async function () {
      await pool.query(sql);
      await createAdminUser();
    })();

    res.send("Database initialized successfully");
  }),
);

app.use(globalErrorController);

const HOST = process.env.HOST || "localhost";
const PORT = parseInt(process.env.PORT || "8080");
app.listen(PORT, HOST, () => {
  console.log(`Server is running on http://${HOST}:${PORT}`);
});
