"use client";

import Link from "next/link";
import { useState, useRef } from "react";
import { Pause, Play } from "lucide-react";
import ScrollingText from "./UI/ScrollingText";

export default function VideoSection() {
  const [isPlaying, setIsPlaying] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handlePlayPause = () => {
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
    <section className="relative w-full min-h-80  bg-black overflow-hidden flex items-center justify-center">
      {/* Video Background */}
      <div className="absolute inset-0 w-full h-full">
        <video
          ref={videoRef}
          src="https://framerusercontent.com/assets/tZkQWQqHkaDjOS2aRu06UvSAiY.mp4"
          poster="https://framerusercontent.com/images/UK7WDlVvUzol044n909Euv7v8.png?width=1024&height=1024"
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
        />
      </div>

      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-black/30"></div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-6 md:px-12 py-2 md:py-4">
        <div className="max-w-2xl mx-auto text-center">
          {/* Tag */}
          <div className="inline-flex items-center gap-3 bg-white/15 backdrop-blur-[5px] rounded-full px-4 py-2 mb-8 border border-white/20">
            <div className="px-4 py-1.5 bg-white rounded-full">
              <p className="text-xs md:text-sm font-medium text-black">
                Wearix
              </p>
            </div>
            <p className="text-sm md:text-base font-medium text-white/80">
              Since 2014
            </p>
          </div>

          {/* Heading */}
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
            Defining modern style
          </h2>

          {/* Description */}
          <p className="text-base md:text-lg text-white/80 mb-10 max-w-xl mx-auto leading-relaxed">
            A decade ago, we set out to redefine the modern silhouette. Today,
            we merge urban utility with high-end aesthetics in a resilient,
            beautiful collection.
          </p>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link
              href="/about"
              className="px-8 py-3 bg-white text-black rounded-full font-medium text-sm"
            >
              <ScrollingText
                text="More about us"
                className="text-lg font-bold"
              />
            </Link>
            <Link
              href="/contact"
              className="px-8 py-3 bg-white/15 backdrop-blur-[5px] text-white rounded-full font-medium text-sm "
            >
              <ScrollingText text="Contact us" className="text-lg font-bold" />
            </Link>
          </div>
        </div>
      </div>

      {/* Play Button */}
      <button
        onClick={handlePlayPause}
        className="absolute bottom-8 right-8 z-20 bg-white rounded-full p-4 hover:bg-white/90 transition-all duration-300 flex items-center justify-center group"
        aria-label="Play/Pause video"
      >
        {isPlaying ? (
          <Pause
            size={24}
            className="fill-black text-black group-hover:scale-110 transition-transform"
          />
        ) : (
          <Play
            size={24}
            className="fill-black text-black group-hover:scale-110 transition-transform"
          />
        )}
      </button>
    </section>
  );
}
