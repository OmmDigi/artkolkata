# Wishlist API — Frontend Integration Guide

The wishlist now lives in the database instead of `localStorage`. Every row is tied to a
`user_id`, so the wishlist follows the customer across devices.

**Base URL:** `process.env.NEXT_PUBLIC_API_BASE_URL`
**Auth:** every endpoint needs the login token. `lib/fetcher.tsx` already attaches
`Authorization: Bearer <token>` on each request, so just use `getRequest` / `postRequest` /
`deleteRequest` from there.

---

## 1. Endpoints

All paths are prefixed with `/api/v1/wishlist`.

| # | Method | Path | What it does |
|---|--------|------|--------------|
| 1 | GET | `/api/v1/wishlist` | Full wishlist with product details (paginated) |
| 2 | GET | `/api/v1/wishlist/ids` | Just the product ids — for the heart icon state |
| 3 | POST | `/api/v1/wishlist` | Add a product |
| 4 | DELETE | `/api/v1/wishlist/:product_id` | Remove one product |
| 5 | DELETE | `/api/v1/wishlist` | Clear the whole wishlist |

Every response uses the standard envelope:

```json
{
  "statusCode": 200,
  "message": "Wishlist",
  "success": true,
  "data": [],
  "key": [],
  "totalPage": 0
}
```

---

### 1. Get the wishlist

```
GET /api/v1/wishlist?page=1&limit=10
```

`page` and `limit` are optional (default `page=1`, `limit=10`). Pass `limit=-1` to get
everything in one shot.

`data` is an array of **full product objects** — the same shape the product listing API
returns, so you can drop each item straight into `<ProductCard />`:

```json
{
  "wishlist_id": 12,
  "added_at": "2026-08-27T09:15:00.000Z",
  "id": 45,
  "name": "Product name",
  "slug": "product-name",
  "price": "999.00",
  "min_price": "899.00",
  "max_price": "1299.00",
  "category_slug": "dresses",
  "category_name": "Dresses",
  "images": [{ "id": 1, "image": "https://...", "alt_tag": "", "position": 0, "type": "image" }],
  "rating": "4.5",
  "total_ratings": "12"
}
```

Newest saved item comes first. `totalPage` in the envelope drives pagination.

> Products the admin has set to private are automatically hidden from this list.

---

### 2. Get only the product ids

```
GET /api/v1/wishlist/ids
```

```json
{ "data": [45, 46, 91] }
```

Use this on page load to know which hearts should be filled. It is a tiny response, so it is
safe to call on every route change.

---

### 3. Add a product

```
POST /api/v1/wishlist
Content-Type: application/json

{ "product_id": 45 }
```

**Adding the same product twice is safe.** The `(user_id, product_id)` pair is unique in the
database, so a repeat add is silently ignored — no duplicate row, no error. You still get a
`200`, only the message changes:

- first time → `"Added to wishlist"`
- already there → `"Product is already in the wishlist"`

So you never need to check "is it already in the wishlist?" before calling this.

Errors:

| Status | When |
|--------|------|
| 400 | `product_id` missing or not a number |
| 401 | not logged in |
| 404 | that product does not exist |

---

### 4. Remove a product

```
DELETE /api/v1/wishlist/45
```

Removing something that is not in the wishlist is also a no-op and still returns `200`.

---

### 5. Clear the wishlist

```
DELETE /api/v1/wishlist
```

---

## 2. What changes in the current code

Today `store/useWishlistStore.tsx` (and the duplicate at `hooks/useWishlistStore.tsx`) keeps
the wishlist in `localStorage`. Swap the internals of that store for API calls and every
component that uses it keeps working — the components read `wishlist` and call
`toggleWishlist(product)`, and that public shape does not have to change.

Files that consume the store today:

- `components/ProductCard.tsx`
- `components/Navbar.tsx`
- `components/BottomNavigation.tsx`
- `app/product/[slug]/page.tsx`
- `app/wishlist/page.tsx`

---

## 3. Suggested store

