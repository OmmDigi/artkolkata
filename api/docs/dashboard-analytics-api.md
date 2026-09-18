# Dashboard Analytics API — Integration Guide

The five KPI cards on the admin dashboard — Total Sales, Orders, Products Sold,
Customers, Refunds — plus the chart, the best-seller list and the order
pipeline underneath them. Four endpoints, one shared date filter.

**Base URL:** `process.env.VITE_API_BASE_URL` (cms)
**Auth:** required. Bearer token holding permission `1-5` (Orders).

---

## Endpoints

| Method | Path | What it does |
|--------|------|--------------|
| GET | `/api/v1/analytics/kpi` | The five headline numbers |
| GET | `/api/v1/analytics/timeseries` | Revenue / orders / units bucketed for a chart |
| GET | `/api/v1/analytics/top-products` | Best sellers in the window |
| GET | `/api/v1/analytics/order-status` | Where the window's orders currently sit |

All four take the same date filter, so every widget on the screen is describing
the same slice of time.

### Query params

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `range` | enum | `30d` | `today`, `7d`, `30d`, `3m`, `1y`, `custom`. Anything else is a `400`. |
| `start_date` | `YYYY-MM-DD` | — | Required when `range=custom`. Inclusive. |
| `end_date` | `YYYY-MM-DD` | — | Required when `range=custom`. **Inclusive** — `2026-09-01` to `2026-09-05` contains everything that happened on the 5th. |
| `limit` | number | `10` | `/top-products` only. Capped at 50; a higher value is clamped, not rejected. |

Each preset is a run of whole calendar days ending with today:

| `range` | Window | Chart bucket |
|---------|--------|--------------|
| `today` | today, 00:00 to 24:00 | hour (24 points) |
| `7d` | the last 7 days **including today** | day (7 points) |
| `30d` | the last 30 days including today | day (30 points) |
| `3m` | the last 3 months | day |
| `1y` | the last 12 months | month (13 points — the first is partial) |
| `custom` | your two dates, max 2 years apart | hour ≤ 2 days, day ≤ 100 days, else month |

`7d` is seven calendar days, not 7 × 24 hours rolling back from this minute —
which is what someone comparing this week to last week expects.

---

## Timezone

Every window is a **calendar window in Asia/Kolkata**, so "Today" means the
Indian day. An order placed at 11pm IST belongs to that day, not to the next
UTC one.

The response echoes this back so the client never has to guess:

```json
"range": {
  "preset": "30d",
  "label": "Last 30 days",
  "timezone": "Asia/Kolkata",
  "start_at": "2026-08-18 00:00:00",
  "end_at": "2026-09-17 00:00:00"
}
```

`start_at` is inclusive, `end_at` is **exclusive**, and both are IST wall clock.
An `end_at` of the 17th on a "last 30 days" window is correct: it runs to the
end of the 16th.

---

## What counts

One rule, applied identically by every endpoint here: **an order in status
`CANCELLED` or `RETURNED` did not happen.** Everything else counts, including

- a COD order that has not been paid yet — the sale is real, the cash is late;
- an order whose return is only `RETURN INITIATED` — nothing has come back yet.

`order_items` carries its own status for the case where one line of an order is
cancelled on its own, and that is filtered the same way, so a cancelled line
stops counting toward Products Sold.

`/analytics/order-status` is the deliberate exception — it shows every status
including the cancelled ones, because that is its whole point.

---

## `GET /analytics/kpi`

```json
{
  "statusCode": 200,
  "message": "Dashboard KPIs",
  "success": true,
  "data": {
    "range": { "preset": "30d", "label": "Last 30 days", "timezone": "Asia/Kolkata",
               "start_at": "2026-08-18 00:00:00", "end_at": "2026-09-17 00:00:00" },

    "total_sales": {
      "gross": 650,
      "net": 1,
      "subtotal": 500,
      "discount": 0,
      "shipping": 150,
      "average_order_value": 650
    },
    "orders":        { "total": 1 },
    "products_sold": { "total": 1 },
    "customers":     { "new": 1, "buying": 1 },
    "refunds":       { "amount": 649, "count": 1, "rate": 99.85 }
  },
  "key": [],
  "totalPage": 0
}
```

| Field | Meaning |
|-------|---------|
| `total_sales.gross` | What customers were charged. Refunds not yet deducted. |
| `total_sales.net` | `gross` minus refunds issued in this window. **Can be negative** — see below. |
| `total_sales.average_order_value` | `gross / orders.total`, `0` when there are no orders. |
| `orders.total` | Orders placed in the window that still count. |
| `products_sold.total` | Units, not lines — a quantity of 3 counts 3. |
| `customers.new` | Accounts created in the window. Staff roles excluded. |
| `customers.buying` | Distinct accounts that placed one of the window's orders. Overlaps `new`; neither contains the other. |
| `refunds.amount` | Money actually sent back, partial refunds included. |
| `refunds.rate` | Refunds as a % of `gross`, or **`null`** when the window made no sales. |

### Two things that look like bugs and are not

