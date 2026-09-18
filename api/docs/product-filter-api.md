# Product Filter API

Base URL: `{HOST}/api/v1/products`
All responses are JSON (`Content-Type: application/json`).

Two things changed:

1. **New endpoint** `GET /products/filters` — returns every filter the storefront should render (categories + sub-categories, variant options, tags, price range), already counted against whatever the shopper has selected so far.
2. **`GET /products` accepts those filters** — price range and variant options are new, category/sub-category/tag now accept multiple values.

Both endpoints share one filter builder ([productFilter.service.ts](../src/services/productFilter.service.ts)), so the facet list and the product list can never disagree about what matches.

---

## Auth

Both endpoints are public — no token needed.

If an admin token *is* sent (`Authorization: Bearer <token>`), two things change:

| | Anonymous / customer | Admin (`1-3` permission) |
| --- | --- | --- |
| Products considered | `status = 1` (public) only | all statuses; `?status=` becomes usable |
| Categories in facets | `is_visible = TRUE` only | all categories |

The storefront should just call these without a token.

---

## Standard response envelope

Same envelope as the rest of the API ([httpResponse.ts](../src/utils/httpResponse.ts)):

```json
{
  "statusCode": 200,
  "message": "Product Filters",
  "success": true,
  "data": { },
  "key": [],
  "totalPage": 0
}
```

The filter payload described below is what lands in `data`.

---

## Query parameters (shared by both endpoints)

Every parameter below works identically on `GET /products` and `GET /products/filters`. Send the shopper's current selection to **both** — the same querystring drives the list and refreshes the facet counts.

| Param | Repeatable | Accepts | Behavior |
| --- | --- | --- | --- |
| `category` | yes | id **or** slug | Matches any of the given categories |
| `sub_category` | yes | id **or** slug | Matches any of the given sub-categories |
| `tag` | yes | tag string | Matches products carrying **any** of the tags |
| `option` | yes | `Name:Value` | Variant option filter — see below |
| `min_price` | no | number | Price overlap — see below |
| `max_price` | no | number | Price overlap — see below |
| `search` | no | string | Full-text match on the product **name or any of its tag names** |
| `search_by` | no | `name` \| `tag` \| `both` | Narrows what `search` looks at. Default `both`; an unknown value falls back to `both` |
| `status` | no | `1` \| `2` | **Admin only.** Ignored without the `1-6` permission |
| `page`, `limit` | no | number | `GET /products` only. `limit=-1` or `page=-1` disables pagination |

### Search

`search` is Postgres full text, not a substring match. Every product keeps a
`search_vector` holding its name and its tag names, and the search box is
matched against it.

```
?search=featured                  # name or tag (default)
?search=featured&search_by=tag    # tag names only
?search=cleanser&search_by=name   # product names only
```

What that means in practice:

| Typed | Matches | Why |
|---|---|---|
| `clean` | "Opulent Barrier Repair **Cleanser**" | Every word is a prefix match, so it works while the shopper is still typing |
| `cleansing` | "…Cleanser" | Words are stemmed — the search knows they are the same word |
| `rice toner` | "**Rice** Water & Niacinamide **Toner**" | Words are AND'ed, in any order, so each word typed narrows the result |
| `feat` | a product tagged `Featured` | Tag names are searched the same way as names |
| `!!!` | nothing | No searchable word in the term |

It matches **whole words (or their prefixes), not any substring**: `oner` no
longer finds "Toner". That is the trade for an index-backed search — searching
the middle of a word cannot use an index.

Punctuation and the tsquery operators (`&` `|` `!` `:` `*`) are stripped from
the term, so nothing a shopper types is treated as query syntax.

Results come back in the normal merchandising order (`sort` still applies) —
they are not ranked by relevance.

### `search` vs `tag`

They answer different questions and combine with AND:

- `?tag=Sale` — exact tag match, what the tag chips / facet UI sends.
- `?search=sal` — free text box, matches a name or tag name by word prefix.

### Repeatable params

Two spellings, both supported, mix freely:

