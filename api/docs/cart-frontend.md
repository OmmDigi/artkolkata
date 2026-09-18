# Cart API — Frontend Integration Guide

The cart now lives in the database as well as in `localStorage`. Every row is tied to a
`user_id`, so a cart filled on a phone is there on the desktop, and the CMS can see what a
customer left behind.

The rule in one line: **a guest shops into `localStorage`; a logged-in customer shops into the
API, and the API's answer is the truth.**

**Base URL:** `process.env.NEXT_PUBLIC_API_BASE_URL`
**Auth:** every storefront endpoint needs the login token. `lib/fetcher.tsx` already attaches
`Authorization: Bearer <token>`, so use `getRequest` / `postRequest` / `patchRequest` /
`deleteRequest` from there. `patchRequest` is new — if your copy of `fetcher.tsx` does not have
it yet, see §7.

---

## 0. Working on this with an AI agent

If you hand this file to an agent, give it these three invariants, because they are the parts
that break quietly:

1. **Every write returns the whole cart.** Set state from the response; never patch state by
   hand after a successful write.
2. **`PATCH` sets the quantity, `POST` adds to it.** The quantity stepper must use `PATCH`.
   Using `POST` for the stepper double-counts every click.
3. **Merge the guest cart only when the account cart is empty.** Merging on every load doubles
   quantities, because merge sums.

Files it will touch: `store/useCartStore.tsx`, `lib/fetcher.tsx`, the login handlers
(`components/account/signIn.tsx`, `components/account/Otp1.tsx`), the logout handler
(`hooks/useUserStore.tsx`), and `components/Navbar.tsx` for the one-time hydrate.

---

## 1. Endpoints

All paths are prefixed with `/api/v1/cart`.

| # | Method | Path | What it does |
|---|--------|------|--------------|
| 1 | GET | `/api/v1/cart` | The whole cart, product + variant details joined live |
| 2 | GET | `/api/v1/cart/summary` | Counts and total only — for the navbar badge |
| 3 | POST | `/api/v1/cart` | Add a line, or **add to** the quantity of an existing line |
| 4 | PATCH | `/api/v1/cart` | **Set** the quantity of a line (`0` removes it) |
| 5 | DELETE | `/api/v1/cart/:product_id?variant_id=` | Remove one line |
| 6 | DELETE | `/api/v1/cart` | Clear the cart |
| 7 | POST | `/api/v1/cart/merge` | Hand the guest cart over at login |

Every response uses the standard envelope:

```json
{
  "statusCode": 200,
  "message": "Cart",
  "success": true,
  "data": [],
  "key": [],
  "totalPage": 0
}
```

**Endpoints 1 and 3–7 all return the full cart in `data`.** One shape, whatever you called. No
pagination — the cart is returned whole.

Rate limit: 120 requests per minute per user across these endpoints. A stepper that fires one
request per click will hit that, which is why §6 debounces it.

---

## 2. The cart item shape

`data` is an array of items in exactly the shape the zustand store keeps, so it can be assigned
straight to `cart` with no mapping beyond dropping the extras:

```json
{
  "cart_id": 12,
  "id": 45,
  "variantId": 7,
  "quantity": 2,
  "added_at": "2026-09-18T09:15:00.000Z",
  "product": {
    "id": 45,
    "name": "Product name",
    "slug": "product-name",
    "status": 1,
    "sku": "SKU-RED-M",
    "variant_id": 7,
    "price": 1299,
    "compare_at_price": 1799,
    "stock": 5,
    "available": true,
    "images": [
      { "image": "/uploads/a.jpg", "alt_tag": "", "position": 0, "type": "image" }
    ],
    "variations": [
      { "name": "Color", "value": "Red" },
      { "name": "Size", "value": "M" }
    ],
    "category_name": "Dresses",
    "category_slug": "dresses"
  }
}
```

Notes that matter when you render it:

