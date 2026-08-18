# Website Banner API (responsive artwork)

Base URL: `{HOST}/api/v1/settings`
All request/response bodies are JSON (`Content-Type: application/json`).

A banner row carries **three image slots** so each device class can get its own artwork:

| Field | Required | Used when |
| --- | --- | --- |
| `image_url` | yes | Desktop — viewport ≥ 1024px. Also the fallback for every other device |
| `tablet_image_url` | no | Tablet — viewport 768px – 1023px. Empty ⇒ `image_url` is used |
| `mobile_image_url` | no | Mobile — viewport < 768px. Empty ⇒ `image_url` is used |

Only `image_url` is mandatory, so banners created before the device variants existed keep working unchanged: their tablet/mobile fields come back as `null` and the storefront falls back to the desktop file.

---

## Storage

Table `site_banners` ([database.sql](../src/config/database.sql)):

```sql
CREATE TABLE IF NOT EXISTS site_banners (
    id SERIAL PRIMARY KEY,
    image_url TEXT NOT NULL,          -- desktop artwork, also the fallback
    mobile_image_url TEXT,            -- optional, served below 768px
    tablet_image_url TEXT,            -- optional, served between 768px and 1024px
    alt_text TEXT,
    link_url TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE site_banners ADD COLUMN IF NOT EXISTS mobile_image_url TEXT;
ALTER TABLE site_banners ADD COLUMN IF NOT EXISTS tablet_image_url TEXT;
```

The two `ALTER TABLE ... IF NOT EXISTS` lines are the migration for an existing database — re-running `database.sql` is safe.

---

## Auth

`GET /settings/banners` is public (the storefront calls it without a token).
All write endpoints require a logged-in CMS user holding permission **`1-13`** (Settings), enforced by `isAuthorizedV2(["1-13"])` in [settings.routes.ts](../src/routes/settings.routes.ts).

```
Authorization: Bearer eyJhbGciOi...
```

---

## Standard response envelope

Same envelope as the rest of the API ([httpResponse.ts](../src/utils/httpResponse.ts)):

```json
{
  "statusCode": 200,
  "message": "Banner list",
  "success": true,
  "data": null,
  "key": [],
  "totalPage": 0
}
```

---

## 1. Upload the image files first — `POST {UPLOAD_HOST}/api/v1/upload/multiple`

Image URLs are not produced by this API. Upload each device artwork to the upload service (`multipart/form-data`, field `files`, max 10 per call, plus a `folder` field — the CMS uses `/banners`), then send the returned `downloadUrl` values to the banner endpoints.

**Response 201**

```json
{
  "statusCode": 201,
  "message": "Files are uploaded successfully!",
  "success": true,
  "data": [
    {
      "url": "/public/banners/hero-mobile-1712.webp",
      "downloadUrl": "/public/banners/hero-mobile-1712.webp",
      "pathname": "public/banners/hero-mobile-1712.webp",
      "contentType": "image/webp",
      "contentDisposition": ""
    }
  ]
}
```

`downloadUrl` is a path served by the upload host, and that exact string is what gets stored in the banner columns.

Upload one file per slot: desktop, tablet and mobile are separate files.

---

## 2. List banners — `GET /settings/banners`

| Query | Type | Notes |
| --- | --- | --- |
| `active` | `"true"` | Returns only `is_active = TRUE` rows. The storefront passes it; the CMS omits it to list everything |

**Response 200**

```json
{
  "statusCode": 200,
  "message": "Banner list",
  "success": true,
  "data": [
    {
      "id": 4,
      "image_url": "/public/banners/hero-desktop.webp",
      "mobile_image_url": "/public/banners/hero-mobile.webp",
      "tablet_image_url": null,
      "alt_text": "Durga Puja collection",
      "link_url": "/products/durga-puja",
      "position": 1,
      "is_active": true
    }
  ]
}
```

Rows come back ordered by `position ASC, id ASC`. `tablet_image_url: null` above means the tablet falls back to `image_url`.

---

## 3. Create a banner — `POST /settings/banners`

Auth: `1-13`.

**Body**

| Field | Type | Required | Default |
| --- | --- | --- | --- |
| `image_url` | string | yes | — |
| `mobile_image_url` | string \| null | no | `null` |
| `tablet_image_url` | string \| null | no | `null` |
| `alt_text` | string \| null | no | `null` |
| `link_url` | string \| null | no | `null` |
| `position` | number ≥ 0 | no | `0` ⇒ appended after the highest existing position |
| `is_active` | boolean | no | `true` |