```
?tag=Sale&tag=Trending
?tag=Sale,Trending
```

`category` and `sub_category` accept ids or slugs, but **do not mix them in one request** — the first value decides which column is matched. Send all ids or all slugs.

```
?category=women&category=men     ok
?category=1&category=2           ok
?category=women&category=2       don't
```

### `option` — variant option filter

Format is `OptionName:Value`, taken verbatim from the `query` field the facet endpoint hands you (see `options[].values[].query`).

Matching is **case-insensitive** on both halves.

Values of the **same** option are OR'd, different options are AND'd:

```
?option=Color:Red&option=Color:Blue&option=Size:M
```

→ `(Color = Red OR Blue) AND (Size = M)`

That is the behavior a normal filter sidebar wants: ticking a second colour widens the results, ticking a size narrows them.

Malformed entries (no `:`, empty name, empty value) are silently dropped rather than erroring.

### `min_price` / `max_price` — overlap, not containment

A product's price is a **range**, not a number: products with variants span the cheapest to the costliest variant, products without variants collapse to their own `price`.

```
effective min = COALESCE(MIN(variant price), products.price)
effective max = COALESCE(MAX(variant price), products.price)
```

A product matches when its range **overlaps** the requested range — not when it sits entirely inside it. A dress with variants from ₹120 to ₹1500 shows up for `?min_price=1250&max_price=1300`, because something in that product is buyable at that price.

Either bound can be sent alone. Non-numeric values are ignored.

---

## 1. Available filters — `GET /products/filters`

**Request**

```
GET /api/v1/products/filters
GET /api/v1/products/filters?category=women&option=Color:Red&min_price=500
```

**Response 200** (real payload, trimmed)

```json
{
  "statusCode": 200,
  "message": "Product Filters",
  "success": true,
  "data": {
    "total_products": 4,
    "categories": [
      {
        "id": 1,
        "name": "women",
        "slug": "women",
        "image": "/uploads/media-items/logo-1787567193347.png",
        "product_count": 4,
        "sub_categories": [
          { "id": 3, "name": "Midi Dress", "slug": "midi-dress", "product_count": 2 }
        ]
      }
    ],
    "options": [
      {
        "name": "Color",
        "key": "color",
        "values": [
          { "value": "black", "query": "Color:black", "product_count": 4 },
          { "value": "blue",  "query": "Color:blue",  "product_count": 3 },
          { "value": "Red",   "query": "Color:Red",   "product_count": 2 }
        ]
      },
      {
        "name": "Size",
        "key": "size",
        "values": [
          { "value": "M",  "query": "Size:M",  "product_count": 1 },
          { "value": "xl", "query": "Size:xl", "product_count": 4 }
        ]
      }
    ],
    "tags": [
      { "tag": "New Arrival", "product_count": 2 },
      { "tag": "Best Seller", "product_count": 1 }
    ],
    "price_range": { "min": 120, "max": 2200 }
  },
  "key": [],
  "totalPage": 0
}
```

### Field reference

| Field | Type | Notes |
| --- | --- | --- |
| `total_products` | number | Products matching the **full** current selection. Use it for "24 results" and to detect an empty state before rendering the list |
| `categories[]` | array | Ordered by the admin's `position`. Only categories that actually have matching products appear |
| `categories[].product_count` | number | Products in this category (sum of its sub-category buckets + uncategorised ones) |
| `categories[].sub_categories[]` | array | Ordered by `position`. Products with no sub-category contribute to the parent count only, and produce no row here |
| `options[]` | array | One entry per variant option (Color, Size, …), ordered by the option `position` set in the CMS |
| `options[].name` | string | Display label |
| `options[].key` | string | Lowercased name — stable id, safe for React `key` and for URL state |
| `options[].values[].value` | string | Display label |
| `options[].values[].query` | string | **Send this back verbatim** as `?option=<query>`. Don't build the string yourself |
| `tags[]` | array | Sorted by count desc, then alphabetically |
| `price_range` | object | Numbers, not strings. Slider bounds |

