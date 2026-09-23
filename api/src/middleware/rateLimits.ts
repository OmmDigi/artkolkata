import { CustomRequest } from "../types";
import { rateLimit } from "./rateLimit";

/**
 * The limits themselves, in one place, so a route file reads as a list of
 * intentions ("this one is an auth endpoint") instead of a list of numbers,
 * and so the numbers can be compared against each other when they are tuned.
 *
 * How the tiers were chosen:
 *
 *  - Reads are generous. Most storefront GETs are served from the response
 *    cache, so they are cheap, and a shopper opening a category and paging
 *    through it fires a lot of them in a short burst. These limits exist to
 *    stop a scraper, not a customer.
 *  - Writes are tight, because each one costs a database transaction, and
 *    several also cost money (a courier lookup, an sms, an email, a payment
 *    gateway call).
 *  - Anything that accepts a secret — a password, an otp, a coupon code — is
 *    tightest of all, and is counted per target as well as per caller so that
 *    rotating ip addresses does not buy an attacker more guesses against one
 *    account.
 */

/** the email an auth request is aimed at, so guesses are counted per account */
const emailScope = (req: CustomRequest) => {
  const email = (req.body as Record<string, unknown> | undefined)?.email;
  return typeof email === "string" && email ? email : null;
};

export const rateLimits = {
  /**
   * The backstop. Mounted once on the api prefix, sized so that no real
   * session can reach it — a full page load is a handful of calls — while a
   * script walking the catalogue runs into it quickly.
   *
   * Deliberately keyed by ip even for logged-in callers: the point is to cap
   * one machine, and an attacker with a valid token can mint as many user
   * identities as they like.
   */
  global: rateLimit({
    name: "global",
    limit: 600,
    windowSeconds: 60,
    identity: "ip",
  }),

  /** cached storefront listings and detail pages */
  publicRead: rateLimit({
    name: "public-read",
    limit: 240,
    windowSeconds: 60,
  }),

  /**
   * Uncached public reads that always hit postgres, so they are worth roughly
   * an order of magnitude more than a cached one.
   */
  publicReadUncached: rateLimit({
    name: "public-read-uncached",
    limit: 60,
    windowSeconds: 60,
  }),

  /** admin panel browsing : one operator, many list and detail views */
  adminRead: rateLimit({
    name: "admin-read",
    limit: 300,
    windowSeconds: 60,
  }),

  /**
   * Admin mutations. High enough that clicking through a bulk edit or saving
   * a long product form never trips it, low enough that a stolen admin token
   * cannot rewrite the catalogue in one pass.
   */
  adminWrite: rateLimit({
    name: "admin-write",
    limit: 120,
    windowSeconds: 60,
    message: "Too many changes at once. Please wait a moment and retry.",
  }),

  /**
   * Login. Two limiters are used together on this route: this one caps guesses
   * against a single account no matter where they come from, and loginIp caps
   * one source no matter how many accounts it spreads them across. Either one
   * alone has an obvious hole.
   */
  login: rateLimit({
    name: "login",
    limit: 10,
    windowSeconds: 900,
    identity: "ip",
    scope: emailScope,
    message: "Too many login attempts. Please try again in a few minutes.",
  }),

  loginIp: rateLimit({
    name: "login-ip",
    limit: 40,
    windowSeconds: 900,
    identity: "ip",
    message: "Too many login attempts. Please try again in a few minutes.",
  }),

  /** account creation : no legitimate visitor needs more than a couple */
  signup: rateLimit({
    name: "signup",
    limit: 5,
    windowSeconds: 3600,
    identity: "ip",
    message: "Too many sign up attempts. Please try again later.",
  }),

  /**
   * Sending an otp costs an email and, more importantly, is the lever an
   * attacker pulls to mail-bomb someone else's inbox. Counted per address so
   * one victim cannot be targeted from many sources.
   */
  otpSend: rateLimit({
    name: "otp-send",
    limit: 5,
    windowSeconds: 900,
    identity: "ip",
    scope: emailScope,
    message:
      "Too many code requests. Please wait a few minutes before asking for another.",
  }),

  otpSendIp: rateLimit({
    name: "otp-send-ip",
    limit: 20,
    windowSeconds: 3600,
    identity: "ip",
    message: "Too many code requests. Please try again later.",
  }),

  /**
   * Verifying an otp is a guess at a short numeric secret, so it gets the
   * tightest budget in the file. Ten tries per account per fifteen minutes
   * leaves an honest user room to fat-finger it and leaves an attacker
   * nowhere near the search space.
   */
  otpVerify: rateLimit({
    name: "otp-verify",
    limit: 10,
    windowSeconds: 900,
    identity: "ip",
    scope: emailScope,
    message:
      "Too many incorrect codes. Please request a new one in a few minutes.",
  }),

  /** the google oauth redirect pair */
  oauth: rateLimit({
    name: "oauth",
    limit: 30,
    windowSeconds: 900,
    identity: "ip",
  }),

  /**
   * Coupon validation is a code-guessing oracle: it reports whether a string
   * is a live discount code. Per user, because the storefront revalidates on
   * every cart change and a shopper editing quantities fires several.
   */
  couponValidate: rateLimit({
    name: "coupon-validate",
    limit: 30,
    windowSeconds: 300,
    message: "Too many coupon attempts. Please wait a moment and try again.",
  }),

  /**
   * Placing an order. The ceiling is a defence against a double-submit storm
   * or a script minting orders, not against a busy shopper — ten real orders
   * in ten minutes from one account does not happen.
   */
  orderPlace: rateLimit({
    name: "order-place",
    limit: 10,
    windowSeconds: 600,
    message:
      "Too many order attempts. Please wait a moment before trying again.",
  }),

  /** cancel and return : state changes on an existing order */
  orderMutate: rateLimit({
    name: "order-mutate",
    limit: 20,
    windowSeconds: 600,
  }),

  /**
   * The cart price recalculation. Public, uncached, and it reprices every line
   * against the database on each call, so it is the cheapest way to make the
   * api do real work without an account.
   */
  priceBreakdown: rateLimit({
    name: "price-breakdown",
    limit: 60,
    windowSeconds: 300,
  }),

  /**
   * Order tracking takes an order number from the query string, so it is an
   * enumeration surface as well as a courier api call.
   */
  orderTrack: rateLimit({
    name: "order-track",
    limit: 30,
    windowSeconds: 300,
    identity: "ip",
    message: "Too many tracking requests. Please wait a moment and try again.",
  }),

  /**
   * Invoice and payment slip pdfs are generated on demand, which is the most
   * cpu a single request can spend in this api.
   */
  documentDownload: rateLimit({
    name: "document-download",
    limit: 20,
    windowSeconds: 600,
    message: "Too many document downloads. Please wait a moment and try again.",
  }),

  /**
   * Excel export of the order list. Streams the whole filtered table through
   * one pool connection, so it is counted in a handful per ten minutes.
   */
  orderExport: rateLimit({
    name: "order-export",
    limit: 10,
    windowSeconds: 600,
    message: "Too many exports. Please wait a few minutes and try again.",
  }),

  /**
   * Many invoices merged into one pdf. Up to a hundred documents fetched or
   * rendered per request, so it is counted like the export.
   */
  bulkInvoice: rateLimit({
    name: "bulk-invoice",
    limit: 10,
    windowSeconds: 600,
    message: "Too many bulk invoice downloads. Please wait a few minutes and try again.",
  }),

  /** gateway handoff pages and the verify callbacks */
  payment: rateLimit({
    name: "payment",
    limit: 30,
    windowSeconds: 600,
    identity: "ip",
    message: "Too many payment attempts. Please wait a moment and try again.",
  }),

  /**
   * Payment status is polled by the frontend while it waits for the gateway to
   * settle, so this is sized for polling rather than for a single call.
   */
  paymentStatus: rateLimit({
    name: "payment-status",
    limit: 120,
    windowSeconds: 300,
    identity: "ip",
  }),

  /**
   * Webhooks. Gateways and couriers retry hard and burst during a sale, and a
   * dropped webhook means an order stuck in the wrong state, so the ceiling is
   * high — it exists only to stop a forged flood, since anyone can post here.
   * Verification of the signature still happens in the handler.
   */
  webhook: rateLimit({
    name: "webhook",
    limit: 600,
    windowSeconds: 60,
    identity: "ip",
  }),

  /**
   * Serviceability is a paid call out to the courier network, billed per
   * lookup, so this limit protects a bill as much as a server.
   */
  serviceability: rateLimit({
    name: "serviceability",
    limit: 40,
    windowSeconds: 300,
    identity: "ip",
    message: "Too many pincode checks. Please wait a moment and try again.",
  }),

  /** contact form : a spam target, and every submission is stored */
  enquiry: rateLimit({
    name: "enquiry",
    limit: 5,
    windowSeconds: 3600,
    identity: "ip",
    message: "You have sent several enquiries already. Please try again later.",
  }),

  /** review submission : logged in, but still a spam and vote-stuffing target */
  reviewCreate: rateLimit({
    name: "review-create",
    limit: 10,
    windowSeconds: 3600,
    message: "Too many reviews submitted. Please try again later.",
  }),

  /** wishlist toggling is click-driven, so it needs real headroom */
  wishlist: rateLimit({
    name: "wishlist",
    limit: 120,
    windowSeconds: 60,
  }),

  /** cart writes are click-driven too : quantity steppers fire in bursts */
  cart: rateLimit({
    name: "cart",
    limit: 120,
    windowSeconds: 60,
  }),

  /** address book writes from the storefront account pages */
  accountWrite: rateLimit({
    name: "account-write",
    limit: 30,
    windowSeconds: 300,
  }),

  /** media library writes, including the record created after an upload */
  mediaWrite: rateLimit({
    name: "media-write",
    limit: 60,
    windowSeconds: 60,
    message: "Too many media operations. Please wait a moment and retry.",
  }),

  /** full table scan behind a long cache, hit by crawlers */
  sitemap: rateLimit({
    name: "sitemap",
    limit: 20,
    windowSeconds: 300,
    identity: "ip",
  }),

  /**
   * The two unauthenticated maintenance routes on the root of the app. Both
   * take a secret from the query string, so both are guessable, and neither is
   * ever called more than a handful of times in the life of the deployment.
   */
  maintenance: rateLimit({
    name: "maintenance",
    limit: 5,
    windowSeconds: 3600,
    identity: "ip",
    message: "Too many requests.",
  }),
};
