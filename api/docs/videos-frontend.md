# Videos API — Frontend Integration Guide

Editors now manage videos in a new **Videos** tab in the CMS. Each video is either a file
uploaded from their device (MP4, WebM or MOV, up to 100 MB) or a YouTube link, with a title,
an optional short description, a thumbnail, a display order (drag and drop in the CMS), a
visible flag and a primary flag. At most one video is **primary**: the featured video.

The storefront only reads them: three public GET endpoints, no login.

**Base URL:** `process.env.API_BASE_URL` for server-side fetches, the same as
`app/privacy-policy/page.tsx`.
**Auth:** none. Call these endpoints **without** an `Authorization` header. A request
carrying a staff or admin token also gets hidden videos back and skips the API cache, so
don't use the `lib/fetcher.tsx` instance (it attaches the login token).

---

## 1. Endpoints

All paths are prefixed with `/api/v1/videos`.

| # | Method | Path | What it does |
|---|--------|------|--------------|
| 1 | GET | `/api/v1/videos` | Every visible video, in display order |
| 2 | GET | `/api/v1/videos/primary` | The featured video, or `null` |
| 3 | GET | `/api/v1/videos/:id` | One visible video |

Every response uses the standard envelope:

```json
{
  "statusCode": 200,
  "message": "Video list",
  "success": true,
  "data": [],
  "key": [],
  "totalPage": 0
}
```

The public endpoints allow 240 requests per minute per IP. A server-side fetch with
`revalidate` stays far below that.

---

### 1. Get all videos

```
GET /api/v1/videos
```

