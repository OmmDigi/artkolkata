"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Best-effort deterrent against copying the artwork shown on the site.
 *
 * A web page cannot actually stop screenshots — the OS takes them, and the
 * browser is often not even told. What this does:
 *  - blacks out the page when a screenshot shortcut reaches the browser
 *    (PrintScreen, Win/Cmd+Shift+S/3/4/5) and wipes the clipboard after it
 *  - blacks out the page while the window has lost focus, which is what
 *    Snipping Tool and most capture apps cause before they grab the screen
 *  - blocks right-click / drag on images and Ctrl+S / Ctrl+P
 *
 * Phones, external capture tools, DevTools and cameras all get around it, so
 * the real protection is serving only watermarked, low-res previews.
 */
const FLASH_MS = 1500;

const ScreenshotGuard = () => {
  const [blocked, setBlocked] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const flash = () => {
      setBlocked(true);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => {
        // stay black if the window is still unfocused
        if (document.hasFocus()) setBlocked(false);
      }, FLASH_MS);
    };

    // PrintScreen copies to the clipboard; overwrite it once the browser lets us
    const wipeClipboard = () => {
      navigator.clipboard?.writeText("").catch(() => {});
    };

    const isScreenshotCombo = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen") return true;
      const k = e.key.toLowerCase();
      // Win+Shift+S (Snipping Tool), Cmd+Shift+3/4/5 (macOS)
      if ((e.metaKey || e.key === "Meta") && e.shiftKey) {
        return ["s", "3", "4", "5", "meta", "shift"].includes(k);
      }
      return false;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isScreenshotCombo(e)) {
        flash();
        return;
      }
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && (k === "s" || k === "p")) {
        e.preventDefault();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      // PrintScreen usually only fires keyup on Windows
      if (e.key === "PrintScreen") {
        flash();
        wipeClipboard();
      }
    };

    const onBlur = () => {
      // focus moving into an embedded iframe (payment gateway, translate) is not a capture
      if (document.activeElement?.tagName === "IFRAME") return;
      setBlocked(true);
    };

    const onFocus = () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
      setBlocked(false);
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") setBlocked(true);
    };

    const isImageTarget = (e: Event) => {
      const t = e.target as HTMLElement | null;
      return !!t && (t.tagName === "IMG" || t.tagName === "PICTURE" || !!t.closest?.("picture"));
    };

    const onContextMenu = (e: MouseEvent) => {
      if (isImageTarget(e)) e.preventDefault();
    };

    const onDragStart = (e: DragEvent) => {
      if (isImageTarget(e)) e.preventDefault();
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("dragstart", onDragStart);

    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("dragstart", onDragStart);
    };
  }, []);

  if (!blocked) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 flex items-center justify-center bg-black text-sm text-white/70 select-none"
      style={{ zIndex: 2147483647 }}
    >
      Content protected — Art Kolkata
    </div>
  );
};

export default ScreenshotGuard;
