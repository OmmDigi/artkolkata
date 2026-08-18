# Order Invoice & Payment Slip API

Base URL: `{HOST}/api/v1`
All JSON bodies are `Content-Type: application/json`.

An order can have **two different downloadable documents**, and they are not the same thing:

| Document | Where it comes from | Availability | Response field |
| --- | --- | --- | --- |
| **Invoice** | A PDF/JPEG an admin uploads against the order from the CMS | Only after someone uploads it | `invoice_url` (`null` until uploaded) |
| **Payment slip** | Rendered by the API itself from the order record | **Always**, for every order, at every status | `payment_slip_url` (never `null`) |

The generated document is a **payment slip, not an invoice** — it is a record of what was ordered and what was paid. A real invoice only exists when the admin uploads one.

Both documents can exist at the same time. Uploading an invoice does **not** remove or replace the payment slip.

---

## ⚠️ Breaking changes from the previous behaviour

Read this before wiring the UI.

1. **`GET /orders/invoice/:orderid` no longer falls back to the generated document.** It used to serve the uploaded file if present, otherwise render the generated one for `DELIVERED` orders. Now it serves the uploaded file only, and returns **404** when nothing was uploaded. Use `payment_slip_url` for the generated document.
2. **`invoice_avilable` changed meaning.** It now means *"an admin uploaded an invoice"*, nothing else.
   - Order list (CMS): was `order_status = 'CONFIRMED' OR upload exists` → now `upload exists`.
   - User order list (storefront): was `order_status = 'DELIVERED'` → now `upload exists`.
