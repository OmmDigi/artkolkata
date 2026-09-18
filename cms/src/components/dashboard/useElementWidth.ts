import { useEffect, useRef, useState } from "react";

/**
 * The rendered pixel width of an element.
 *
 * The charts need this because they draw in real coordinates rather than
 * stretching a fixed viewBox: `preserveAspectRatio="none"` would scale the
 * stroke widths and the text along with the geometry, so a wide chart would
 * have fat, squashed labels.
 */
export const useElementWidth = <T extends HTMLElement>(fallback = 640) => {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      const next = entry.contentRect.width;
      // Guard against the 0 a hidden or not-yet-laid-out container reports,
      // which would otherwise collapse every scale to NaN.
      if (next > 0) setWidth(next);
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
};
