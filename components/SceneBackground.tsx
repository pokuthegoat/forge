"use client";

import { useEffect, useRef } from "react";
import { createGrain } from "@/lib/grain";

/**
 * The site's background, in layers behind the page:
 *
 *  0. Film grain over the whole layer.
 *  1. Flat outline shapes (rings, squares, a pill, a dot grid) that drift at different speeds as you scroll.
 *     They are hairlines only, never filled.
 */

type ShapeKind = "ring" | "square" | "dots" | "pill";
type Shape = {
  kind: ShapeKind;
  x: number;
  at: number;
  size: number;
  k: number;
  spin?: number;
};

const SHAPES: Shape[] = [
  { kind: "ring", x: 92, at: 1.1, size: 380, k: 0.75, spin: 60 },
  { kind: "square", x: 90, at: 2.2, size: 240, k: 0.6, spin: 90 },
  { kind: "dots", x: 8, at: 2.6, size: 260, k: 0.8 },
  { kind: "ring", x: 6, at: 4.2, size: 300, k: 0.7, spin: 80 },
  { kind: "pill", x: 88, at: 5.0, size: 320, k: 0.65 },
  { kind: "square", x: 5, at: 6.6, size: 200, k: 0.7, spin: 70 },
  { kind: "dots", x: 90, at: 7.2, size: 240, k: 0.85 },
  { kind: "ring", x: 92, at: 8.2, size: 340, k: 0.6, spin: 50 },
];

export function SceneBackground({ dim = false }: { dim?: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const shapeRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const grain = createGrain(host);

    let vh = window.innerHeight;
    const measure = () => {
      vh = window.innerHeight;
      grain?.resize();
    };
    measure();

    let scrollEased = window.scrollY;
    let last = performance.now();

    const draw = (dt: number) => {
      scrollEased += (window.scrollY - scrollEased) * Math.min(1, dt * 12);
      grain?.render();

      SHAPES.forEach((s, i) => {
        const el = shapeRefs.current[i];
        if (!el) return;
        const y = vh * 0.5 + (s.at * vh - scrollEased) * s.k - s.size / 2;
        el.style.transform = `translate3d(0, ${y}px, 0)`;
      });
    };

    let frame = 0;
    const loop = () => {
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      draw(dt);
      frame = requestAnimationFrame(loop);
    };
    const onVisibility = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      if (!document.hidden) {
        last = performance.now();
        frame = requestAnimationFrame(loop);
      }
    };
    const onResize = () => {
      measure();
      if (reduced) draw(0);
    };
    const onScroll = () => draw(0);

    window.addEventListener("resize", onResize);
    if (reduced) {
      draw(0);
      window.addEventListener("scroll", onScroll, { passive: true });
    } else {
      document.addEventListener("visibilitychange", onVisibility);
      frame = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      grain?.dispose();
    };
  }, [dim]);

  return (
    <div ref={hostRef} className={`scene-bg${dim ? " is-dim" : ""}`} aria-hidden="true">
      {SHAPES.map((s, i) => (
        <div
          key={i}
          ref={(el) => {
            shapeRefs.current[i] = el;
          }}
          className="bg-shape"
          style={{ left: `${s.x}vw`, width: s.size, height: s.size, marginLeft: -s.size / 2 }}
        >
          <div
            className={`bg-${s.kind}`}
            style={s.spin ? { animation: `bg-spin ${s.spin}s linear infinite` } : undefined}
          />
        </div>
      ))}
    </div>
  );
}