- `variantId` is `null` for a product sold without options. Lines are identified by the
  **pair** `(id, variantId)`, never by `id` alone.
- `price` and `compare_at_price` are **numbers**, not strings, and they are the variant's price
  when there is a variant, the product's price otherwise. They are read fresh on every request,
  so a cart filled last week shows today's price.
- `images` is the variant's images when the variant has any, the product's images otherwise.
  Same `{ image, alt_tag, position, type }` shape the product APIs use — prefix with
  `NEXT_PUBLIC_UPLOAD_API_BASE_URL` the way the rest of the app does.
- `variations` is what the customer picked, ready to print as `Color: Red, Size: M`.
- `stock` is what is left of that exact line. It is **not** enforced when adding; stock is
  checked when the order is placed, because what is available changes while a cart sits there.
- Products the admin has set to private are dropped from this list automatically.

---

### 1. Get the cart

```
GET /api/v1/cart
```

Newest line first. Call it once on app mount — see §5 for the rule that stops it from wiping a
cart that only exists in the browser.

### 2. Get the summary

```
GET /api/v1/cart/summary
```

```json
{ "data": { "total_items": 3, "total_quantity": 7, "cart_total": 5497 } }
```

`total_items` is lines, `total_quantity` is units. Cheap enough to call on route changes if you
only need the badge.

### 3. Add to the cart

```
POST /api/v1/cart
Content-Type: application/json

{ "product_id": 45, "variant_id": 7, "quantity": 1 }
```

- `variant_id` is optional and may be `null` — send `null`, do not omit it, for a product with
  no variants.
- `quantity` is optional, defaults to `1`, and is **added** to what is already on that line.
- Quantity is capped at `99` per line; asking for more saturates instead of failing.
- Sending the same line twice is safe: it becomes one line with the quantities summed.

### 4. Set a quantity

```
PATCH /api/v1/cart
Content-Type: application/json

{ "product_id": 45, "variant_id": 7, "quantity": 3 }
```

This is what the quantity stepper uses. It **sets** rather than adds, which is what makes a
dropped, duplicated or out-of-order request harmless.

`quantity: 0` deletes the line — that is what the last press of "−" should send.

A `PATCH` for a line that is no longer there creates it, so a stepper on a stale page does not
error.

### 5. Remove a line

```
DELETE /api/v1/cart/45?variant_id=7
```

Leave `variant_id` off for a line with no variant. Removing something that is not there is a
no-op and still returns `200`.

### 6. Clear the cart

```
DELETE /api/v1/cart
```

Call this after an order is placed.

### 7. Merge the guest cart

```
POST /api/v1/cart/merge
Content-Type: application/json

{
  "items": [
    { "product_id": 45, "variant_id": 7, "quantity": 2 },
    { "product_id": 51, "variant_id": null, "quantity": 1 }
  ]
}
```

Quantities are **summed** into the account cart, not replaced. Products that no longer exist or
have been made private are skipped rather than failing the whole call, because this runs inside
the login flow and must not block it. Max 100 items per call.

---

## 3. Errors

| Status | When |
|--------|------|
| 400 | Validation: missing/invalid `product_id`, `quantity` out of range (`1..99`, or `0..99` on PATCH) |
| 400 | `"This product is not available"` — the product is private |
| 401 | No token, or the token expired |
| 404 | `"Product not found"` / `"Product variant not found"` — including a variant that belongs to another product |
| 429 | Rate limit — the stepper is not debounced |

The axios interceptor in `lib/fetcher.tsx` logs the user out on `401`/`403`. So **do not call
these endpoints for a guest.** Check for a token first; a guest's cart stays in `localStorage`.

---

## 4. The two modes

| | Guest | Logged in |
|---|---|---|
| Where the cart lives | `localStorage` only | Database, mirrored to `localStorage` |
| On add / change | Local only | Local first (instant), then the API |
| Source of truth | The browser | The server's reply |
| Survives a new device | No | Yes |

