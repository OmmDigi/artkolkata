# Order Invoice, Packing Slip & Payment Slip API

Base URL: `{HOST}/api/v1`
All JSON bodies are `Content-Type: application/json`.

An order can have **three different downloadable documents**, and they are not the same thing:

| Document | Where it comes from | Availability | Response field |
| --- | --- | --- | --- |
| **Invoice** | Either a PDF/JPEG an admin uploads from the CMS, or a PDF the CMS generates (§7) | Once one of the two exists | `invoice_url` (`null` until then) |
| **Packing slip** | A PDF the CMS generates from the order record | Once generated. **Admin only** | `packing_slip_url` (`null` until then) |
| **Payment slip** | An HTML page the API renders from the order record | **Always**, for every order, at every status | `payment_slip_url` (never `null`) |

The payment slip is **not an invoice** — it is a record of what was ordered and what was paid, and it predates the generated invoice. It is still served, unchanged, for every order.

All three can exist at the same time and none of them replaces another. When both an uploaded and a generated invoice exist, `invoice_url` serves the **uploaded** one: an admin who uploads a file with the Generate button sitting next to it means that file to be the invoice.

---

## ⚠️ Breaking changes from the previous behaviour

Read this before wiring the UI.

1. **`GET /orders/invoice/:orderid` serves an invoice of either kind.** The uploaded file wins; if there is none but an invoice has been generated (§7), that PDF is served instead. It returns **404** only when the order has neither. It never falls back to the payment slip — use `payment_slip_url` for that.
2. **`invoice_avilable` means "this order has an invoice", of either kind.** It used to mean "an admin uploaded one".
   - Order list (CMS): `upload exists OR generated invoice exists`.
   - User order list (storefront): same. A generated invoice is therefore visible to the customer as soon as an admin generates it.
   - The CMS list also gets `invoice_uploaded` and `invoice_generated` when it needs to tell the two apart.
