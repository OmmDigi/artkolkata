import { pool } from "..";
import {
  NON_REVENUE_ORDER_STATUSES,
  REPORTING_TIMEZONE,
  TOP_PRODUCTS_DEFAULT_LIMIT,
  TOP_PRODUCTS_MAX_LIMIT,
} from "../constant";
import asyncErrorHandler from "../middleware/asyncErrorHandler";
import { ErrorHandler } from "../utils/ErrorHandler";
import { httpResponse } from "../utils/httpResponse";
import { resolveDateRange } from "../utils/resolveDateRange";

/**
 * Dashboard analytics.
 *
 * Four read-only endpoints behind the same date window, so every card and
 * chart on the screen is describing the same slice of time:
 *
 *   GET /analytics/kpi           the five headline numbers
 *   GET /analytics/timeseries    those numbers bucketed for a chart
 *   GET /analytics/top-products  best sellers in the window
 *   GET /analytics/order-status  where the window's orders currently sit
 *
 * All of them take ?range=today|7d|30d|3m|1y|custom, and custom additionally
 * takes start_date and end_date as YYYY-MM-DD. See resolveDateRange for why
 * the window is cut in IST while the comparison happens in UTC.
 *
 * What counts as revenue is one decision made in one place,
 * NON_REVENUE_ORDER_STATUSES, and passed to every query as a parameter — so
 * the KPI card, the chart and the best-seller list can never disagree about
 * whether a cancelled order happened.
 *
 * Draft orders are left out of all four, the status breakdown included. Staff
 * park an order precisely because it should not count — a test, a duplicate, a
 * phone order keyed in wrong — so it is dropped before any of these numbers is
 * taken, and restoring it brings it back into every window it belongs to.
 */

/**
 * pg hands back NUMERIC as a string, because a NUMERIC can hold more precision
 * than a JS number. Money here is NUMERIC(10,2) — at most eight digits before
 * the point — so the conversion is lossless and the client gets a number it
 * can do arithmetic on instead of a string it has to remember to parse.
 */
const money = (value: unknown): number => Number(value ?? 0);

/**
 * $1 and $2 are the window bounds, and they arrive as absolute instants
 * (timestamptz). The columns they are compared against are bare TIMESTAMPs
 * holding the database server's own wall clock, so the bound is converted into
 * that same clock before the comparison — whatever it happens to be. Both are
 * constants for the life of the query, so the planner still gets a range scan.
 */
const WINDOW_START = `($1::timestamptz AT TIME ZONE current_setting('TimeZone'))`;
const WINDOW_END = `($2::timestamptz AT TIME ZONE current_setting('TimeZone'))`;

/** the stored naive timestamp, read back as reporting-timezone wall clock */
const inReportingTimezone = (column: string, timezonePlaceholder: string) =>
  `${column} AT TIME ZONE current_setting('TimeZone') AT TIME ZONE ${timezonePlaceholder}`;

/**
 * A percentage, rounded once here so no two clients round it differently.
 *
 * Null rather than 0 when there is nothing to divide by: a window with no
 * sales but a refund in it has an undefined refund rate, and reporting that
 * as 0% would put a reassuring number next to money that actually went out.
 */
const percent = (part: number, whole: number): number | null =>
  whole === 0 ? null : Number(((part / whole) * 100).toFixed(2));

