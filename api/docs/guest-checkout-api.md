# Guest Checkout — API Guide

A customer can place an order without logging in. Nothing about the order is special
afterwards: it has a `user_id`, it appears in the CMS, it emails the same receipts, and it
books the same shipment.

**Base URL:** `process.env.NEXT_PUBLIC_API_BASE_URL`
**Auth:** `POST /orders/place-order` no longer requires a token. It runs `checkUser`, so a
request with a valid token is an account order and a request without one is a guest order.

---

## 1. How a guest is stored

A guest is a `users` row, created on the fly from the shipping details:

| column | value | meaning |
|--------|-------|---------|
| `password` | `NULL` | login can never succeed |
| `is_verified` | `false` | nobody has proved they own the address |
| `is_guest` | `true` | what the CMS filters on, and what signup clears |

This is why every existing join keeps working — `orders.user_id`, the address book, the
invoice, the emails, the CMS order screens all reach the customer the same way they always
did.

`orders.is_guest_order` records **how the order was placed**, separately from what the
customer is now. A guest who later sets a password stops being a guest, but their earlier
orders still show as guest orders in the CMS.

### Becoming a real account

There is no separate "claim" endpoint. The guest uses the ordinary password flow:

```
POST /api/v1/users/send-otp     { email }
POST /api/v1/users/verify-otp   { email, otp, password }
```

`verify-otp` with a `password` sets the password, marks the row verified and clears
`is_guest`. Every order already attached to that row appears in their history immediately.
Signing up at `POST /api/v1/users/signup` with the same email does the same thing — it
upgrades the shadow row in place rather than refusing it.

---

## 2. Placing a guest order

```
POST /api/v1/orders/place-order
Idempotency-Key: <same key across retries, 16–128 chars>
```

The body is **unchanged** from the logged-in flow:

```json
{
  "shippingDetails": {
    "fullName": "…", "email": "…", "phone": "…",
    "address": "…", "city": "…", "state": "…",
    "pincode": "560001", "country": "India"
  },
  "paymentMethod": "COD",
  "gstDetails": { "gstNumber": "29ABCDE1234F1Z5", "businessName": "Acme Pvt Ltd" },
  "product": { "product_ids": [], "varient_ids": [], "code": "OPTIONAL" }
}
```

`Idempotency-Key` is **required**, not advisory: a request without one is
rejected with `400`. Keep the same key across retries of the same attempt and
mint a new one once the order exists.

### `gstDetails` — optional

Send it only when the customer is buying as a business and wants a GST invoice.
Omit the key entirely otherwise; `null` and `{}` are both rejected.

- `gstNumber` — a GSTIN, 15 characters, matched against
  `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$`. Case is not significant on
  the way in; it is stored upper case.
- `businessName` — 2 to 200 characters. Required whenever `gstNumber` is sent:
  an invoice carrying a GSTIN has to name the entity it belongs to.

A malformed GSTIN is a `400` with the offending field in the message, so
validate it client side too rather than letting the customer find out after
pressing Place Order.

This is the **buyer's** registration, and it has nothing to do with the GST the
store charges — that is already inside every price and is reported on every
document regardless. It is frozen onto the order the way the shipping address
is, so a company that later changes its registered name does not rewrite an
invoice that has already been filed.

Once stored it appears on:

| Where | How |
|-------|-----|
| The generated invoice | Billed-to block: business name above the customer's, `GSTIN: …` under the address |
| The payment slip | `CUSTOMER DETAILS`: business name, then `GSTIN: …` |
| The order confirmation email | Two extra rows in the order summary |
| `GET /orders/guest/order` and `GET /users/orders` | `gst_details: { gst_number, business_name }`, `null` when there is none |
| CMS single order | A **Customer GST Details** block under Shipping Details, hidden when absent |

The packing slip deliberately does not print it — it is a picking document, and
the GSTIN is a billing fact.

Send no `Authorization` header and it is a guest order. `shippingDetails.email` is the
identity: it is lowercased, and it is what the shadow user row is keyed on.

### Response