```json
{
  "image_url": "/public/banners/hero-desktop.webp",
  "mobile_image_url": "/public/banners/hero-mobile.webp",
  "tablet_image_url": "/public/banners/hero-tablet.webp",
  "alt_text": "Durga Puja collection",
  "link_url": "/products/durga-puja",
  "is_active": true
}
```

**Response 201** — `data` is the created row, including the two device fields.

Validation is [`VCreateBanner`](../src/validator/settings.validator.ts); an empty string is accepted for the device fields and stored as `NULL`.

---

## 4. Update a banner — `PUT /settings/banners/:banner_id`

Auth: `1-13`. The body is **a full replacement**, not a patch: any field you leave out is written as `NULL` / its default. Send the whole banner back.

```json
{
  "image_url": "/public/banners/hero-desktop-v2.webp",
  "mobile_image_url": "/public/banners/hero-mobile.webp",
  "tablet_image_url": "",
  "alt_text": "Durga Puja collection",
  "link_url": "/products/durga-puja",
  "position": 1,
  "is_active": true
}
```

File cleanup: the update reads the pre-update row, then deletes from the upload server every slot whose URL changed — per slot, independently. So

- swapping `image_url` deletes only the old desktop file,
- sending `"tablet_image_url": ""` deletes the old tablet file and clears the column,
- unchanged slots are never touched.

**Response 200** — `"Banner has been updated"`.
**404** — `"No banner found with this id"`.

---

## 5. Delete a banner — `DELETE /settings/banners/:banner_id`

Auth: `1-13`. Deletes the row and removes **all three** files (desktop, mobile, tablet) from the upload server.

**Response 200** — `"Banner has been deleted"`.
**400** — `"Invalid banner id"`. **404** — `"No banner found with this id"`.

---

## 6. Reorder banners — `PUT /settings/banners/reorder`

Auth: `1-13`. Unaffected by the device fields; positions are applied in one transaction.

```json
{ "banners": [{ "id": 4, "position": 1 }, { "id": 7, "position": 2 }] }
```

**Response 200** — `"Banner order has been updated"`.

---

## Fetcher usage

### CMS — [useBanners](../../cms/src/hooks/useSiteSettings.ts)

```ts
const { banners, isBannerFetching, isMutatingBanner, mutateBanner, refetchBanners } =
  useBanners();

// upload one device slot, then persist the row
const { data } = await uploadFiles({ files: [file], folder: "/banners" });

mutateBanner({
  type: "update",
  id: banner.id,
  data: {
    image_url: banner.image_url,
    mobile_image_url: data[0].downloadUrl, // "" clears the slot and deletes the file
    tablet_image_url: banner.tablet_image_url ?? "",
    alt_text: banner.alt_text ?? "",
    link_url: banner.link_url ?? "",
    position: banner.position,
    is_active: banner.is_active,
  },
});
```

`mutateBanner` takes `type: "add" | "update" | "delete" | "reorder"` and refetches the `["site-banners"]` query on success. [BannerManager.tsx](../../cms/src/components/settings/BannerManager.tsx) renders the three slots per row: the bulk **Upload Banners** button creates desktop-only rows, and each row's Desktop / Tablet / Mobile thumbnail uploads or replaces that one slot and saves immediately. `Replace` swaps the file; the `✕` on tablet/mobile clears the slot (desktop cannot be cleared — it is the fallback).

### Storefront — [useBanners](../../frontend/hooks/useSiteSettings.ts)

```ts
const { data: banners } = useBanners(); // GET /api/v1/settings/banners?active=true
```

React-query key `["banners"]`, `staleTime` 5 min. Render with `<picture>` so the browser picks the file and never downloads the others ([HeroSection.tsx](../../frontend/Component1/HeroSection.tsx)):

```tsx
<picture>
  {banner.mobile_image_url ? (
    <source media="(max-width: 767px)" srcSet={banner.mobile_image_url} />
  ) : null}
  {banner.tablet_image_url ? (
    <source media="(max-width: 1023px)" srcSet={banner.tablet_image_url} />
  ) : null}
  <img src={banner.image_url} alt={banner.alt_text ?? "Banner"} />
</picture>
```

Omitting the `<source>` when the field is empty is what produces the desktop fallback — do not emit `srcSet={null}`, an empty `source` matches and renders nothing.

Breakpoints match Tailwind: `md` = 768px, `lg` = 1024px. Change them in both places if the design changes.
