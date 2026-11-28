"use client";

import { useState, useRef } from "react";
import { Pause, Play } from "lucide-react";
import { processImageUrl } from "@/lib/utils";
import type { Video } from "@/lib/videos";

export default function VideoSection({ video }: { video: Video | null }) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [youtubeStarted, setYoutubeStarted] = useState(false);
  const [hasVideoError, setHasVideoError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  if (!video) {
    return null;
  }

  const poster = processImageUrl(video.thumbnail_url) || undefined;
  const isUpload = video.source_type === "upload";

  const handlePlayPause = () => {
    if (!isUpload) {
      if (video.youtube_id) {
        setYoutubeStarted(true);
      }
      return;
    }
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <section className="w-full bg-white py-6 md:py-10 px-4 sm:px-8 lg:px-12">
      <div className="max-w-7xl mx-auto">
        <div className="relative w-full aspect-video max-h-[540px] rounded-xl md:rounded-2xl bg-[#2f2f2f] overflow-hidden shadow-md flex items-center justify-center">
          {/* Video / Poster / YouTube Embed */}
          <div className="w-full h-full flex items-center justify-center">
            {isUpload && !hasVideoError ? (
              <video
                ref={videoRef}
                src={processImageUrl(video.video_url)}
                poster={poster}
                autoPlay
                loop
                muted
                playsInline
                onError={() => setHasVideoError(true)}
                className="w-full h-full object-contain"
              />
            ) : !isUpload && youtubeStarted && video.youtube_id ? (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${video.youtube_id}?autoplay=1&rel=0`}
                title={video.title}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                className="w-full h-full"
              />
            ) : poster ? (
              <img
                src={poster}
                alt={video.title}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full bg-[#2f2f2f]" />
            )}
          </div>

          {/* Bottom Gradient & Copy Overlay */}
          {(!youtubeStarted || isUpload) && (
            <>
              {/* <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent px-6 pt-16 pb-5 md:pb-7 text-center">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white drop-shadow">
                  {video.title}
                </h2>
                {video.description && (
                  <p className="mt-1.5 text-xs sm:text-sm md:text-base text-white/90 max-w-2xl mx-auto drop-shadow">
                    {video.description}
                  </p>
                )}
              </div> */}

              {((isUpload && !hasVideoError) ||
                (!isUpload && video.youtube_id)) && (
                <button
                  type="button"
                  onClick={handlePlayPause}
                  className="absolute bottom-4 right-4 md:bottom-6 md:right-6 z-20 bg-white/90 hover:bg-white rounded-full p-2.5 md:p-3.5 transition-all duration-300 flex items-center justify-center group cursor-pointer shadow-lg"
                  aria-label={
                    isUpload
                      ? isPlaying
                        ? "Pause video"
                        : "Play video"
                      : `Play ${video.title}`
                  }
                >
                  {isUpload && isPlaying ? (
                    <Pause
                      size={20}
                      className="fill-black text-black group-hover:scale-110 transition-transform"
                    />
                  ) : (
                    <Play
                      size={20}
                      className="fill-black text-black translate-x-0.5 group-hover:scale-110 transition-transform"
                    />
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