`data` is an array of video objects (see [section 2](#2-the-video-object)), already sorted
the way editors arranged them. Render in array order. `[]` when there are none. Not
paginated: the whole list comes back.

```json
{
  "statusCode": 200,
  "message": "Video list",
  "success": true,
  "data": [
    {
      "id": 2,
      "title": "Studio tour",
      "description": "A short walk around the workshop",
      "source_type": "youtube",
      "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "youtube_id": "dQw4w9WgXcQ",
      "thumbnail_url": "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
      "is_primary": true,
      "is_active": true,
      "position": 1,
      "created_at": "2026-11-26T08:01:12.481Z",
      "updated_at": "2026-11-26T08:03:40.102Z"
    },
    {
      "id": 1,
      "title": "Workshop clip",
      "description": null,
      "source_type": "upload",
      "video_url": "/uploads/videos/workshop-1795680110959-947306550.mp4",
      "youtube_id": null,
      "thumbnail_url": "/uploads/videos/thumbnails/workshop-auto-thumbnail-1795680111137-911345987.jpg",
      "is_primary": false,
      "is_active": true,
      "position": 2,
      "created_at": "2026-11-26T08:00:05.913Z",
      "updated_at": "2026-11-26T08:03:40.102Z"
    }
  ],
  "key": [],
  "totalPage": 0
}
```

### 2. Get the primary video

```
GET /api/v1/videos/primary
```

`data` is one video object, or `null` when no video is primary. Both are a `200`:

```json
{
  "statusCode": 200,
  "message": "No primary video is set",
  "success": true,
  "data": null,
  "key": [],
  "totalPage": 0
}
```

### 3. Get one video

```
GET /api/v1/videos/:id
```

| Status | When |
|--------|------|
| 200 | `data` is the video |
| 404 | The id doesn't exist, or the video is hidden — `"No video found with this id"` |
| 400 | The id isn't a number |

---

## 2. The video object

`source_type` decides how a video is played. The URL fields can be relative paths, so
always pass them through `processImageUrl` (`lib/utils.ts`).

| Field | Type | What it means |
|-------|------|---------------|
| `id` | number | Stable id |
| `title` | string | Always present, up to 150 characters |
| `description` | string \| null | Short text, up to 500 characters. `null` when the editor left it empty |
| `source_type` | `"upload"` \| `"youtube"` | `upload` is a file on our upload server, `youtube` is a YouTube video |
| `video_url` | string | **upload:** a relative path such as `/uploads/videos/studio-1795679958392-726167929.mp4`. **youtube:** always the canonical `https://www.youtube.com/watch?v=<id>`, whatever form the editor pasted |
| `youtube_id` | string \| null | The 11-character YouTube id, ready for an embed URL. `null` for uploads |
| `thumbnail_url` | string \| null | The cover image, usually 16:9. A relative `/uploads/videos/thumbnails/...` path, a YouTube image (`https://img.youtube.com/vi/<id>/maxresdefault.jpg` or `hqdefault.jpg`), or any image URL an editor pasted |
| `is_primary` | boolean | `true` on the one featured video |
| `is_active` | boolean | Always `true` in public responses; hidden videos are left out |
| `position` | number | Display order, ascending. Values can have gaps, so use array order rather than the number |
| `created_at`, `updated_at` | string | ISO date-time |

```ts
export interface Video {
  id: number;
  title: string;
  description: string | null;
  source_type: "upload" | "youtube";
  video_url: string;
  youtube_id: string | null;
  thumbnail_url: string | null;
  is_primary: boolean;
  is_active: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}
```

---

## 3. Rendering a video

Switch on `source_type`. An uploaded file plays in a `<video>` tag, and a YouTube video plays
in an embed built from `youtube_id`. Either way, the thumbnail is the cover.

| `source_type` | Play it with | Source | Cover |
|---------------|--------------|--------|-------|
| `upload` | `<video>` | `processImageUrl(video_url)` | `poster={processImageUrl(thumbnail_url)}` |
| `youtube` | `<iframe>` | `https://www.youtube-nocookie.com/embed/${youtube_id}` | Show `thumbnail_url` with a play button and load the iframe on click |

**Resolving paths.** Uploaded files and thumbnails come back as relative `/uploads/...`
paths. `processImageUrl` turns them into full URLs on the upload host and passes absolute
URLs, such as YouTube thumbnails, through unchanged. Don't hardcode video URLs: deleting or
replacing a video in the CMS deletes the old file.

**Uploaded videos.** The upload server supports range requests, so seeking and streaming
work.

- Normal player: `controls playsInline preload="metadata"`. With `preload="metadata"`, the
  file isn't downloaded until someone presses play.
- Background or hero video, like the current `VideoSection`:
  `autoPlay muted loop playsInline`. Browsers only autoplay muted video, and iOS also needs
  `playsInline`.

**YouTube videos.** Use the `youtube-nocookie.com` embed domain, which sets no cookies until
playback.

- Normal player: `?rel=0` keeps related videos to the same channel.
- Background loop:
  `?autoplay=1&mute=1&loop=1&playlist=${youtube_id}&controls=0&playsinline=1`. `loop` only
  works when `playlist` repeats the id.
- Load the iframe on click rather than with the page. Each YouTube iframe pulls in about
  1 MB of player code, so show the thumbnail and a play button until the visitor asks for it.

**Thumbnails.** Most thumbnails are 16:9, but not all: a frame from a portrait video is
portrait, editors can upload any image, and YouTube's `hqdefault.jpg` is 4:3 with black bars.
Put them in a fixed 16:9 box with `object-cover` so every one fills it. Uploaded thumbnails
get the same responsive WebP sizes as other uploads, so `buildVariantSrcSet` in
`lib/imageVariants.ts` works on them. YouTube thumbnails are external, and
`buildVariantSrcSet` correctly returns `null` for them. `next.config.ts` has
`images.unoptimized: true`, so external hosts need no `remotePatterns` entry.

---

## 4. Rules you can rely on

The API enforces these, so the storefront doesn't need to check them.

- **Order.** The list comes back sorted the way editors arranged it in the CMS. Render it in
  array order.
- **One primary at most.** The database allows a single primary video. Marking a new one
  unmarks the old one in the same step. There can also be none.
- **The primary video is always visible.** Editors can't hide it, so `/primary` never
  returns a hidden video.
- **Hidden videos are never public.** They don't appear in `/videos`, and `/videos/:id`
  answers 404 for them.
- **Freshness.** The API caches public responses in Redis and clears the cache on every CMS
  change, so the API is up to date the moment an editor saves. Any delay comes from
  storefront caching: `next: { revalidate: 30 }` means a change shows within 30 seconds.

---

## 5. What changes in the current code

Nothing uses videos yet. The obvious first place is the home page `VideoSection`
(`Component1/VideoSection.tsx`). It is commented out in `app/page.tsx` and plays a hardcoded
`framerusercontent.com` file.

| File | Change |
|------|--------|
| `lib/videos.ts` (new) | Fetch helpers and the `Video` type, see below |
| `Component1/VideoPlayer.tsx` (new) | One player for both sources, see below |
| `app/page.tsx` | Fetch the primary video and render `<VideoSection video={...} />` only when there is one |
| `Component1/VideoSection.tsx` | Take a `video` prop instead of the hardcoded `src` / `poster`. The heading and paragraph can come from `video.title` and `video.description`, so editors control that copy too |

### Fetch helpers — `lib/videos.ts`

They return an empty list or `null` instead of throwing, so a failed API call hides the
section rather than breaking the page.

```ts
export interface Video {
  id: number;
  title: string;
  description: string | null;
  source_type: "upload" | "youtube";
  video_url: string;
  youtube_id: string | null;
  thumbnail_url: string | null;
  is_primary: boolean;
  is_active: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

const apiBase = () =>
  (process.env.API_BASE_URL || "http://localhost:8080").replace(/\/$/, "");

async function getVideoData<T>(path: string): Promise<T | null> {
  try {
    // no Authorization header: public data, and it keeps the API cache in play
    const res = await fetch(`${apiBase()}/api/v1/videos${path}`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return (json.data ?? null) as T | null;
  } catch (error) {
    console.error(`Failed to fetch videos${path}:`, error);
    return null;
  }
}

/** every visible video, in the order editors set */
export const getVideos = async () => (await getVideoData<Video[]>("")) ?? [];

/** the featured video, or null when none is set */
export const getPrimaryVideo = () => getVideoData<Video>("/primary");
```

### A player for both sources — `Component1/VideoPlayer.tsx`

Uploads play in `<video>`. YouTube shows its thumbnail until clicked, then loads the embed.

```tsx
"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { processImageUrl } from "@/lib/utils";
import type { Video } from "@/lib/videos";

export default function VideoPlayer({ video }: { video: Video }) {
  const [started, setStarted] = useState(false);
  const poster = processImageUrl(video.thumbnail_url) || undefined;

  if (video.source_type === "upload") {
    return (
      <video
        src={processImageUrl(video.video_url)}
        poster={poster}
        controls
        playsInline
        preload="metadata"
        className="w-full aspect-video bg-black object-contain"
      />
    );
  }

  if (!started) {
    return (
      <button
        type="button"
        onClick={() => setStarted(true)}
        aria-label={`Play ${video.title}`}
        className="relative w-full aspect-video bg-black"
      >
        {poster && <img src={poster} alt="" className="size-full object-cover" />}
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="rounded-full bg-white p-4">
            <Play className="fill-black text-black" />
          </span>
        </span>
      </button>
    );
  }

  return (
    <iframe
      src={`https://www.youtube-nocookie.com/embed/${video.youtube_id}?autoplay=1&rel=0`}
      title={video.title}
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
      className="w-full aspect-video"
    />
  );
}
```

### Home page hero from the primary video

Fetch in the server component and pass the video down. Render nothing when no video is
primary.

```tsx
// app/page.tsx (server component)
const primaryVideo = await getPrimaryVideo();

