# Top Reviews API — Frontend Integration Guide

Feed of the latest happy customer reviews, for a "what customers say" section on the
storefront. Only approved reviews of **4 stars and above** are returned, newest first.

**Base URL:** `process.env.NEXT_PUBLIC_API_BASE_URL`
**Auth:** none — public endpoint, no token needed.

---

## Endpoint

| Method | Path | What it does |
|--------|------|--------------|
| GET | `/api/v1/products/reviews/top` | Latest approved 4★+ reviews with their product |

### Query params

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `limit` | number | `20` | Optional. Capped at `50`. Anything invalid falls back to 20. |

### What the server filters for you

- Review is approved (pending reviews never appear).
- `stars >= 4`.
- The product is public — reviews on hidden/private products are dropped.
- Sorted newest first (`created_at DESC`).

---

## Response

Standard envelope, `data` is a flat array:

```json
{
  "statusCode": 200,
  "message": "Top review list",
  "success": true,
  "data": [
    {
      "id": 42,
      "stars": 5,
      "message": "Fits perfectly, loved the fabric.",
      "user_id": 17,
      "user_name": "Ritu Sharma",
      "product_id": 8,
      "product_slug": "floral-wrap-dress",
      "product_name": "Floral Wrap Dress",
      "product_images": [
        {
          "id": 55,
          "product_id": 8,
          "image": "/uploads/products/floral-wrap-1.png",
          "alt_tag": "Floral wrap dress front",
          "position": 0,
          "type": "image"
        }
      ],
      "created_at": "12 Aug 2026"
    }
  ],
  "key": [],
  "totalPage": 0
}
```

### Field notes

| Field | Notes |
|-------|-------|
| `stars` | 1–5 int, always `>= 4` here |
| `message` | Review text. Can be `null` if the customer only rated |
| `user_name` | Can be `null` if the user account was deleted |
| `product_slug` | Use for the product link: `/products/{product_slug}` |
| `product_images` | Array ordered by `position`. `[]` when the product has no media. `type` is `"image"` or `"video"` (video url sits in the `image` field) |
| `created_at` | Pre-formatted display string, `DD Mon YYYY` |

There is no pagination — `totalPage` is always `0`. Use `limit` instead.

---

## Example

```ts
const res = await getRequest(`/api/v1/products/reviews/top?limit=10`);
const reviews = res.data ?? [];

// thumbnail for the card
const thumb = reviews[0]?.product_images?.[0]?.image ?? null;
```