Local-first is deliberate: the screen updates on click, the request follows. When a write
fails, do **not** try to guess what got through — re-read `GET /api/v1/cart` and take that.

---

## 5. Login, logout, checkout

**On login** (both the password login and the OTP login), after the token is stored:

```tsx
await useCartStore.getState().mergeGuestCart();
```

That posts whatever is in `localStorage` to `/merge` and replaces the local cart with the
merged result.

**On app mount** (do it once, e.g. in `Navbar.tsx`):

```tsx
useEffect(() => {
  useCartStore.getState().hydrateCart();
}, []);
```

`hydrateCart` has one rule worth keeping:

- Account cart **not empty** → it replaces the local cart. The server wins. This is what stops
  a reload from doubling quantities.
- Account cart **empty** and the browser has items → merge those items up instead of wiping
  them. This covers carts filled before this feature shipped, and carts filled while the API
  was unreachable.

**On logout:** clear the browser copy only. The account cart stays on the server, waiting for
the next login.

```tsx
useCartStore.getState().resetLocalCart();
```

**After an order is placed:** `clearCart()`, which empties both sides.

---

## 6. Debounce the quantity stepper

A stepper held down fires one click per unit. Without a debounce that is one request per click,
and at ~120/minute the customer starts getting `429`s.

Keep one pending timer **per line**, keyed by `product:variant`, and read the quantity when the
timer fires rather than when it was scheduled — ten taps become one `PATCH` carrying the final
number. 600ms works well.

Four races to handle, all of them cheap:

- **Remove** cancels that line's pending write before sending the `DELETE`.
- **Add** on a line that already has a pending write reschedules that write instead of sending
  a `POST` — otherwise the click is counted twice, once locally and once by the server's add.
- **Clear / hydrate / merge / logout** cancel every pending write, so nothing lands after the
  cart was wiped or replaced.
- A timer that fires on a line that is gone sends nothing.

---

## 7. `patchRequest` for `lib/fetcher.tsx`

If your `fetcher.tsx` only has get/post/delete, add this next to them:

```tsx
export const patchRequest = async <T = unknown,>(
  config: RequestConfig,
): Promise<T> => {
  const response: AxiosResponse<T> = await API.patch(config.url, config.body, {
    headers: config.headers,
  });
  return response.data;
};
```

---

## 8. Reference store

This is the working shape of `store/useCartStore.tsx`. The public API the components use —
`cart`, `addToCart`, `removeFromCart`, `updateQuantity`, `isInCart`, `getItemQty`, `clearCart`
— is unchanged from the old `localStorage`-only store, so components keep working as they are.
What is new is `hydrateCart`, `mergeGuestCart` and `resetLocalCart`.