3. **Do not build these URLs by hand any more.** The API sends both, absolute and ready to open. Stop concatenating `${API_BASE_URL}/api/v1/orders/invoice/${order_id}`.
4. **The `DELIVERED` gate on the generated document is gone.** A `PENDING` or `CANCELLED` order now has a working payment slip.
5. **`is_cancelable` is now `PENDING` only** (was `PENDING | CONFIRMED | SHIPPED`). See [§2](#is_cancelable--changed).
6. **`ordered_products[].product_slug` added** on the storefront order list. See [§2](#ordered_productsproduct_slug--added).

---

## Fields added to every order row

Both order-list endpoints return these three fields on each row:

```json
{
  "order_id": 128,
  "invoice_avilable": true,
  "invoice_url": "https://api.artkolkata.com/api/v1/orders/invoice/128",
  "payment_slip_url": "https://api.artkolkata.com/api/v1/orders/payment-slip/128"
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `invoice_avilable` | `boolean` | `true` only when an admin uploaded an invoice. (Yes, the spelling is `avilable` — kept for backwards compatibility) |
| `invoice_url` | `string \| null` | `null` whenever `invoice_avilable` is `false`. Guard on the URL, not just the flag |
| `payment_slip_url` | `string` | Always present |

URLs are absolute (built from the API's `API_BASE_URL`), so open them directly — no base-URL prefixing.

Suggested rendering:

```tsx
{order.invoice_url && (
  <a href={order.invoice_url} target="_blank">Invoice</a>
)}
<a href={order.payment_slip_url} target="_blank">Payment slip</a>
```

---

## Standard response envelope

Same envelope as the rest of the API ([httpResponse.ts](../src/utils/httpResponse.ts)):

```json
{
  "statusCode": 200,
  "message": "Order list",
  "success": true,
  "data": [],
  "key": [],
  "totalPage": 0
}
```

---

## 1. CMS order list — `GET /orders`

Requires a CMS user holding permission **`1-5`** (`isAuthorizedV2(["1-5"])`).

```
Authorization: Bearer eyJhbGciOi...
```

| Query | Type | Notes |
| --- | --- | --- |
| `orderid` | string | Exact match on `order_number` |
| `from` + `to` | date | Both required together; filters `created_at` |
| `pstatus` | string | Exact `payment_status` |
| `ostatus` | string | Exact `order_status` |
| `page` | number | Defaults to `1` |
| `limit` | number | Defaults to `10`. Pass `-1` (on `page` or `limit`) to disable pagination |

**Response 200**

```json
{
  "statusCode": 200,
  "message": "Order list",
  "success": true,
  "data": [
    {
      "order_id": 128,
      "order_number": "ORD2026081774213",
      "user_name": "Somnath Gupta",
      "total_amount": "4250.00",
      "payment_status": "PAID",
      "order_status": "DELIVERED",
      "order_date": "17 Aug 2026",
      "is_returnable": false,
      "invoice_avilable": true,
      "invoice_url": "https://api.artkolkata.com/api/v1/orders/invoice/128",
      "payment_slip_url": "https://api.artkolkata.com/api/v1/orders/payment-slip/128"
    },
    {
      "order_id": 127,
      "order_number": "ORD2026081638910",
      "user_name": "Riya Das",
      "total_amount": "980.00",
      "payment_status": "PENDING",
      "order_status": "PENDING",
      "order_date": "16 Aug 2026",
      "is_returnable": true,
      "invoice_avilable": false,
      "invoice_url": null,
      "payment_slip_url": "https://api.artkolkata.com/api/v1/orders/payment-slip/127"
    }
  ]
}
```

Order 127 has no uploaded invoice, so `invoice_url` is `null` — but its payment slip still works.

---

## 2. Storefront order list — `GET /users/orders`

Requires a logged-in customer (`isAuthenticated`). Returns that user's own orders; a staff user holding `1-11`, `1-12` or `1-5` may pass `?userid=` to read someone else's.

The same three fields were added here, alongside the existing `is_returnable`, `is_replaceable`, `is_cancelable`, `tracking_id` and `ordered_products`.

**Response 200** (trimmed)

```json
{
  "statusCode": 200,
  "message": "User order list",
  "success": true,
  "data": [
    {
      "order_id": 128,
      "order_number": "ORD2026081774213",
      "order_date": "17 Aug 2026",
      "order_status": "DELIVERED",
      "total_amount": "4250.00",
      "payment_method": "ONLINE",
      "is_returnable": true,
      "is_replaceable": true,
      "is_cancelable": false,
      "invoice_avilable": true,
      "invoice_url": "https://api.artkolkata.com/api/v1/orders/invoice/128",
      "payment_slip_url": "https://api.artkolkata.com/api/v1/orders/payment-slip/128",
      "tracking_id": "1234567890",
      "ordered_products": []
    }
  ]
}
```

### `ordered_products[].product_slug` — added

Every entry in `ordered_products` now carries `product_slug`, so an order line can be linked straight to its product page (`/product/{product_slug}`).

It resolves to the product's **current** slug, looked up live from the `products` table — so a link keeps working after an admin edits a slug, and orders placed before this change also return it. It falls back to the slug snapshotted on the order line, and is `null` only if the product row was deleted outright. Always guard before building the link.

```json
"ordered_products": [
  {
    "product_name": "Terracotta Wall Plate",
    "product_slug": "terracotta-wall-plate",
    "quantity": 2,
    "sku": "TWP-RED-M",
    "price": "1250.00",
    "images": { "image": "/public/products/twp-1.webp", "alt_tag": "Terracotta wall plate" }
  }
]
```

### `is_cancelable` — changed

`is_cancelable` is now `true` **only while `order_status === "PENDING"`**. It used to also cover `CONFIRMED` and `SHIPPED`.

Once an order is confirmed the shipment is booked with the courier, so the customer cannot cancel it themselves any more — that becomes a support job.

The storefront now **hides** the Cancel Order button when `is_cancelable` is `false`, instead of showing it greyed out.

`POST /orders/cancel` enforces the same rule server-side. Cancelling anything that is not `PENDING` returns:

```json
{
  "statusCode": 400,
  "message": "This order can no longer be cancelled. Only orders that are still pending can be cancelled.",
  "success": false,
  "data": null,
  "key": [],
  "totalPage": 0
}
```

`is_returnable` and `is_replaceable` are unchanged (still `DELIVERED` within 7 days).

---

## 3. Download the uploaded invoice — `GET /orders/invoice/:orderid`

Public (no token). Prefer using `invoice_url` from the list rather than composing this path.

Returns the raw uploaded file as an attachment:

```
Content-Type: application/pdf          (or image/jpeg)
Content-Disposition: attachment; filename="invoice-ORD2026081774213.pdf"
```

Open it in a new tab / `window.open` — it is a binary download, not JSON.

| Status | When |
| --- | --- |
| `200` | Uploaded invoice returned |
| `400` | Missing `:orderid` |
| `404` | `"Order information not found!"` — no such order |
| `404` | `"No invoice has been uploaded for this order"` — order exists, nothing uploaded |
| `500` | `"The uploaded invoice for this order is unreadable"` — stored file is corrupt |

Error bodies use the standard envelope with `success: false`:

```json
{
  "statusCode": 404,
  "message": "No invoice has been uploaded for this order",
  "success": false,
  "data": null,
  "key": [],
  "totalPage": 0
}
```

---

## 4. Download the payment slip — `GET /orders/payment-slip/:orderid`

Public (no token). New endpoint. Available for **every** order regardless of `order_status` or `payment_status`.

Returns an **HTML page** (server-rendered [invoice.ejs](../views/invoice.ejs)), not JSON and not a file stream. The page auto-triggers a client-side PDF save as `payment-slip-{order_number}.pdf` via html2pdf once it loads.

So: open it in a new tab (`window.open(order.payment_slip_url)` or `<a target="_blank">`). Do **not** `fetch()` it and expect JSON.

| Status | When |
| --- | --- |
| `200` | HTML payment slip rendered |
| `400` | Missing `:orderid` |
| `404` | `"Order information not found!"` |

Content on the slip: order number, order date, total, payment method (`Cash on delivery` / `Online Paid`), line items with quantity and price, subtotal, shipping charge, billing address and shipping address.

---

## 5. Admin upload / remove an invoice (CMS only)

Both require permission **`1-5`**.

### `PUT /orders/:orderid/invoice`

```json
{
  "invoice_document": "data:application/pdf;base64,JVBERi0xLjQK..."
}
```

- Base64 **data URI** only. PDF or JPEG. Max 8 MB (the CMS enforces this before sending).
- Overwrites any invoice already on file.
- After success, that order's `invoice_avilable` flips to `true` and `invoice_url` starts coming back non-null.

**Response 200** — `"Invoice uploaded"`. `404` if the order does not exist.

### `DELETE /orders/:orderid/invoice`

Clears the upload. `invoice_avilable` goes back to `false` and `invoice_url` back to `null`. The payment slip is unaffected.

**Response 200** — `"Uploaded invoice removed"`. `404` if the order does not exist.

---

## 6. Single order detail — `GET /orders/:orderid`

Permission **`1-5`**. Unchanged by this work, but relevant: `orderInfo.has_invoice_document` (`boolean`) tells the CMS whether an upload exists, without shipping the multi-MB data URI down. Use it to decide between the Upload and Replace/Remove UI.

---

## Storage note

Column `orders.invoice_document TEXT` ([database.sql](../src/config/database.sql)) holds the uploaded file as a data URI. The same file is what a B2B (multi-box) shipment is booked to Bigship with, which is why the upload is restricted to PDF/JPEG.

---

## Open item — auth on the download routes

Both `GET /orders/invoice/:orderid` and `GET /orders/payment-slip/:orderid` are currently **unauthenticated**, and `:orderid` is a sequential integer. The payment slip shows the customer's name, address, phone and email, so anyone can enumerate order ids and read them. This existed before for delivered orders; it now covers every order. Flag to backend if the frontend flow can accommodate a token on these routes.
