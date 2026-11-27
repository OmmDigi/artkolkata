"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { processImageUrl } from "@/lib/utils";
import type { Video } from "@/lib/videos";

export default function VideoPlayer({ video }: { video: Video }) {
  const [started, setStarted] = useState(false);
  const [hasVideoError, setHasVideoError] = useState(false);
  const poster = processImageUrl(video.thumbnail_url) || undefined;

  if (video.source_type === "upload") {
    if (hasVideoError) {
      return (
        <div className="relative w-full aspect-video bg-black overflow-hidden">
          {poster ? (
            <img
              src={poster}
              alt={video.title}
              className="size-full object-cover"
            />
          ) : (
            <div className="size-full flex items-center justify-center text-sm text-white/70 px-4 text-center">
              {video.title}
            </div>
          )}
        </div>
      );
    }

    return (
      <video
        src={processImageUrl(video.video_url)}
        poster={poster}
        controls
        playsInline
        preload="metadata"
        onError={() => setHasVideoError(true)}
        className="w-full aspect-video bg-black object-contain"
      />
    );
  }

  if (!started || !video.youtube_id) {
    return (
      <button
        type="button"
        onClick={() => video.youtube_id && setStarted(true)}
        aria-label={`Play ${video.title}`}
        className="group relative w-full aspect-video bg-black overflow-hidden block cursor-pointer"
      >
        {poster && (
          <img
            src={poster}
            alt={video.title}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        )}
        <span className="absolute inset-0 bg-black/15 group-hover:bg-black/25 transition-colors flex items-center justify-center">
          <span className="w-10 h-10 rounded-full bg-white/95 shadow-md flex items-center justify-center transition-transform duration-200 group-hover:scale-110">
            <Play className="w-4 h-4 fill-gray-800 text-gray-800 translate-x-0.5" />
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
      className="w-full aspect-video bg-black"
    />
  );
}