{primaryVideo && <VideoSection video={primaryVideo} />}
```

Inside `VideoSection`, replace the hardcoded `<video>` with a branch on the source. For a
YouTube primary video, either use the background-loop embed parameters from
[section 3](#3-rendering-a-video), or show the thumbnail as a still image:

```tsx
{video.source_type === "upload" ? (
  <video
    ref={videoRef}
    src={processImageUrl(video.video_url)}
    poster={processImageUrl(video.thumbnail_url) || undefined}
    autoPlay
    muted
    loop
    playsInline
    className="w-full h-full object-cover"
  />
) : (
  <img
    src={processImageUrl(video.thumbnail_url)}
    alt={video.title}
    className="w-full h-full object-cover"
  />
)}
```

---

## 6. Edge cases

Each of these can happen with real CMS data, so handle them before launch.

| Situation | What the API returns | What to do |
|-----------|----------------------|------------|
| No primary video set | `/primary` gives 200 with `data: null` | Hide the section, or fall back to the first item from `/videos` |
| No videos, or all hidden | `/videos` gives `data: []` | Hide the section |
| API down or slow | Network error or non-2xx | The helpers above return `[]` or `null`; hide the section |
| Thumbnail missing | `thumbnail_url: null` | Rare: the CMS requires one for uploads, and YouTube videos always get one. Leave out `poster` and use a plain dark box |
| MOV upload | `video_url` ends in `.mov` | HEVC-encoded MOV files don't play in Chrome or Firefox. Listen for the `<video>` `error` event and show the thumbnail instead. The CMS tells editors to prefer MP4 |
| YouTube video removed or made private on YouTube | The row still exists | The embed shows YouTube's own error, and the thumbnail becomes a grey placeholder. Nothing to handle in code; editors should delete the video |
| Pasted thumbnail from another site | An absolute URL on any host | `processImageUrl` passes it through unchanged. Fine with `images.unoptimized: true` |
| Visitor logged in as staff | Hidden videos would appear if the token were sent | Fetch on the server without a token, as in the helper above |

---

## 7. Admin endpoints (CMS only, for reference)

The storefront never calls these. They need a staff token with the Videos permission
(`1-16`) and answer 403 without one.

| Method | Path | Body | Notes |
|--------|------|------|-------|
| POST | `/api/v1/videos` | `title`, `description`, `source_type`, `video_url`, `thumbnail_url`, `is_primary`, `is_active` | The new video goes to the end of the list. A YouTube link is checked and stored in canonical form. Without a `thumbnail_url`, a YouTube video gets YouTube's `hqdefault.jpg` |
| PUT | `/api/v1/videos/:id` | Same fields as create | Doesn't change `position`. Deletes replaced files from the upload server |
| PUT | `/api/v1/videos/reorder` | `{ "videos": [{ "id": 3, "position": 1 }, ...] }` | Applied in one statement |
| DELETE | `/api/v1/videos/:id` | none | Also deletes the uploaded video file and its thumbnail |

Video files go to the upload server first, at `POST /api/v1/upload/video` (multipart, a
`folder` field and then a `file` field). It accepts MP4, WebM or MOV up to 100 MB and returns
the `downloadUrl` that becomes `video_url`. Only this route accepts large files; other upload
routes keep their 5 MB limit.

---

## 8. Quick checklist

- [ ] Add `lib/videos.ts` with `getVideos` / `getPrimaryVideo`, fetching server-side with no
      `Authorization` header
- [ ] Pass every `video_url` and `thumbnail_url` through `processImageUrl`
- [ ] Branch on `source_type`: `<video>` for `upload`, a click-to-load
      `youtube-nocookie.com` iframe for `youtube`
- [ ] Hand the primary video to `VideoSection` and drop its hardcoded `src` / `poster`
- [ ] Hide the section when `/primary` returns `null` or `/videos` returns `[]`
- [ ] Show the thumbnail if a `<video>` fails to play (MOV files)
- [ ] Put thumbnails in a fixed 16:9 box with `object-cover`
