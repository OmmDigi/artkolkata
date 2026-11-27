"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import VideoPlayer from "@/Component1/VideoPlayer";
import type { Video } from "@/lib/videos";

export default function WatchOnYouTube({ videos }: { videos: Video[] }) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef({
    isDown: false,
    startX: 0,
    scrollLeft: 0,
    moved: false,
  });

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const youtubeVideos = videos.filter(
    (video) => video.source_type === "youtube" && Boolean(video.youtube_id),
  );

  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
  }, []);

  useEffect(() => {
    updateScrollButtons();
    window.addEventListener("resize", updateScrollButtons);
    return () => window.removeEventListener("resize", updateScrollButtons);
  }, [youtubeVideos.length, updateScrollButtons]);

  const handleSlide = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const step = Math.max(el.clientWidth * 0.75, 240);
    el.scrollBy({
      left: direction === "left" ? -step : step,
      behavior: "smooth",
    });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el) return;
    dragState.current = {
      isDown: true,
      startX: e.pageX - el.offsetLeft,
      scrollLeft: el.scrollLeft,
      moved: false,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el || !dragState.current.isDown) return;
    const x = e.pageX - el.offsetLeft;
    const delta = x - dragState.current.startX;
    if (Math.abs(delta) > 5) {
      dragState.current.moved = true;
    }
    if (dragState.current.moved) {
      e.preventDefault();
      el.scrollLeft = dragState.current.scrollLeft - delta;
    }
  };

  const stopDragging = () => {
    dragState.current.isDown = false;
  };

  const handleClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragState.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      dragState.current.moved = false;
    }
  };

  if (youtubeVideos.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Watch on YouTube"
      className="w-full bg-white py-6 md:py-10 px-4 sm:px-8 lg:px-12"
    >
      <div className="max-w-7xl mx-auto">
        {/* Header Row */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <a
            href="https://www.youtube.com/channel/UC96zR5UuNfReQHaoHwMax9g"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xl sm:text-2xl font-bold text-gray-900 hover:text-black transition-colors group"
          >
            <span>Watch on YouTube</span>
            <ChevronRight className="w-5 h-5 text-gray-700 group-hover:translate-x-0.5 transition-transform" />
          </a>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => handleSlide("left")}
              disabled={!canScrollLeft}
              aria-label="Scroll YouTube videos left"
              className={`w-8 h-8 rounded border border-gray-200 bg-white flex items-center justify-center text-gray-700 transition ${
                canScrollLeft
                  ? "hover:bg-gray-100 hover:text-black cursor-pointer opacity-100"
                  : "opacity-35 cursor-not-allowed"
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleSlide("right")}
              disabled={!canScrollRight}
              aria-label="Scroll YouTube videos right"
              className={`w-8 h-8 rounded border border-gray-200 bg-white flex items-center justify-center text-gray-700 transition ${
                canScrollRight
                  ? "hover:bg-gray-100 hover:text-black cursor-pointer opacity-100"
                  : "opacity-35 cursor-not-allowed"
              }`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Horizontal Carousel */}
        <div
          ref={scrollRef}
          onScroll={updateScrollButtons}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={stopDragging}
          onMouseLeave={stopDragging}
          onClickCapture={handleClickCapture}
          className="flex gap-4 overflow-x-auto scrollbar-hide select-none cursor-grab active:cursor-grabbing"
        >
          {youtubeVideos.map((video) => (
            <article
              key={video.id}
              className="flex flex-col shrink-0 w-[68%] sm:w-[42%] md:w-[30%] lg:w-[19%]"
            >
              <div className="w-full aspect-video rounded-xl overflow-hidden bg-black">
                <VideoPlayer video={video} />
              </div>

              <p className="mt-2.5 text-xs sm:text-sm font-medium text-gray-800 leading-snug line-clamp-2">
                {video.title}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