Empty arrays come back as `[]`, and `price_range` as `{ "min": 0, "max": 0 }` when nothing matches — never `null`.

### Facet counting — why counts don't go to zero

Each dimension is counted **ignoring its own selection**, while still respecting every other filter. This is what makes multi-select usable:

- Shopper ticks **Color: Red** → the colour list still shows Blue, Black, Green with their counts, so they can add a second colour. Sizes, tags and categories re-count against "Red only".
- `price_range` is always the **unfiltered** min/max for the rest of the selection, so dragging the slider never causes the slider's own bounds to shift under the shopper's finger.
- `total_products` is the only figure counted against the complete selection.

A facet value never appears with a count of `0`, and every offered value leads to at least one product — no dead ends.

### Recommended usage

Call `/products/filters` and `/products` in parallel with the **same** querystring on every filter change:

```js
const qs = new URLSearchParams();
qs.append("category", "women");
qs.append("option", "Color:Red");
qs.append("option", "Color:Blue");
qs.set("min_price", "500");
qs.set("max_price", "2000");

const [filters, products] = await Promise.all([
  fetch(`${HOST}/api/v1/products/filters?${qs}`).then((r) => r.json()),
  fetch(`${HOST}/api/v1/products?${qs}&page=1&limit=12`).then((r) => r.json()),
]);
```

Fetch `/filters` once with no params on first paint to get the full unfiltered set (slider bounds, all categories), then refresh it alongside the list.

---

## 2. Product list — `GET /products`

Unchanged in shape. Every param in the table above now applies, and two fields were **added** to each row:

| Field | Type | Notes |
| --- | --- | --- |
| `min_price` | string | Cheapest effective price — the variant floor, or `price` when the product has no variants |
| `max_price` | string | Costliest effective price |

Use these for the "₹120 – ₹1500" price label on a card instead of computing it from the variant list.

> Postgres returns `DECIMAL` as a string, same as the existing `price` / `compare_at_price` fields. Cast before doing maths on them.

**Request**

```
GET /api/v1/products?category=women&option=Color:Red&option=Size:M&min_price=500&max_price=2000&page=1&limit=12
```

**Response 200** (one row, trimmed)

```json
{
  "statusCode": 200,
  "message": "Product List",
  "success": true,
  "data": [
    {
      "id": 7,
      "name": "Wrap-Neck Tiered Midi Dress Blue",
      "slug": "wrap-neck-tiered-midi-dress-blue",
      "price": "1500.00",
      "compare_at_price": "1800.00",
      "min_price": "120.00",
      "max_price": "1500.00",
      "category_id": 1,
      "category_name": "women",
      "category_slug": "women",
      "sub_category_id": 3,
      "status": 1,
      "tags": { "Sale": true, "Trending": true },
      "images": [{ "id": 21, "image": "/uploads/...", "alt_tag": "", "position": 0, "type": "image" }],
      "rating": "4.5000000000000000",
      "total_ratings": "2"
    }
  ],
  "key": [],
  "totalPage": 0
}
```

`GET /products/:slug` and `GET /products?product_id=` are untouched.

---

## Behavior notes / gotchas

**`tags` is an object, not an array.** Stored as `{"Sale": true, "Trending": true}`. Read the keys — `Object.keys(product.tags ?? {})`. The `tag` query param takes the key string as-is.

**Option values are stored per product.** "Red" on product A and "Red" on product B are separate DB rows. The facet endpoint merges them case-insensitively, so `Red` and `red` collapse into one facet entry. The display label is whichever casing sorts first — if that looks wrong in the UI, it's a data-entry issue in the CMS, not an API one. Filtering is case-insensitive regardless, so it never affects results.

**Route order.** `/products/filters` is registered ahead of `/products/:product`, so `filters` is not treated as a product slug. If a product ever gets the slug `filters` it would be unreachable — worth blocking in the CMS.

**No sorting yet.** Results stay ordered by `position ASC, id DESC`. Price sorting is not implemented — ask if you need `?sort=price_asc`.

**Empty result is a 200**, with `data: []` — not a 404. Only `GET /products/:slug` 404s.
