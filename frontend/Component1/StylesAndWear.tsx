"use client";

import Image from "next/image";
import { useState } from "react";

interface StyleCard {
  id: string;
  title: string;
  description: string;
  images: { src: string; alt: string }[];
  tags: string[];
}

const stylesData: StyleCard[] = [
  {
    id: "1",
    title: "Everyday Comfort",
    description:
      "Designed to feel natural on the body throughout long, active days.",
    images: [
      {
        src: "https://framerusercontent.com/images/a7qNl1CXTOrgB91iOnO8iwyMrI.jpeg?width=1200&height=1200",
        alt: "Green hoodie",
      },
      {
        src: "https://framerusercontent.com/images/ybJODTv9BV3Z7bMYd6a6bclh6Sg.jpeg?width=1200&height=1200",
        alt: "Minimalist hoodie",
      },
    ],
    tags: ["All-day wear", "Comfort", "Relaxed fit"],
  },
  {
    id: "2",
    title: "Modern Silhouettes",
    description:
      "Contemporary shapes balance structure & ease for confident everyday styling.",
    images: [
      {
        src: "https://framerusercontent.com/images/JBfpcQ5zwrSJimngcpAyoOiP1Hk.png?width=840&height=1200",
        alt: "Futuristic fashion pose",
      },
      {
        src: "https://framerusercontent.com/images/ATHsoTzpbKxwwKkISL2Qfi2BQ2U.jpeg?width=840&height=1200",
        alt: "Cyberpunk Fashion pose",
      },
    ],
    tags: ["Balanced fit", "Modern", "Structured"],
  },
  {
    id: "3",
    title: "Effortless Styling",
    description:
      "Pieces work together naturally, making daily outfit choices simple & intuitive.",
    images: [
      {
        src: "https://framerusercontent.com/images/h5mjcigkuGzHUrDKNZj4VOiAg.jpeg?width=686&height=1200",
        alt: "White sweatshirt on clothesline",
      },
      {
        src: "https://framerusercontent.com/images/3pzhLnz4BOm15P19zWPl47fJ0Mo.jpeg?width=686&height=1200",
        alt: "White sweatshirt on clothesline",
      },
    ],
    tags: ["Versatile", "Easy to style", "Layered"],
  },
  {
    id: "4",
    title: "Daily Essentials",
    description:
      "Core clothing pieces designed for frequent wear across modern everyday routines.",
    images: [
      {
        src: "https://framerusercontent.com/images/o8BbZ7Bmf99hekDMhLBtBkxBoY.jpeg?width=800&height=708",
        alt: "Minimalist fashion look",
      },
      {
        src: "https://framerusercontent.com/images/8QML9c7jvYYPpGGvtSi9MmQBLg.jpeg?width=800&height=808",
        alt: "Woman in minimalist setting",
      },
    ],
    tags: ["Core pieces", "Everyday", "Wearable"],
  },
  {
    id: "5",
    title: "Wearable Design",
    description:
      "Design decisions focused on comfort, fit, and real-life wearability.",
    images: [
      {
        src: "https://framerusercontent.com/images/PHhxud3IFjLeAUBKSfIjoU.jpg?width=1536&height=2304",
        alt: "Bold fashion portrait",
      },
      {
        src: "https://framerusercontent.com/images/hpBEL1qSUqtuE2iSr01qaWoVTJM.png?width=955&height=1024",
        alt: "Bold fashion portrait",
      },
    ],
    tags: ["Practical", "Functional", "Adaptable"],
  },
  {
    id: "6",
    title: "Clean Aesthetic",
    description:
      "Designed to feel natural on the body throughout long, active days.",
    images: [
      {
        src: "https://framerusercontent.com/images/IWKuR2oZjCwRSiCZeEvdAMXZEg.jpeg?width=1200&height=1200",
        alt: "Clean aesthetic",
      },
      {
        src: "https://framerusercontent.com/images/ywPSLgFGyM72gZm0DNOvWwaoyHQ.jpeg?width=1200&height=1200",
        alt: "Minimalist beige sweatshirt",
      },
    ],
    tags: ["Clean lines", "Minimal", "Timeless"],
  },
];

export default function StylesAndWear() {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  return (
    <section className="relative w-full bg-gradient-to-b from-white via-white to-slate-50 overflow-hidden py-20 px-4 sm:px-6 lg:px-8">
      {/* Header Section */}
      <div className="max-w-7xl mx-auto mb-16">
        <div className="flex flex-col items-center gap-6">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-black rounded-full px-4 py-2">
            <svg
              className="w-5 h-5 text-white"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            <span className="text-sm font-medium text-white">
              What defines our wear
            </span>
          </div>

          {/* Main Title */}
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-light text-center text-black tracking-tight">
            Where style meets ease
          </h2>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-slate-600 text-center max-w-2xl leading-relaxed">
            Thoughtful design blending modern style, comfort, and versatility
            for everyday living across lifestyles.
          </p>
        </div>
      </div>

      {/* Grid of Style Cards */}
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {stylesData.map((style, index) => (
            <div
              key={style.id}
              className="group relative bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300"
              onMouseEnter={() => setHoveredCard(style.id)}
              onMouseLeave={() => setHoveredCard(null)}
            >
              {/* Images Container */}
              <div className="relative h-50  md:h-80 overflow-hidden bg-slate-100">
                <div className="grid grid-cols-2 gap-4 p-5 md:p-15 h-50 md:h-80">
                  {style.images.map((image, imgIdx) => (
                    <div
                      key={imgIdx}
                      className={`relative rounded-lg overflow-hidden shadow-md transition-transform duration-500 ${
                        imgIdx === 0 ? "-rotate-12" : "rotate-12"
                      } ${
                        hoveredCard === style.id
                          ? "scale-105 shadow-lg"
                          : "scale-100"
                      }`}
                    >
                      <Image
                        src={image.src}
                        alt={image.alt}
                        fill
                        className="object-cover w-20 h-20"
                        // sizes="(max-width: 768px) 60px, 60px"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Content Section */}
              <div className="p-6 sm:p-8">
                {/* Title */}
                <h3 className="text-xl sm:text-2xl font-semibold text-black mb-3 group-hover:text-slate-800 transition-colors">
                  {style.title}
                </h3>

                {/* Divider */}
                <div className="w-12 h-px bg-slate-200 mb-4" />

                {/* Description */}
                <p className="text-sm sm:text-base text-slate-600 mb-6 leading-relaxed">
                  {style.description}
                </p>

                {/* Tags */}
                <div className="flex flex-wrap gap-2">
                  {style.tags.map((tag, tagIdx) => (
                    <div
                      key={tagIdx}
                      className="inline-flex items-center gap-2 bg-slate-100 rounded-full px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-700 group-hover:bg-slate-200 transition-colors"
                    >
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <circle cx="12" cy="12" r="2" />
                      </svg>
                      {tag}
                    </div>
                  ))}
                </div>
              </div>

              {/* Hover Accent Line */}
              <div className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-black via-slate-700 to-transparent w-0 group-hover:w-full transition-all duration-700" />
            </div>
          ))}
        </div>
      </div>

      {/* Background Decorative Elements */}
      <div className="absolute top-0 -right-40 w-80 h-80 bg-slate-100 rounded-full blur-3xl opacity-20 -z-10" />
      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-slate-200 rounded-full blur-3xl opacity-10 -z-10" />
    </section>
  );
}