export const getDashboardKpi = asyncErrorHandler(async (req, res) => {
  const range = resolveDateRange(req.query);

  const { rows } = await pool.query(
    `
    WITH counted_orders AS (
      SELECT
        o.order_id,
        o.user_id,
        o.total_amount,
        o.subtotal,
        o.discount,
        o.shipping_charge
      FROM orders o
      WHERE o.created_at >= ${WINDOW_START}
        AND o.created_at <  ${WINDOW_END}
        AND COALESCE(o.order_status, 'PENDING') <> ALL($3::text[])
        AND COALESCE(o.is_draft, false) = false
    ),

    sales AS (
      SELECT
        COALESCE(SUM(total_amount), 0)    AS gross_sales,
        COALESCE(SUM(subtotal), 0)        AS gross_subtotal,
        COALESCE(SUM(discount), 0)        AS total_discount,
        COALESCE(SUM(shipping_charge), 0) AS total_shipping,
        COUNT(*)::int                     AS total_orders,
        COUNT(DISTINCT user_id)::int      AS buying_customers
      FROM counted_orders
    ),

    -- A single line of an order can be cancelled while the order itself is
    -- still live, so the item's own status is filtered as well. Without this
    -- a cancelled line keeps inflating units sold forever.
    units AS (
      SELECT COALESCE(SUM(oi.quantity), 0)::int AS products_sold
      FROM order_items oi
      JOIN counted_orders c ON c.order_id = oi.order_id
      WHERE COALESCE(oi.status, 'PENDING') <> ALL($3::text[])
    ),

    -- Staff accounts are customers of nothing; role is what separates them.
    customers AS (
      SELECT COUNT(*)::int AS new_customers
      FROM users u
      WHERE u.created_at >= ${WINDOW_START}
        AND u.created_at <  ${WINDOW_END}
        AND COALESCE(u.role, 'User') = 'User'
    ),

    -- Counted by when the money went back, not by when the order was placed:
    -- a refund issued today against a three month old order is today's
    -- refund. refunded_amount rather than the order total, so a partial
    -- refund reports what actually left the account.
    refunds AS (
      SELECT
        COALESCE(SUM(p.refunded_amount), 0) AS refunded_amount,
        COUNT(*)::int                       AS refund_count
      FROM payments p
      JOIN orders o ON o.order_id = p.order_id
      WHERE p.refunded_at >= ${WINDOW_START}
        AND p.refunded_at <  ${WINDOW_END}
        AND COALESCE(p.refunded_amount, 0) > 0
        -- a parked order contributes no sales, so its refund must not be
        -- divided into them either
        AND COALESCE(o.is_draft, false) = false
    )

    SELECT * FROM sales, units, customers, refunds
    `,
    [range.startAt, range.endAt, NON_REVENUE_ORDER_STATUSES],
  );

  const row = rows[0];

  const grossSales = money(row.gross_sales);
  const refundedAmount = money(row.refunded_amount);
  const totalOrders: number = row.total_orders;

  httpResponse(res, 200, "Dashboard KPIs", {
    range: {
      preset: range.preset,
      label: range.label,
      timezone: range.timezone,
      start_at: range.startAtLocal,
      end_at: range.endAtLocal,
    },

    total_sales: {
      // what customers were charged, refunds not yet taken off
      gross: grossSales,
      // what the business actually kept over this window
      net: Number((grossSales - refundedAmount).toFixed(2)),
      subtotal: money(row.gross_subtotal),
      discount: money(row.total_discount),
      shipping: money(row.total_shipping),
      average_order_value:
        totalOrders === 0
          ? 0
          : Number((grossSales / totalOrders).toFixed(2)),
    },

    orders: {
      total: totalOrders,
    },

    products_sold: {
      total: row.products_sold,
    },

    customers: {
      // people who created an account inside the window
      new: row.new_customers,
      // distinct accounts that placed one of the window's orders — the two
      // overlap but neither contains the other
      buying: row.buying_customers,
    },

    refunds: {
      amount: refundedAmount,
      count: row.refund_count,
      // Share of gross sales handed back, the number worth an alert. Null
      // when the window made no sales — see percent(). Note that a refund is
      // counted in the window it was ISSUED in, so net can go negative when
      // an old order is refunded today: that is the window telling the truth,
      // not a bug.
      rate: percent(refundedAmount, grossSales),
    },
  });
});

