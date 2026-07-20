"use client";

import { useRef, useState } from "react";

interface ScrollingTextProps {
  text: string;
  className?: string;
}

export default function ScrollingText({
  text,
  className = "",
}: ScrollingTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);

  const words = text.split(" ");

  const handleMouseEnter = () => {
    setIsHovering(true);
    if (containerRef.current) {
      const wordContainers = containerRef.current.querySelectorAll(
        "[data-word-container]",
      );
      wordContainers.forEach((container, index) => {
        const topText = container.querySelector(
          "[data-top-text]",
        ) as HTMLElement;
        const bottomText = container.querySelector(
          "[data-bottom-text]",
        ) as HTMLElement;

        if (topText) {
          topText.style.animation = "none";
          topText.offsetHeight;
          topText.style.animation = `slideUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards`;
          topText.style.animationDelay = `${index * 0.05}s`;
        }

        if (bottomText) {
          bottomText.style.animation = "none";
          bottomText.offsetHeight;
          bottomText.style.animation = `slideUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards`;
          bottomText.style.animationDelay = `${index * 0.05}s`;
        }
      });
    }
  };

  const handleMouseLeave = () => {
    // Nothing happens on mouse leave
  };

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`inline-flex flex-wrap gap-2 cursor-pointer ${className}`}
    >
      {words.map((word, index) => (
        <div
          key={index}
          data-word-container
          className="inline-block overflow-hidden"
        >
          <div className="relative inline-block whitespace-nowrap will-change-transform">
            {/* Top text - scrolls up */}
            <span
              data-top-text
              className="inline-block"
              style={{
                transform: "translateY(0)",
              }}
            >
              {word}
            </span>

            {/* Bottom text - comes from bottom */}
            <span
              data-bottom-text
              className="absolute left-0 inline-block whitespace-nowrap"
              style={{
                top: "100%",
                transform: "translateY(0)",
              }}
            >
              {word}
            </span>
          </div>
        </div>
      ))}

      <style jsx>{`
        @keyframes slideUp {
          from {
            transform: translateY(0);
          }
          to {
            transform: translateY(-100%);
          }
        }
      `}</style>
    </div>
  );
}