3. **Do not build these URLs by hand any more.** The API sends both, absolute and ready to open. Stop concatenating `${API_BASE_URL}/api/v1/orders/invoice/${order_id}`.
4. **The `DELIVERED` gate on the generated document is gone.** A `PENDING` or `CANCELLED` order now has a working payment slip.
5. **`is_cancelable` is now `PENDING` only** (was `PENDING | CONFIRMED | SHIPPED`). See [§2](#is_cancelable--changed).
6. **`ordered_products[].product_slug` added** on the storefront order list. See [§2](#ordered_productsproduct_slug--added).

---

## Fields added to every order row

Both order-list endpoints return these fields on each row:

```json
{
  "order_id": 128,
  "invoice_avilable": true,
  "invoice_url": "https://api.luvlettecurves.in/api/v1/orders/invoice/128",
  "payment_slip_url": "https://api.luvlettecurves.in/api/v1/orders/payment-slip/128",
  "packing_slip_url": "https://api.luvlettecurves.in/api/v1/orders/128/packing-slip"
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `invoice_avilable` | `boolean` | `true` when the order has an invoice of either kind. (Yes, the spelling is `avilable` — kept for backwards compatibility) |
| `invoice_url` | `string \| null` | `null` whenever `invoice_avilable` is `false`. Guard on the URL, not just the flag |
| `payment_slip_url` | `string` | Always present |
| `packing_slip_url` | `string \| null` | `null` until the packing slip is generated. **CMS list only** — the storefront never receives it |

The CMS list carries four more, so the Documents UI can label what it is looking at:

| Field | Type | Notes |
| --- | --- | --- |
| `invoice_uploaded` | `boolean` | An admin uploaded a file. This is the one `invoice_url` serves when both exist |
| `invoice_generated` | `boolean` | A generated invoice PDF is on file |
| `invoice_number` | `string \| null` | e.g. `"INV-100023"`. Allotted on the first generate and kept for the life of the order |
| `packing_slip_available` | `boolean` | Mirrors `packing_slip_url !== null` |

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
      "invoice_uploaded": false,
      "invoice_generated": true,
      "invoice_number": "INV-100023",
      "packing_slip_available": true,
      "invoice_url": "https://api.luvlettecurves.in/api/v1/orders/invoice/128",
      "payment_slip_url": "https://api.luvlettecurves.in/api/v1/orders/payment-slip/128",
      "packing_slip_url": "https://api.luvlettecurves.in/api/v1/orders/128/packing-slip"
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
      "invoice_uploaded": false,
      "invoice_generated": false,
      "invoice_number": null,
      "packing_slip_available": false,
      "invoice_url": null,
      "payment_slip_url": "https://api.luvlettecurves.in/api/v1/orders/payment-slip/127",
      "packing_slip_url": null
    }
  ]
}
```

Order 127 has no invoice of either kind, so `invoice_url` is `null` — but its payment slip still works.

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
      "invoice_url": "https://api.luvlettecurves.in/api/v1/orders/invoice/128",
      "payment_slip_url": "https://api.luvlettecurves.in/api/v1/orders/payment-slip/128",
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

## 3. Download the invoice — `GET /orders/invoice/:orderid`

Public (no token). Prefer using `invoice_url` from the list rather than composing this path.

Serves the uploaded file if there is one, otherwise the generated invoice PDF (§7). Either way it is an attachment:

```
Content-Type: application/pdf          (or image/jpeg)
Content-Disposition: attachment; filename="invoice-ORD2026081774213.pdf"
```

Open it in a new tab / `window.open` — it is a binary download, not JSON.

| Status | When |
| --- | --- |
| `200` | Invoice returned — the uploaded file, or the generated PDF when there is no upload |
| `400` | Missing `:orderid` |
| `404` | `"Order information not found!"` — no such order |
| `404` | `"No invoice is available for this order"` — order exists, nothing uploaded and nothing generated |
| `404` | `"The generated document is no longer on the storage server. Generate it again."` — the row points at a file the upload server no longer has |
| `500` | `"The uploaded invoice for this order is unreadable"` — stored data URI is corrupt |

Error bodies use the standard envelope with `success: false`:

```json
{
  "statusCode": 404,
  "message": "No invoice is available for this order",
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

Permission **`1-5`**. `orderInfo.has_invoice_document` (`boolean`) tells the CMS whether an upload exists, without shipping the multi-MB data URI down. Use it to decide between the Upload and Replace/Remove UI.

`orderInfo` also carries the state of the two generated documents:

| Field | Type | Notes |
| --- | --- | --- |
| `has_generated_invoice` | `boolean` | Drives Generate vs Regenerate on the invoice button |
| `has_packing_slip` | `boolean` | Same, for the packing slip |
| `invoice_number` | `string \| null` | `"INV-100023"` once allotted |
| `invoice_generated_at` | `string \| null` | `"16 Sep 2026"`. The invoice's own date — it does **not** move on a regenerate |
| `packing_slip_generated_at` | `string \| null` | `"16 Sep 2026"`. This one does move, every time |

---

## 7. Generate the invoice / packing slip (CMS only)

Both require permission **`1-5`**. Both are `POST` with no body, and both are **idempotent in effect, not in output**: pressing the button again renders the document afresh from the order as it stands now and replaces the stored file. Use it after fixing an address or a line item.

The PDFs are rendered by the API with [@react-pdf/renderer](https://react-pdf.org/), pushed to the upload server's **private** area, and referenced from the order row by path. They are never served from a public URL — every download goes through the API routes below, which check who is asking first.

### `POST /orders/:orderid/invoice/generate`

**Response 200**

```json
{
  "statusCode": 200,
  "message": "Invoice generated",
  "success": true,
  "data": {
    "invoice_number": "INV-100023",
    "invoice_url": "https://api.luvlettecurves.in/api/v1/orders/invoice/128"
  },
  "key": [],
  "totalPage": 0
}
```

The invoice number comes from its own Postgres sequence, not from the order number, and **both the number and the invoice date are allotted once**. Regenerating keeps them: a customer already holding `INV-100023` dated the 4th must not receive a corrected document that calls itself something else.

Generating does not touch an uploaded invoice — if one exists it still wins at `invoice_url`, and the generated PDF sits behind it until the upload is removed.

### `POST /orders/:orderid/packing-slip/generate`

**Response 200**

```json
{
  "statusCode": 200,
  "message": "Packing slip generated",
  "success": true,
  "data": {
    "packing_slip_url": "https://api.luvlettecurves.in/api/v1/orders/128/packing-slip"
  },
  "key": [],
  "totalPage": 0
}
```

The packing slip carries no prices at all — products, quantities, the delivery address and the shipping method. It has no number and its date moves with every regenerate.

| Status | When (both routes) |
| --- | --- |
| `200` | Document generated and stored |
| `400` | Invalid `:orderid` |
| `403` | Missing or insufficient token |
| `404` | `"Order information not found!"` |
| `502` | The upload server refused or could not be reached |

### `GET /orders/:orderid/packing-slip`

Permission **`1-5`** — unlike the invoice, the packing slip is warehouse paperwork and is never served to a customer. Because it needs a token it **cannot be opened with `window.open`**; fetch it with the API client and hand the blob to the browser:

```tsx
const response = await api.get(`/api/v1/orders/${orderId}/packing-slip`, {
  responseType: "blob",
});

const url = URL.createObjectURL(response.data);
const link = document.createElement("a");
link.href = url;
link.download = `packing-slip-${orderNumber}.pdf`;
link.click();
URL.revokeObjectURL(url);
```

```
Content-Type: application/pdf
Content-Disposition: attachment; filename="packing-slip-ORD2026081774213.pdf"
```

| Status | When |
| --- | --- |
| `200` | PDF returned |
| `403` | Missing or insufficient token |
| `404` | `"No packing slip has been generated for this order"` |
| `404` | `"The generated document is no longer on the storage server. Generate it again."` |

### What the documents print

Both share one letterhead, and most of it comes from **Site Info in the CMS** — change it there and the next generated document says so:

| Printed | Source |
| --- | --- |
| Logo | `site_logo` |
| Phone | `contact_phones` — the entry flagged primary, else the first |
| Email | `contact_emails` — same rule |
| Address block | `site_addresses` — the primary entry, printed as line1, line2, `city pincode`, `state, country` |
| Company name | `COMPANY_NAME` env |
| GST number | `COMPANY_GST` env |

Site Info has no field for the registered name or the GST number, so those two stay in the environment — they are legal identity rather than contact details. Every Site Info value falls back to its `COMPANY_*` env var (`COMPANY_PHONE`, `COMPANY_EMAIL`, `COMPANY_ADDRESS_LINE1/2`, `COMPANY_CITY`, `COMPANY_PINCODE`, `COMPANY_STATE`, `COMPANY_COUNTRY`, `COMPANY_LOGO_URL`), so a store that has not filled the settings page still prints a correct header. Blank values are skipped, and with no logo at all the company name is printed as text.

**Two things about the logo.** react-pdf draws PNG and JPEG only, so a webp — what the upload server stores by default — is re-requested as PNG from `GET {upload}/api/v1/view/png/<path>`, which converts it with the sharp that server already runs and caches the result on disk. And a logo drawn for a dark site header is usually light lettering on transparency, which is invisible on a white page: set `COMPANY_LOGO_BG` (e.g. `#333333`) to paint its background back in.

Money is read from the order's `price_breakdown` snapshot, so an invoice always agrees with what the customer was actually charged even after a discount rule or a shipping slab has since been edited. GST is reported as part of the total, never added to it, because it is already inside every price.

---

## Storage note

Column `orders.invoice_document TEXT` ([database.sql](../src/config/database.sql)) holds the **uploaded** file as a data URI. The same file is what a B2B (multi-box) shipment is booked to Bigship with, which is why the upload is restricted to PDF/JPEG.

The generated documents are not stored in the row — only their paths are, in `orders.invoice_pdf_url` and `orders.packing_slip_url`, alongside `invoice_number`, `invoice_generated_at` and `packing_slip_generated_at`. The files themselves live in the upload server's private area under `order-documents/`, reachable only with `PRIVATE_FILE_ACCESS_TOKEN`, which only the API holds. A regenerate stores the new path first and deletes the superseded file afterwards.

---

## Open item — auth on the download routes

Both `GET /orders/invoice/:orderid` and `GET /orders/payment-slip/:orderid` are currently **unauthenticated**, and `:orderid` is a sequential integer. (`GET /orders/:orderid/packing-slip` is not: it requires `1-5`.) The payment slip shows the customer's name, address, phone and email, so anyone can enumerate order ids and read them. This existed before for delivered orders; it now covers every order. Flag to backend if the frontend flow can accommodate a token on these routes.