export const getSalesTimeseries = asyncErrorHandler(async (req, res) => {
  const range = resolveDateRange(req.query);

  /**
   * generate_series produces every bucket in the window whether or not an
   * order landed in it, and the aggregates are LEFT JOINed onto it. A chart
   * drawn from this has a flat line through a quiet Tuesday instead of
   * silently joining Monday to Wednesday.
   *
   * The series runs on reporting-timezone wall clock so the buckets line up
   * with the days a person recognises; the WHERE stays on the raw stored
   * column so it can still use idx_orders_created_at.
   */
  const { rows } = await pool.query(
    `
    WITH series AS (
      SELECT generate_series(
        date_trunc($3, $4::timestamp),
        date_trunc($3, $5::timestamp - interval '1 microsecond'),
        ('1 ' || $3)::interval
      ) AS bucket_start
    ),

    order_rows AS (
      SELECT
        date_trunc(
          $3,
          ${inReportingTimezone("o.created_at", "$6")}
        ) AS bucket_start,
        COALESCE(SUM(o.total_amount), 0) AS revenue,
        COUNT(*)::int                    AS orders
      FROM orders o
      WHERE o.created_at >= ${WINDOW_START}
        AND o.created_at <  ${WINDOW_END}
        AND COALESCE(o.order_status, 'PENDING') <> ALL($7::text[])
        AND COALESCE(o.is_draft, false) = false
      GROUP BY 1
    ),

    unit_rows AS (
      SELECT
        date_trunc(
          $3,
          ${inReportingTimezone("o.created_at", "$6")}
        ) AS bucket_start,
        COALESCE(SUM(oi.quantity), 0)::int AS units
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.order_id
      WHERE o.created_at >= ${WINDOW_START}
        AND o.created_at <  ${WINDOW_END}
        AND COALESCE(o.order_status, 'PENDING') <> ALL($7::text[])
        AND COALESCE(o.is_draft, false) = false
        AND COALESCE(oi.status, 'PENDING')      <> ALL($7::text[])
      GROUP BY 1
    )

    SELECT
      TO_CHAR(s.bucket_start, 'YYYY-MM-DD"T"HH24:MI') AS bucket,
      COALESCE(o.revenue, 0) AS revenue,
      COALESCE(o.orders, 0)  AS orders,
      COALESCE(u.units, 0)   AS units
    FROM series s
    LEFT JOIN order_rows o ON o.bucket_start = s.bucket_start
    LEFT JOIN unit_rows  u ON u.bucket_start = s.bucket_start
    ORDER BY s.bucket_start ASC
    `,
    [
      range.startAt,
      range.endAt,
      range.bucket,
      range.startAtLocal,
      range.endAtLocal,
      REPORTING_TIMEZONE,
      NON_REVENUE_ORDER_STATUSES,
    ],
  );

  httpResponse(res, 200, "Sales timeseries", {
    range: {
      preset: range.preset,
      label: range.label,
      timezone: range.timezone,
      start_at: range.startAtLocal,
      end_at: range.endAtLocal,
    },
    bucket: range.bucket,
    points: rows.map((point) => ({
      bucket: point.bucket,
      revenue: money(point.revenue),
      orders: Number(point.orders),
      units: Number(point.units),
    })),
  });
});

