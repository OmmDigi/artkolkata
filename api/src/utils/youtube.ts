/**
 * The 11 character id out of any link YouTube hands out: watch, youtu.be,
 * shorts, live, embed (including youtube-nocookie) and the mobile site.
 */
const YOUTUBE_ID =
  /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([\w-]{11})(?![\w-])/i;

export const extractYouTubeId = (url: string): string | null =>
  url.match(YOUTUBE_ID)?.[1] ?? null;

export const youTubeWatchUrl = (id: string) =>
  `https://www.youtube.com/watch?v=${id}`;

// hqdefault exists for every video. The CMS tries the sharper maxresdefault
// first, so this is only the fallback when no thumbnail was sent at all.
export const youTubeThumbnailUrl = (id: string) =>
  `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
