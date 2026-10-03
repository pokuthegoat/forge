"use client";

import "lenis/dist/lenis.css";
import { ReactLenis, useLenis } from "lenis/react";
import { useEffect, useSyncExternalStore } from "react";
import { LENIS_OPTIONS, isSmoothScrollActive, setSmoothScrollDriver } from "@/lib/smooth-scroll";

const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribe = (onChange: () => void) => {
  const query = window.matchMedia(REDUCED);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const reducedNow = () => window.matchMedia(REDUCED).matches;
const reducedOnServer = () => true;

export function SmoothScroll() {
  const reduced = useSyncExternalStore(subscribe, reducedNow, reducedOnServer);
  if (reduced) return null;
  return (
    <>
      <ReactLenis root options={LENIS_OPTIONS} />
      <OnDemandFrames />
    </>
  );
}

const DEFAULT_FRAME_MS = 1000 / 60;

function OnDemandFrames() {
  const lenis = useLenis();

  useEffect(() => {
    if (!lenis) return;

    let frameId = 0;
    let fresh = false;
    let lastNow = 0;
    let frameMs = DEFAULT_FRAME_MS;

    const frame = (now: number) => {
      frameId = 0;
      if (fresh) {
        lenis.time = now - frameMs;
        fresh = false;
      } else if (lastNow) {
        frameMs = Math.min(34, Math.max(4, now - lastNow));
      }
      lastNow = now;
      lenis.raf(now);
      if (lenis.isScrolling === "smooth") frameId = requestAnimationFrame(frame);
      else lastNow = 0;
    };
    const wake = () => {
      if (frameId) return;
      fresh = true;
      frameId = requestAnimationFrame(frame);
    };

    const stopListening = lenis.on("virtual-scroll", (data: { event: Event }) => {
      if (data.event.type === "wheel") wake();
    });
    setSmoothScrollDriver({ lenis, wake });

    return () => {
      stopListening();
      setSmoothScrollDriver(null);
      cancelAnimationFrame(frameId);
      window.setTimeout(() => {
        if (isSmoothScrollActive()) return;
        const root = document.documentElement;
        for (const name of [...root.classList]) if (name === "lenis" || name.startsWith("lenis-")) root.classList.remove(name);
      }, 500);
    };
  }, [lenis]);

  return null;
}