export const getTopProducts = asyncErrorHandler(async (req, res) => {
  const range = resolveDateRange(req.query);

  const requested = req.query.limit
    ? parseInt(req.query.limit as string, 10)
    : TOP_PRODUCTS_DEFAULT_LIMIT;

  if (Number.isNaN(requested) || requested < 1) {
    throw new ErrorHandler(400, "limit must be a positive number");
  }

  const limit = Math.min(requested, TOP_PRODUCTS_MAX_LIMIT);

  /**
   * order_items stores a snapshot of the product as JSONB rather than a
   * foreign key, so that an order still reads correctly after the product is
   * renamed or deleted. That snapshot is also the only thing to group on
   * here. A variant line carries the parent product's id under a different
   * key, which is why both are coalesced: two variants of one product belong
   * on one row of a best-seller list.
   */
  const { rows } = await pool.query(
    `
    SELECT
      COALESCE(
        oi.variant_info->>'product_id',
        oi.product_info->>'id'
      ) AS product_id,

      COALESCE(
        oi.variant_info->>'product_name',
        oi.product_info->>'name',
        'Unknown product'
      ) AS product_name,

      SUM(oi.quantity)::int          AS units_sold,
      COALESCE(SUM(oi.subtotal), 0)  AS revenue,
      COUNT(DISTINCT oi.order_id)::int AS order_count,

      -- one representative thumbnail; any line of the group will do
      (ARRAY_AGG(
        COALESCE(
          oi.variant_info->'images'->0,
          oi.product_info->'images'->0
        )
      ))[1] AS image

    FROM order_items oi
    JOIN orders o ON o.order_id = oi.order_id

    WHERE o.created_at >= ${WINDOW_START}
      AND o.created_at <  ${WINDOW_END}
      AND COALESCE(o.order_status, 'PENDING') <> ALL($3::text[])
      AND COALESCE(oi.status, 'PENDING')      <> ALL($3::text[])
      AND COALESCE(o.is_draft, false) = false

    GROUP BY 1, 2
    ORDER BY units_sold DESC, revenue DESC
    LIMIT $4
    `,
    [range.startAt, range.endAt, NON_REVENUE_ORDER_STATUSES, limit],
  );

  httpResponse(res, 200, "Top products", {
    range: {
      preset: range.preset,
      label: range.label,
      timezone: range.timezone,
      start_at: range.startAtLocal,
      end_at: range.endAtLocal,
    },
    products: rows.map((product) => ({
      product_id: product.product_id ? Number(product.product_id) : null,
      product_name: product.product_name,
      units_sold: product.units_sold,
      revenue: money(product.revenue),
      order_count: product.order_count,
      image: product.image,
    })),
  });
});

export const getOrderStatusBreakdown = asyncErrorHandler(async (req, res) => {
  const range = resolveDateRange(req.query);

  /**
   * Unlike every other endpoint here this one does NOT drop cancelled and
   * returned orders — they are the point. This is the pipeline view: how many
   * of the window's orders are waiting to be packed, how many were lost, and
   * how the payment split looks.
   */
  const { rows } = await pool.query(
    `
    WITH windowed AS (
      SELECT
        COALESCE(order_status, 'PENDING')   AS order_status,
        COALESCE(payment_status, 'PENDING') AS payment_status,
        COALESCE(payment_method, 'UNKNOWN') AS payment_method,
        total_amount
      FROM orders
      WHERE created_at >= ${WINDOW_START}
        AND created_at <  ${WINDOW_END}
        -- the one exclusion this endpoint does keep: a parked order is not
        -- waiting in the pipeline, it is not in the pipeline at all
        AND COALESCE(is_draft, false) = false
    )

    SELECT 'order_status' AS dimension, order_status AS value,
           COUNT(*)::int AS count, COALESCE(SUM(total_amount), 0) AS amount
    FROM windowed GROUP BY 2

    UNION ALL

    SELECT 'payment_status', payment_status,
           COUNT(*)::int, COALESCE(SUM(total_amount), 0)
    FROM windowed GROUP BY 2

    UNION ALL

    SELECT 'payment_method', payment_method,
           COUNT(*)::int, COALESCE(SUM(total_amount), 0)
    FROM windowed GROUP BY 2

    ORDER BY dimension ASC, count DESC
    `,
    [range.startAt, range.endAt],
  );

  const total = rows
    .filter((row) => row.dimension === "order_status")
    .reduce((sum, row) => sum + row.count, 0);

  const group = (dimension: string) =>
    rows
      .filter((row) => row.dimension === dimension)
      .map((row) => ({
        value: row.value,
        count: row.count,
        amount: money(row.amount),
        percentage: percent(row.count, total),
      }));

  httpResponse(res, 200, "Order breakdown", {
    range: {
      preset: range.preset,
      label: range.label,
      timezone: range.timezone,
      start_at: range.startAtLocal,
      end_at: range.endAtLocal,
    },
    total_orders: total,
    order_status: group("order_status"),
    payment_status: group("payment_status"),
    payment_method: group("payment_method"),
  });
});
