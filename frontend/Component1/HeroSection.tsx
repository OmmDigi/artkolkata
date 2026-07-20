"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";

const slides = [
  {
    id: 1,
    titleTop: "New Arrivals",
    titleMain: ["Be your kind", "of beauty"],
    cta: { href: "/product", label: "product Now" },
    img: "/hero/full-hero1.webp",
    mobileImg: "/hero/mobile-hero1.webp",
  },
  {
    id: 2,
    titleTop: "Discover",
    titleMain: ["Handcrafted", "Collections"],
    cta: { href: "/product", label: "Explore" },
    img: "/hero/full-hero2.webp",
    mobileImg: "/hero/mobile-hero2.webp",
  },
  {
    id: 3,
    titleTop: "Limited",
    titleMain: ["Edition", "Pieces"],
    cta: { href: "/product", label: "See More" },
    img: "/hero/full-hero3.webp",
    mobileImg: "/hero/mobile-hero3.webp",
  },
  {
    id: 4,
    titleTop: "Limited",
    titleMain: ["Edition", "Pieces"],
    cta: { href: "/product", label: "See More" },
    img: "/hero/full-hero4.webp",
    mobileImg: "/hero/mobile-hero4.webp",
  },
];

export default function HeroSection() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft")
        setIndex((i) => (i - 1 + slides.length) % slides.length);
      if (e.key === "ArrowRight")
        setIndex((i) => (i + 1) % slides.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, 3000);
    return () => clearTimeout(timer);
  }, [index]);

  return (
    <section className="w-full -mt-20 relative overflow-hidden">
      <div className="grid">
        {slides.map((s, idx) => (
          <div
            key={s.id}
            className={`[grid-area:1/1] overflow-hidden transition-opacity duration-1000 ${index === idx ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
              }`}
          >
            <picture>
              <Image
                src={s.img}
                alt={s.titleMain.join(" ")}
                className={`hidden md:block w-full h-auto object-cover brightness-100 transition-transform pt-20 ${index === idx
                  ? "scale-110 duration-[6000ms] ease-out"
                  : "scale-100 duration-1000 ease-in"
                  }`}
                width={1920}
                height={1080}
                priority={idx === index}
              />
              <img
                src={s.mobileImg}
                alt={s.titleMain.join(" ")}
                className={`md:hidden w-full h-auto object-cover brightness-100 transition-transform pt-20 ${index === idx
                  ? "scale-110 duration-[6000ms] ease-out"
                  : "scale-100 duration-1000 ease-in"
                  }`}
              />
            </picture>

          </div>
        ))}
      </div>

      {/* indicators and controls */}
      <div className="absolute left-0 right-0 bottom-6 z-20 flex items-center justify-center gap-3">
        <div className="flex gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-2 w-8 rounded-full transition-colors duration-200 ${i === index ? "bg-white" : "bg-white/40"
                }`}
            />
          ))}
        </div>
      </div>

      <div className="absolute left-6 top-1/2 z-20 -translate-y-1/2">
        <button
          aria-label="Previous"
          onClick={() => setIndex((index - 1 + slides.length) % slides.length)}
          className="h-10 w-10 rounded-full bg-white/90 text-black flex items-center justify-center shadow"
        >
          ‹
        </button>
      </div>
      <div className="absolute right-6 top-1/2 z-20 -translate-y-1/2">
        <button
          aria-label="Next"
          onClick={() => setIndex((index + 1) % slides.length)}
          className="h-10 w-10 rounded-full bg-white/90 text-black flex items-center justify-center shadow"
        >
          ›
        </button>
      </div>
    </section>
  );
}