```tsx
// store/useWishlistStore.tsx
import { create } from "zustand";
import { getRequest, postRequest, deleteRequest } from "@/lib/fetcher";

interface WishlistState {
  ids: number[];            // for the heart icons
  wishlist: any[];          // full products, for the wishlist page
  loading: boolean;
  fetchIds: () => Promise<void>;
  fetchWishlist: () => Promise<void>;
  toggleWishlist: (product: any) => Promise<void>;
  clear: () => void;
}

export const useWishlistStore = create<WishlistState>((set, get) => ({
  ids: [],
  wishlist: [],
  loading: false,

  // call once after login / on app mount
  fetchIds: async () => {
    try {
      const res: any = await getRequest("/api/v1/wishlist/ids");
      set({ ids: res.data ?? [] });
    } catch {
      set({ ids: [] }); // logged out — nothing to show
    }
  },

  // call on the wishlist page
  fetchWishlist: async () => {
    set({ loading: true });
    try {
      const res: any = await getRequest("/api/v1/wishlist?limit=-1");
      set({
        wishlist: res.data ?? [],
        ids: (res.data ?? []).map((p: any) => p.id),
      });
    } catch {
      set({ wishlist: [] });
    } finally {
      set({ loading: false });
    }
  },

  toggleWishlist: async (product) => {
    if (!product?.id) return;

    const productId = Number(product.id);
    const exists = get().ids.includes(productId);

    // optimistic update so the heart flips instantly
    set((state) => ({
      ids: exists
        ? state.ids.filter((id) => id !== productId)
        : [...state.ids, productId],
      wishlist: exists
        ? state.wishlist.filter((p) => Number(p.id) !== productId)
        : state.wishlist,
    }));

    try {
      if (exists) {
        await deleteRequest({ url: `/api/v1/wishlist/${productId}` });
      } else {
        await postRequest({
          url: "/api/v1/wishlist",
          body: { product_id: productId },
        });
      }
    } catch (err) {
      // request failed — put the icon back where it was
      set((state) => ({
        ids: exists
          ? [...state.ids, productId]
          : state.ids.filter((id) => id !== productId),
      }));
    }
  },

  // call this from the logout handler
  clear: () => set({ ids: [], wishlist: [] }),
}));
```

In `ProductCard.tsx` the only line that changes:

```tsx
// before
const inWishlist = wishlist.some((w) => w?.id === product?.id);

// after
const inWishlist = ids.includes(Number(product?.id));
```

---

## 4. Login / logout handling

- The wishlist is **per user**, so it only works when logged in. Calling any endpoint without a
  token returns `401`, and the axios interceptor in `lib/fetcher.tsx` logs the user out on
  `401`/`403` — do not call these endpoints on a page a guest can open unless you handle that.
- If a guest taps the heart, send them to `/account` to log in instead of calling the API.
- After a successful login, call `fetchIds()`.
- On logout, call `clear()`.

### Migrating the old localStorage wishlist (optional, one time)

Right after login, if `localStorage.getItem("wishlist")` still has items, POST each one and
then delete the key. Duplicates are ignored by the API, so this is safe to run more than once:

```tsx
const saved = JSON.parse(localStorage.getItem("wishlist") || "[]");
for (const item of saved) {
  if (item?.id) {
    await postRequest({
      url: "/api/v1/wishlist",
      body: { product_id: Number(item.id) },
    }).catch(() => {});
  }
}
localStorage.removeItem("wishlist");
await useWishlistStore.getState().fetchIds();
```

---

## 5. Quick checklist

- [ ] Rewrite `store/useWishlistStore.tsx` to use the API (delete the duplicate `hooks/useWishlistStore.tsx`)
- [ ] `ProductCard.tsx` — heart state from `ids`
- [ ] `Navbar.tsx` / `BottomNavigation.tsx` — badge count from `ids.length`
- [ ] `app/wishlist/page.tsx` — call `fetchWishlist()` on mount, render `wishlist`
- [ ] `app/product/[slug]/page.tsx` — heart state from `ids`
- [ ] Call `fetchIds()` after login, `clear()` on logout
- [ ] Guests tapping the heart → redirect to `/account`
- [ ] One-time migration of the old localStorage wishlist
