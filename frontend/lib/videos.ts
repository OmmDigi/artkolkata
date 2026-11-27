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
  (
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:8080"
  )
    .trim()
    .replace(/\/+$/, "");

async function getVideoData<T>(path: string): Promise<T | null> {
  try {
    // Public endpoints: omit Authorization header so staff tokens don't bypass cache or leak hidden videos
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

/** Every visible video, in the display order set by editors. */
export const getVideos = async (): Promise<Video[]> =>
  (await getVideoData<Video[]>("")) ?? [];

/** The featured primary video, or null when none is set. */
export const getPrimaryVideo = (): Promise<Video | null> =>
  getVideoData<Video>("/primary");

/** A single visible video by id, or null if missing/hidden. */
export const getVideoById = (id: number | string): Promise<Video | null> =>
  getVideoData<Video>(`/${id}`);
