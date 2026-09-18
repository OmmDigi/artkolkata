# Site Pages API — Frontend Integration Guide

The three legal pages — **Terms & Conditions**, **Privacy Policy**, **Return & Refund Policy** — now come from the CMS instead of being hardcoded in the storefront. An admin edits them under *Settings → Policies*; you fetch them and render them.

**Base URL:** `process.env.NEXT_PUBLIC_API_BASE_URL`
**Auth:** none. Both endpoints are public — `getRequest` from `lib/fetcher.tsx` works as is.

The body of a page is **Editor.js output** (`{ blocks: [...] }`), the same format `blogs.content_json` uses. There is no renderer for it in the storefront yet, so [§5](#5-rendering-content_json) lists every block shape you can receive.

---

## 1. Endpoints

All paths are prefixed with `/api/v1/pages`.

| # | Method | Path | What it does |
|---|--------|------|--------------|
| 1 | GET | `/api/v1/pages` | All published pages — one call builds the footer link list |
| 2 | GET | `/api/v1/pages/:slug` | One page with its body |

There is no create, update or delete for you to call: writing is the CMS's job and needs an admin token. The set of pages is fixed, so a link to one of the three slugs below can never 404 because someone deleted a page.

Standard envelope:

```json
{
  "statusCode": 200,
  "message": "Site page",
  "success": true,
  "data": {},
  "key": [],
  "totalPage": 0
}
```

---

## 2. The slugs, and the routes they belong on

| Slug (API) | Title | Existing storefront route |
|---|---|---|
| `terms-and-conditions` | Terms and Conditions | `app/terms` |
| `privacy-policy` | Privacy Policy | `app/privacy` |
| `return-and-refund-policy` | Return and Refund Policy | `app/return-policy` |

The slug is **not** the route — keep your existing URLs, they are already linked and indexed. Map them yourself:

```ts
const PAGE_SLUG = {
  terms: "terms-and-conditions",
  privacy: "privacy-policy",
  "return-policy": "return-and-refund-policy",
} as const;
```

`app/delivery-policy` has **no** page behind it — only three pages exist. Leave it hardcoded, or ask for a fourth page to be seeded (one line in the schema, no new endpoint).

---

## 3. Get a page — `GET /api/v1/pages/:slug`

```ts
import { getRequest } from "@/lib/fetcher";

interface ISitePage {
  id: number;
  slug: string;
  title: string;
  content_json: { time?: number; version?: string; blocks: IBlock[] } | null;
  meta_title: string | null;
  meta_description: string | null;
  status: "draft" | "published";
  resolved_meta_title: string;
  updated_at: string;
  updated_at_label: string | null;
}

const { data: page } = await getRequest<IResponse<ISitePage>>(
  "/api/v1/pages/privacy-policy",
);
```

**Response 200**

```json
{
  "statusCode": 200,
  "message": "Site page",
  "success": true,
  "data": {
    "id": 2,
    "slug": "privacy-policy",
    "title": "Privacy Policy",
    "content_json": {
      "time": 1758140000000,
      "version": "2.31.4",
      "blocks": [
        { "id": "a1", "type": "header", "data": { "text": "1. What we collect", "level": 2 } },
        { "id": "b2", "type": "paragraph", "data": { "text": "We store the name, email…" } }
      ]
    },
    "meta_title": "Privacy Policy | LUVLETTE Curves",
    "meta_description": "How we collect, use and protect your data.",
    "status": "published",
    "resolved_meta_title": "Privacy Policy | LUVLETTE Curves",
    "updated_at": "2026-09-18T04:06:11.482Z",
    "updated_at_label": "18 September 2026, 09:36 AM"
  },
  "key": [],
  "totalPage": 0
}
```

| Field | Use it for |
|---|---|
| `title` | The `<PageHeader pageTitle=…>` heading |
| `content_json` | The body. **Can be `null`** on a page nobody has filled in yet, and `blocks` can be `[]` — both mean "print nothing", neither is an error |
| `resolved_meta_title` | `<title>`. Already falls back to `title`, so it is never empty — use it unguarded |
| `meta_description` | `<meta name="description">`. Can be `null` |
| `updated_at_label` | A ready-made IST string for a *"Last updated 18 September 2026"* line. No date formatting needed |
| `status`, `id`, `slug`, `updated_at` | Rarely needed on the storefront |

**404 — `"Page not found"`.** Two causes, same handling: the slug is wrong, or the admin has put the page in **draft** while rewriting it. Render `notFound()` or keep your current static copy as a fallback; do not show a blank page.

> One quirk worth knowing: `lib/fetcher.tsx` attaches the login token to every request. If the logged-in user happens to be a CMS admin, the API answers with drafts included — so a draft page renders for them and 404s for everyone else. That is intended, and it is why you should never cache this response per-browser and reuse it.

---

## 4. Get all pages — `GET /api/v1/pages`

No query parameters. Returns the same object as above for every **published** page, ordered terms → privacy → returns. Draft pages are simply absent.

```ts
const { data: pages } = await getRequest<IResponse<ISitePage[]>>("/api/v1/pages");

const footerLinks = pages.map((p) => ({ label: p.title, href: ROUTE_BY_SLUG[p.slug] }));
```

Useful if you want the footer to stop listing a page while it is in draft. If your footer links are static, you do not need this endpoint at all.

---

## 5. Rendering `content_json`

`content_json.blocks` is an array of `{ id, type, data }`. Only the tools below are enabled in the CMS editor, so these are the only `type` values you can receive. Anything unknown should be skipped, not thrown on — a tool added later must not white-screen a legal page.

```ts
type IBlock = { id?: string; type: string; data: Record<string, unknown> };
```

### `paragraph`
```json
{ "type": "paragraph", "data": { "text": "We store the <b>name</b> you give us." } }
```
`text` is an **HTML string**, not plain text (see *Inline markup* below).

### `header`
```json
{ "type": "header", "data": { "text": "1. What we collect", "level": 2 } }
```
`level` is 1–6 and the admin picks it as a size control. Render `<h{level}>` but style h1 down — the page already has a `PageHeader`.

### `list`
Version 2 of the tool: **nested**, and items are objects, not strings.
```json
{
  "type": "list",
  "data": {
    "style": "unordered",
    "items": [
      { "content": "Orders you place", "meta": {}, "items": [] },
      { "content": "Addresses you save", "meta": {}, "items": [
        { "content": "Only the ones you choose to store", "meta": {}, "items": [] }
      ] }
    ]
  }
}
```
`style` is `"unordered"`, `"ordered"` or `"checklist"`. Recurse on `items`; `content` is HTML. For `checklist`, `meta.checked` is a boolean.

### `quote`
```json
{ "type": "quote", "data": { "text": "…", "caption": "…", "alignment": "left" } }
```

### `table`
```json
{
  "type": "table",
  "data": {
    "withHeadings": true,
    "content": [["Item", "Window"], ["Dresses", "7 days"]]
  }
}
```
`content` is rows of HTML cells. When `withHeadings` is true the first row is the `<thead>`.

### `code`
```json
{ "type": "code", "data": { "code": "plain text, newlines included" } }
```
Plain text — render in `<pre>`, do **not** set it as HTML.

### `image`
```json
{
  "type": "image",
  "data": {
    "file": { "url": "/public/product-editor-asset/seal.webp" },
    "caption": "", "withBorder": false, "withBackground": false, "stretched": false
  }
}
```
`file.url` is either a path on the upload host or a full external URL — the same handling as blog images.

### `embed`
```json
{
  "type": "embed",
  "data": {
    "service": "youtube",
    "embed": "https://www.youtube.com/embed/xxxx",
    "source": "https://www.youtube.com/watch?v=xxxx",
    "width": 580, "height": 320, "caption": ""
  }
}
```
Only `youtube` and `vimeo` are enabled. `embed` is the iframe src.

### Inline markup

Every `text`, `content`, `caption` and table cell is an HTML fragment. Editor.js emits `<b>`, `<i>`, `<a href>`, `<mark>`, `<code>`, and the colour tool adds `<span style="color:…">` / `<font color>`. To keep the admin's formatting you have to set it as HTML:

```tsx
<p dangerouslySetInnerHTML={{ __html: block.data.text }} />
```

This content is written by an authenticated admin, not by customers, so it is trusted the same way blog content is. If you would rather not trust it, sanitize with an allow-list of exactly the tags above — stripping `<span style>` silently drops the admin's text colours.

### Empty states

```tsx
const blocks = page.content_json?.blocks ?? [];
if (blocks.length === 0) return null; // page exists, admin has not written it yet
```

---

## 6. Caching and freshness

The API caches both reads in redis for **5 minutes**, and an admin's save wipes that cache immediately — so the API side is always at most one save behind by a few seconds.

Your own caching is what decides how fast an edit shows up on the site. These are legal pages: fetch them on the server so they are indexable, and revalidate on a timer.

```ts
// app/privacy/page.tsx
export const revalidate = 300; // match the API's window

export default async function PrivacyPolicy() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/pages/privacy-policy`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) notFound();
  const { data: page } = await res.json();
  …
}
```

Do not use `cache: "force-cache"` with no revalidate — an edited policy would then stay stale until the next deploy.

If you fetch on the client instead, follow `hooks/useSiteSettings.ts`: react-query, key `["site-page", slug]`, `staleTime` 5 min.

---

## 7. Metadata

```ts
export async function generateMetadata(): Promise<Metadata> {
  const { data: page } = await getPage("privacy-policy");
  return {
    title: page.resolved_meta_title,              // never empty
    description: page.meta_description ?? undefined,
  };
}
```

Keep a static `metadata` fallback for the 404/draft path, so the page still has a title when the fetch fails.

---

## 8. Migration checklist

1. Copy the existing hardcoded copy out of `app/terms`, `app/privacy` and `app/return-policy` and paste it into the CMS (*Settings → Policies*) — the API ships the pages **empty**.
2. Build the block renderer from §5 once and share it; the same component will render blog bodies later.
3. Swap each page's body for the fetched blocks, keeping `PageHeader` and the page chrome as they are.
4. Keep `SiteEmailLink` / `SitePhoneLink` where the copy names a contact detail — those still come from site info, not from this API.
5. Leave `app/delivery-policy` alone until a fourth page is seeded.
