"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";

import { useBanners } from "@/hooks/useSiteSettings";

export default function HeroSection() {
  const { data: banners } = useBanners();
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!banners?.length) return;
      if (e.key === "ArrowLeft")
        setIndex((i) => (i - 1 + banners.length) % banners.length);
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % banners.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [banners]);

  useEffect(() => {
    if (!banners?.length) return;
    const timer = setTimeout(() => {
      setIndex((i) => (i + 1) % banners.length);
    }, 3000);
    return () => clearTimeout(timer);
  }, [index, banners]);

  if (!banners || banners.length === 0) {
    return null;
  }

  return (
    <section className="w-full -mt-20 relative overflow-hidden">
      <div className="grid">
        {banners.map((banner, idx) => {
          const imageClass = `w-full h-[600px] md:h-auto object-cover  transition-transform pt-20 ${
            index === idx
              ? "scale-105 duration-[6000ms] ease-out"
              : "scale-100 duration-1000 ease-in"
          }`;

          const image = (
            <>
              {banner.mobile_image_url && (
                <img
                  src={banner.mobile_image_url}
                  alt={banner.alt_text ?? "Banner"}
                  className={`${imageClass} md:hidden block`}
                />
              )}
              <img
                src={banner.image_url}
                alt={banner.alt_text ?? "Banner"}
                className={`${imageClass} ${banner.mobile_image_url ? "hidden md:block" : "block"}`}
              />
            </>
          );

          return (
            <div
              key={banner.id}
              className={`[grid-area:1/1] overflow-hidden transition-opacity duration-1000 ${
                index === idx
                  ? "opacity-100 z-10"
                  : "opacity-0 z-0 pointer-events-none"
              }`}
            >
              {banner.link_url ? (
                <Link href={banner.link_url}>{image}</Link>
              ) : (
                image
              )}
            </div>
          );
        })}
      </div>

      {/* indicators and controls */}
      <div className="absolute left-0 right-0 bottom-6 z-20 flex items-center justify-center gap-3">
        <div className="flex gap-2">
          {banners.map((_, i) => (
            <button
              key={i}
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-2 w-8 rounded-full transition-colors duration-200 ${
                i === index ? "bg-white" : "bg-white/40"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="absolute left-6 top-1/2 z-20 -translate-y-1/2">
        <button
          aria-label="Previous"
          onClick={() =>
            setIndex((index - 1 + banners.length) % banners.length)
          }
          className="h-10 w-10 rounded-full bg-white/90 text-black flex items-center justify-center shadow hover:bg-white"
        >
          ‹
        </button>
      </div>
      <div className="absolute right-6 top-1/2 z-20 -translate-y-1/2">
        <button
          aria-label="Next"
          onClick={() => setIndex((index + 1) % banners.length)}
          className="h-10 w-10 rounded-full bg-white/90 text-black flex items-center justify-center shadow hover:bg-white"
        >
          ›
        </button>
      </div>
    </section>
  );
}
