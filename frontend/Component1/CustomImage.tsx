"use client";

import { buildVariantSrcSet } from "@/lib/imageVariants";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The single place every image in the app is rendered from.
 *
 * It deliberately renders a bare <img> and nothing else - no wrapper element -
 * because most call sites position the image with `absolute inset-0` or rely on
 * it being a direct flex child. A wrapper would change those layouts. The
 * shimmer is therefore painted as a background *on the image itself*, which is
 * visible until the bitmap paints over it.
 */

const RETRY_DELAY_MS = 1000;
const MAX_RETRIES = 8;

type NativeImgProps = React.ImgHTMLAttributes<HTMLImageElement>;

export interface CustomImageProps extends Omit<NativeImgProps, "src"> {
  /** Missing/empty is handled: the placeholder box is shown, never a broken icon. */
  src?: string | null;
  alt: string;
  /** Set false for transparent logos where a grey box would look wrong. */
  shimmer?: boolean;
  /** Retry if the image has not loaded within this many ms. */
  retryDelay?: number;
  maxRetries?: number;
  /** Swapped in once the retries are exhausted. */
  fallbackSrc?: string;
  /**
   * Layout width of the image, e.g. "48px" or "(max-width: 768px) 50vw, 25vw".
   * Passing it opts this image into the responsive variant srcset.
   */
  sizes?: string;
}

/**
 * Each retry needs a URL the browser treats as a new request, otherwise a
 * failed response sitting in the HTTP cache is simply replayed.
 */
const withRetryKey = (src: string, attempt: number) =>
  attempt === 0
    ? src
    : `${src}${src.includes("?") ? "&" : "?"}_retry=${attempt}`;

export default function CustomImage({
  src,
  alt,
  shimmer = true,
  retryDelay = RETRY_DELAY_MS,
  maxRetries = MAX_RETRIES,
  fallbackSrc,
  sizes,
  className = "",
  onLoad,
  onError,
  decoding = "async",
  ...rest
}: CustomImageProps) {
  const ref = useRef<HTMLImageElement | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">(
    "loading",
  );
  // Latched separately from `status`: once the fallback is in play it must stay
  // in play. Deriving it from `status` instead lets the fallback's own onLoad
  // clear the failed state, which flips the src straight back to the broken one.
  const [usingFallback, setUsingFallback] = useState(false);

  const baseSrc = src || "";
  const activeSrc = usingFallback
    ? fallbackSrc || ""
    : withRetryKey(baseSrc, attempt);

  // The fallback is a specific file, not something to derive variants from.
  const srcSet =
    sizes && !usingFallback
      ? buildVariantSrcSet(baseSrc, attempt > 0 ? `_retry=${attempt}` : undefined)
      : null;

  // A new src is a fresh image: drop the retry budget and show the shimmer
  // again. Adjusted during render rather than in an effect so there is no
  // intermediate commit showing the old image's state against the new src.
  const [trackedSrc, setTrackedSrc] = useState(baseSrc);
  if (trackedSrc !== baseSrc) {
    setTrackedSrc(baseSrc);
    setAttempt(0);
    setStatus("loading");
    setUsingFallback(false);
  }

  // An image served from cache can finish before React attaches onLoad, which
  // would leave the shimmer running forever. Catch that on mount.
  useEffect(() => {
    const node = ref.current;
    if (node?.complete && node.naturalWidth > 0) setStatus("loaded");
  }, [activeSrc]);

  // The timed retry: still not painted after `retryDelay`, so try again.
  useEffect(() => {
    if (!activeSrc || status !== "loading") return;
    if (usingFallback || attempt >= maxRetries) return;

    const timer = window.setTimeout(() => {
      const node = ref.current;
      if (node?.complete && node.naturalWidth > 0) return;
      setAttempt((n) => (n < maxRetries ? n + 1 : n));
    }, retryDelay);

    return () => window.clearTimeout(timer);
  }, [activeSrc, status, attempt, maxRetries, retryDelay, usingFallback]);

  const handleLoad = useCallback<NonNullable<NativeImgProps["onLoad"]>>(
    (event) => {
      setStatus("loaded");
      onLoad?.(event);
    },
    [onLoad],
  );

  const handleError = useCallback<NonNullable<NativeImgProps["onError"]>>(
    (event) => {
      // An error burns a retry immediately rather than waiting for the timer.
      if (!usingFallback && attempt < maxRetries) {
        setAttempt(attempt + 1);
      } else if (!usingFallback && fallbackSrc) {
        setUsingFallback(true);
        setStatus("loading");
      } else {
        setStatus("failed");
      }
      onError?.(event);
    },
    [attempt, maxRetries, usingFallback, fallbackSrc, onError],
  );

  // `shimmer={false}` means no painted placeholder at all - used for
  // transparent logos, where a grey box reads as a bug rather than a loader.
  const stateClass =
    status === "loaded" || !shimmer
      ? ""
      : status === "failed"
        ? "customimage-failed"
        : "customimage-shimmer";

  return (
    // The whole point of this component: one deliberate <img>, so the rule that
    // pushes next/image is disabled here and nowhere else.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      // Omitting src entirely (rather than src="") stops the browser from
      // resolving the page URL as the image and drawing a broken icon.
      {...(activeSrc ? { src: activeSrc } : {})}
      {...(srcSet ? { srcSet, sizes } : sizes ? { sizes } : {})}
      alt={alt}
      decoding={decoding}
      onLoad={handleLoad}
      onError={handleError}
      className={`${className} ${stateClass}`.trim()}
      {...rest}
    />
  );
}