```tsx
import { create } from "zustand";
import { deleteRequest, getRequest, patchRequest, postRequest } from "@/lib/fetcher";

const isLoggedIn = () =>
  typeof window !== "undefined" && !!localStorage.getItem("token");

const QUANTITY_SYNC_DELAY = 600;
const quantityTimers: Record<string, ReturnType<typeof setTimeout>> = {};
const lineKey = (id: number, variantId: number | null) => `${id}:${variantId ?? 0}`;

const cancelPendingSync = (key: string) => {
  if (!quantityTimers[key]) return;
  clearTimeout(quantityTimers[key]);
  delete quantityTimers[key];
};

export const useCartStore = create<CartState>((set, get) => {
  // every write answers with the whole cart, so the reply replaces the screen
  const applyServerCart = (res: any) => {
    const cart = (res?.data ?? []).map((row: any) => ({
      id: Number(row.id),
      variantId: row.variantId ?? null,
      quantity: Number(row.quantity),
      product: row.product,
    }));
    localStorage.setItem("cart", JSON.stringify(cart));
    set({ cart });
  };

  // a failed write leaves the screen ahead of the account : re-read, don't guess
  const resync = async () => {
    try {
      applyServerCart(await getRequest("/api/v1/cart"));
    } catch {}
  };

  // the stepper : one request once the clicking stops, carrying the final number
  const scheduleQuantitySync = (id: number, variantId: number | null) => {
    if (!isLoggedIn()) return;
    const key = lineKey(id, variantId);
    cancelPendingSync(key);

    quantityTimers[key] = setTimeout(() => {
      delete quantityTimers[key];
      const quantity = get().getItemQty(id, variantId);
      if (quantity <= 0) return; // the line was removed meanwhile

      patchRequest({
        url: "/api/v1/cart",
        body: { product_id: Number(id), variant_id: variantId ?? null, quantity },
      })
        .then(applyServerCart)
        .catch(resync);
    }, QUANTITY_SYNC_DELAY);
  };

  return {
    cart: JSON.parse(localStorage.getItem("cart") || "[]"),

    addToCart: (product, variantId, quantity = 1) => {
      // ... local optimistic update + localStorage write, unchanged ...

      if (!isLoggedIn()) return;

      // a stepper on this line is still settling and its PATCH carries the whole
      // quantity, so reschedule it instead of adding on top
      if (quantityTimers[lineKey(Number(product.id), variantId)]) {
        scheduleQuantitySync(Number(product.id), variantId);
        return;
      }

      postRequest({
        url: "/api/v1/cart",
        body: { product_id: Number(product.id), variant_id: variantId ?? null, quantity },
      })
        .then(applyServerCart)
        .catch(resync);
    },

    updateQuantity: (id, variantId, quantity) => {
      // ... local optimistic update + localStorage write ...
      scheduleQuantitySync(id, variantId);
    },

    removeFromCart: (id, variantId) => {
      // ... local removal ...
      cancelPendingSync(lineKey(id, variantId));
      if (!isLoggedIn()) return;

      deleteRequest({
        url: `/api/v1/cart/${id}${variantId ? `?variant_id=${variantId}` : ""}`,
      })
        .then(applyServerCart)
        .catch(resync);
    },

    hydrateCart: async () => {
      if (!isLoggedIn()) return;
      try {
        const res: any = await getRequest("/api/v1/cart");
        // empty account cart + items in this browser → hand them over, don't wipe
        if ((res?.data?.length ?? 0) === 0 && get().cart.length > 0) {
          await get().mergeGuestCart();
          return;
        }
        applyServerCart(res);
      } catch {
        // keep localStorage rather than blanking the cart
      }
    },

    mergeGuestCart: async () => {
      if (!isLoggedIn()) return;
      const items = get().cart.filter((i: any) => i?.id).map((i: any) => ({
        product_id: Number(i.id),
        variant_id: i.variantId ?? null,
        quantity: Math.max(1, Number(i.quantity) || 1),
      }));

      try {
        applyServerCart(
          items.length
            ? await postRequest({ url: "/api/v1/cart/merge", body: { items } })
            : await getRequest("/api/v1/cart"),
        );
      } catch {
        // login must not fail because of the cart hand-over
      }
    },
  };
});
```

---

## 9. Quick checklist

- [ ] Add `patchRequest` to `lib/fetcher.tsx`
- [ ] `store/useCartStore.tsx` — local-first writes, server reply wins, `resync()` on failure
- [ ] Only call the API when a token exists; guests stay on `localStorage`
- [ ] Debounce the quantity stepper per line (600ms), with the four races in §6 handled
- [ ] `mergeGuestCart()` after the password login **and** after the OTP login
- [ ] `hydrateCart()` once on app mount — server wins unless the account cart is empty
- [ ] `resetLocalCart()` on logout (browser only, the account cart stays)
- [ ] `clearCart()` after an order is placed
- [ ] If you keep a second copy of the store under `hooks/`, re-export the real one instead —
      two `create()` calls are two stores, and writes to one never reach the other
