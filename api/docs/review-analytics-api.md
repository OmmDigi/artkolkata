# Review Analytics API — Integration Guide

Rating breakdown for reviews: how many 5 star, how many 4, and so on, plus the
total and the average. Works for a single product or for the whole shop.

**Base URL:** `process.env.NEXT_PUBLIC_API_BASE_URL`
**Auth:** none required. A logged-in manager token changes what is counted — see
[Visibility](#visibility).

---

## Endpoint

| Method | Path | What it does |
|--------|------|--------------|
| GET | `/api/v1/products/reviews/analytics` | Star breakdown, total and average |

### Query params

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `product_id` | number | — | Optional. Omit for shop-wide numbers. A non-numeric value is a `400`. |

---

## Visibility

| Caller | Counted | Extra fields |
|--------|---------|--------------|
| Public / shopper | Approved reviews only | — |
| Manager with permission `1-6` | Approved **and** pending | `approved`, `pending` |

So a shopper's numbers always match the review list they can actually read.
Pending counts are staff-only — the storefront is not told that unapproved
reviews exist.

---

## Response

Standard envelope, `data` is an object:

```json
{
  "statusCode": 200,
  "message": "Review analytics",
  "success": true,
  "data": {
    "total": 4,
    "average": 4.75,
    "breakdown": [
      { "stars": 5, "count": 3, "percentage": 75 },
      { "stars": 4, "count": 1, "percentage": 25 },
      { "stars": 3, "count": 0, "percentage": 0 },
      { "stars": 2, "count": 0, "percentage": 0 },
      { "stars": 1, "count": 0, "percentage": 0 }
    ]
  },
  "key": [],
  "totalPage": 0
}
```

With a manager token, `data` also carries:

```json
{ "approved": 4, "pending": 1 }
```

### Field notes

| Field | Notes |
|-------|-------|
| `total` | Number of reviews counted, after the visibility rule above |
| `average` | Number, 2 decimals. `0` when there are no reviews — not `null` |
| `breakdown` | Always 5 entries, always ordered 5 → 1, even where `count` is `0` |
| `percentage` | Share of `total`, 2 decimals. `0` for every row when `total` is `0`, so nothing divides by zero client side |
| `approved` / `pending` | Manager only. `pending` = reviews still on the waiting list |

Draw star bars straight from `percentage` — no client-side maths needed.

---

## Caching

Responses are cached under the `reviews` tag and the cache is dropped whenever a
review is created, approved, unlisted or deleted. Manager requests bypass the
cache in both directions, so the CMS always reads fresh numbers.

---

## Examples

```ts
// One product
const res = await getRequest(
  `/api/v1/products/reviews/analytics?product_id=8`,
);
const { total, average, breakdown } = res.data;

// Whole shop
const shop = await getRequest(`/api/v1/products/reviews/analytics`);
```

Pairing it with the filter on the review list:

```ts
// breakdown row -> filtered list
const fiveStar = breakdown.find((b) => b.stars === 5);
const list = await getRequest(
  `/api/v1/products/reviews?product_id=8&stars=5`,
);
```