**`net` can be negative, and `gross` can be 0 while `refunds.amount` is not.**
A refund is counted in the window it was **issued** in, not the window the order
was placed in. A refund paid out today against an order from three months ago is
today's refund. Over a 7-day window containing only that refund you get
`gross: 0, net: -649` — which is what actually happened to the bank balance.

**`refunds.rate` is `null`, not `0`, when `gross` is 0.** There is no meaningful
percentage to report, and printing `0%` next to money that went out would be
reassuring and wrong. Render it as `—`.

---

## `GET /analytics/timeseries`

```json
"data": {
  "range": { "...": "..." },
  "bucket": "day",
  "points": [
    { "bucket": "2026-09-10T00:00", "revenue": 0,   "orders": 0, "units": 0 },
    { "bucket": "2026-09-11T00:00", "revenue": 650, "orders": 1, "units": 1 }
  ]
}
```

`bucket` tells you what one point covers (`hour`, `day` or `month`) so the axis
can be labelled correctly. Each `points[].bucket` is the IST start of that
bucket.

**Every bucket in the window is present, including empty ones.** A quiet Tuesday
is a point with zeros, not a missing point — so a line chart drawn straight from
this array never silently joins Monday to Wednesday.

On `range=1y` the first of the 13 month buckets is partial: the window starts
mid-month, and the bucket is labelled with the 1st. Totals are unaffected —
only that one bar is short.

---

## `GET /analytics/top-products`

```json
"data": {
  "range": { "...": "..." },
  "products": [
    {
      "product_id": 8,
      "product_name": "Wrap-Neck Tiered Midi Dress",
      "units_sold": 1,
      "revenue": 500,
      "order_count": 1,
      "image": { "image": "...", "alt_tag": "..." }
    }
  ]
}
```

Sorted by `units_sold` descending, then `revenue`.

`order_items` stores a **snapshot** of the product as JSONB rather than a
foreign key, so an old order still reads correctly after the product is renamed
or deleted. That snapshot is what is grouped on here, which has two
consequences worth knowing:

- Variants are rolled up into their parent product — two sizes of one dress are
  one row, not two.
- `product_name` is the name **as it was when the order was placed**. Rename a
  product mid-window and you may see both names. `product_id` is stable; group
  on that if you need to.
- `product_id` is `null` and the name falls back to `"Unknown product"` for the
  rare legacy row whose snapshot has neither id.
- `image` is `null` when the snapshot carried no image.

---

## `GET /analytics/order-status`

The pipeline view. **Includes cancelled and returned orders** — unlike every
other endpoint here.

```json
"data": {
  "range": { "...": "..." },
  "total_orders": 2,
  "order_status":   [ { "value": "CONFIRMED", "count": 1, "amount": 650, "percentage": 50 } ],
  "payment_status": [ { "value": "PENDING",   "count": 1, "amount": 650, "percentage": 50 } ],
  "payment_method": [ { "value": "COD",       "count": 1, "amount": 650, "percentage": 50 } ]
}
```

Three breakdowns of the same set of orders, each summing to `total_orders`.
`percentage` is a share of `total_orders`, rounded to 2 decimals. Only statuses
that actually occur in the window appear — there is no zero row for a status
nobody is in.

---

## Errors

Standard error envelope, `success: false`.

| Status | When |
|--------|------|
| `400` | `range` is not one of the six values |
| `400` | `range=custom` without both `start_date` and `end_date`, or not in `YYYY-MM-DD` |
| `400` | a date that does not exist, e.g. `2026-02-31` |
| `400` | `start_date` after `end_date` |
| `400` | a custom range longer than 2 years |
| `400` | `limit` is not a positive number |
| `403` | no token, or a token without permission `1-5` |

---

## Notes for whoever maintains this

- **Permission.** Guarded by `1-5` (Orders) rather than a new permission of its
  own: every number here is derived from orders, so anyone who can open the
  Orders screen can already read all of it one page at a time. When the CMS
  grows a Dashboard entry in `SIDEBAR_OPTIONS`, swap `ORDERS_PERMISSION_ID` in
  `analytics.routes.ts` for that entry's id and add it to `RoteIds`.

- **Not cached.** `cacheResponse` deliberately bypasses the cache for
  privileged requests, and every request that reaches these routes is one.
  Adding the middleware here would do nothing.

- **`users.created_at` is new**, and rows that predate it were backfilled from
  the user's first order. A user who registered but never ordered has `NULL`
  there and is counted in no window — unknown, rather than wrongly attributed
  to migration day. `customers.new` is therefore understated for the period
  before the migration.

- **Timezone is not hardcoded to the server's.** The columns are bare
  `TIMESTAMP`s holding whatever clock the database runs on — UTC in the compose
  container, `Asia/Kolkata` on at least one developer machine. Window bounds are
  sent as `timestamptz` and converted with
  `AT TIME ZONE current_setting('TimeZone')`, so the same query returns the same
  numbers on both. `current_setting` is `STABLE`, so the bound is still computed
  once and `idx_orders_created_at` is still used — confirmed by `EXPLAIN`.

- **Indexes** added for these queries: `idx_orders_created_at`,
  `idx_order_items_order_id`, `idx_payments_refunded_at` (partial, on
  `refunded_amount > 0`) and `idx_users_created_at`.