```json
{
  "statusCode": 201,
  "message": "New order successfully created",
  "data": {
    "gatewayUrl": "https://…",
    "orderNumber": "ORD…",
    "isGuestOrder": true,
    "guestToken": "<jwt>"
  }
}
```

`orderNumber` and `isGuestOrder` are returned for **every** order. `guestToken` is only
present for a guest one.

> **Store `guestToken` before you redirect anywhere**, including to `gatewayUrl`. It is the
> only way back into the order — there is no account to list it under. The storefront keeps
> it in `localStorage` under `guestOrder` (`lib/guestOrder.ts`), which is what survives the
> round trip to the payment gateway.

The token is signed by this API, scoped to one order, and valid for **30 days**. It is not
a session: it can never satisfy `isAuthenticated`, and it grants nothing except the three
calls below.

### Errors worth handling

| Status | `key` | When | What the storefront does |
|--------|-------|------|--------------------------|
| 409 | `ACCOUNT_EXISTS` | The email already belongs to a real account | Save the form, send them to log in, return to checkout |
| 401 | `ACCOUNT_EXISTS` | The owner has switched guest checkout off | Same thing |
| 400 | `ACCOUNT_DISABLED` | That email has been disabled in the CMS | Show the message |
| 409 | — | An identical request is still in flight | Back off and retry with the same key (already handled) |

Blocking on `ACCOUNT_EXISTS` is deliberate: without it, an unauthenticated stranger could
type a customer's email at checkout and file an order into their order history.

---

## 3. Reading the order back

All three take the token in the `x-guest-order-token` header, or as `?guest_token=` in the
query string. The query form exists so a plain link in an email works with no JavaScript.

### `GET /api/v1/orders/guest/order`

Returns the same customer-facing shape as the account order list — one order, not an array:

```json
{
  "order_id": 12, "order_number": "ORD…", "order_date": "16 Sep 2026",
  "order_status": "PENDING", "payment_status": "PENDING", "payment_method": "COD",
  "total_amount": "1299.00",
  "shipping_address": { "name": "…", "email": "…", "phone": "…", "address_line1": "…", "city": "…", "state": "…", "pincode": "…" },
  "price_breakdown": { },
  "is_guest_order": true,
  "is_cancelable": true, "is_returnable": false, "is_replaceable": false,
  "tracking_id": null,
  "invoice_avilable": false, "invoice_url": null, "payment_slip_url": "…",
  "ordered_products": [{ "product_name": "…", "quantity": 1, "sku": null, "price": "…", "images": { } }]
}
```

### `POST /api/v1/orders/guest/cancel`

No body. Same rule as the account flow: only a `PENDING` order can be cancelled, because
after confirmation the shipment is with the courier.

### `GET /api/v1/orders/invoice/:orderid`

Already public — unchanged, no token needed.

---

## 4. What a guest cannot do

- **Returns and replacements.** `POST /orders/return` still requires a session. A guest who
  wants one sets a password first, at which point the order is in their account.
- **See their other orders.** Each token names exactly one order.

`GET /api/v1/orders/track?order_number=…` is public and works for guests as it always has.

---

## 5. The CMS switch

`guest_checkout` is part of the site-info payload, alongside `payment_methods`:

```
GET  /api/v1/settings/site-info
POST /api/v1/settings/site-info
```

```json
{ "guest_checkout": { "enabled": true } }
```

Missing means enabled — a store that has never saved the setting allows guest checkout, and
every reader defaults the same way. Turning it off makes the API refuse guest orders with
`401 ACCOUNT_EXISTS`; the storefront should hide the guest option, but the API is what
enforces it.

CMS screens that changed:

- **Settings → General → Checkout** — the switch.
- **Orders** — a `Guest` badge, the customer's email on the row, and a `customer_type`
  filter (`guest` / `registered`).
- **Single order** — a banner explaining there is no account behind the order.
- **Customers** — a `Guest` badge and the same `customer_type` filter.

---

## 6. Online payments

When a guest pays online, the API-rendered result page sends them to
`FRONTEND_HOST_URL/guest-order` instead of `/account?tab=orders`. No token is on that link —
it relies on the one the storefront stored before handing the customer to the gateway.
