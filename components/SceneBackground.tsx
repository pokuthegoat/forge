"use client";

import { useEffect, useRef } from "react";
import { createGrain } from "@/lib/grain";

/**
 * The site's background: one big liquid blob (an SVG path built from points
 * placed around a circle, drawn through their midpoints so it reads as soft
 * organic curves) plus a scatter of embers drifting off it.
 *
 *  - Scroll position morphs the blob between a handful of keyframe "poses" -
 *    driven directly by scroll offset, so scrolling back up unwinds it
 *    exactly instead of replaying an animation.
 *  - A slow independent wobble runs on top at all times, so it's never
 *    perfectly still even with the page idle.
 *  - Embers are plain CSS animations (cheap, GPU-only), unrelated to scroll -
 *    the one piece of this that's always "alive" no matter what.
 */

const POINTS = 10;
const EMBER_COUNT = 10;

// Each keyframe is a radius multiplier per point around the blob (same
// length, same order) - interpolating between two of these point-for-point
// is what makes the shape "flow" from one liquid pose to the next.
const KEYFRAMES: number[][] = [
  [1.0, 0.8, 1.18, 0.76, 1.08, 0.86, 1.22, 0.74, 1.04, 0.92],
  [0.84, 1.12, 0.78, 1.2, 0.8, 1.14, 0.76, 1.06, 0.96, 1.1],
  [1.18, 0.76, 0.94, 1.06, 1.2, 0.78, 0.88, 1.12, 0.8, 1.14],
  [0.9, 1.06, 1.12, 0.78, 0.94, 1.18, 0.84, 0.96, 1.1, 0.86],
];

/** Builds a smooth closed blob path from per-point radii: each point is a
 * quadratic control, and the curve passes through the midpoints between
 * consecutive points, which is what keeps the outline rounded with no
 * sharp corners no matter how the radii change. */
function buildBlobPath(radii: number[]): string {
  const n = radii.length;
  const pts = radii.map((r, i) => {
    const angle = (i / n) * Math.PI * 2;
    return [Math.cos(angle) * r, Math.sin(angle) * r];
  });
  const mid = (a: number[], b: number[]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

  const first = mid(pts[n - 1], pts[0]);
  let d = `M ${first[0].toFixed(4)} ${first[1].toFixed(4)}`;
  for (let i = 0; i < n; i++) {
    const next = pts[(i + 1) % n];
    const m = mid(pts[i], next);
    d += ` Q ${pts[i][0].toFixed(4)} ${pts[i][1].toFixed(4)}, ${m[0].toFixed(4)} ${m[1].toFixed(4)}`;
  }
  return d + " Z";
}

export function SceneBackground({ dim = false }: { dim?: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const pathEl = pathRef.current;
    if (!host || !pathEl) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const grain = createGrain(host);
    const start = performance.now();

    const draw = (now: number) => {
      grain?.render();

      const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const progress = Math.min(1, Math.max(0, window.scrollY / scrollable));

      const span = KEYFRAMES.length - 1;
      const pos = progress * span;
      const i0 = Math.min(span - 1, Math.floor(pos));
      const t = pos - i0;
      const a = KEYFRAMES[i0];
      const b = KEYFRAMES[i0 + 1];

      const elapsed = reduced ? 0 : (now - start) / 1000;
      const radii = a.map((v, i) => {
        const base = v + (b[i] - v) * t;
        const wobble = Math.sin(elapsed * 0.35 + i * 1.7) * 0.025;
        return base + wobble;
      });

      pathEl.setAttribute("d", buildBlobPath(radii));
    };

    let frame = 0;
    const loop = (now: number) => {
      draw(now);
      frame = requestAnimationFrame(loop);
    };
    const onScroll = () => draw(performance.now());
    const onResize = () => grain?.resize();

    window.addEventListener("resize", onResize);
    if (reduced) {
      draw(performance.now());
      window.addEventListener("scroll", onScroll, { passive: true });
    } else {
      frame = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll);
      grain?.dispose();
    };
  }, [dim]);

  return (
    <div ref={hostRef} className={`scene-bg${dim ? " is-dim" : ""}`} aria-hidden="true">
      <svg className="bg-blob" viewBox="-1.4 -1.4 2.8 2.8" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="blobGrad" cx="48%" cy="46%" r="60%">
            <stop offset="0%" stopColor="var(--orange)" />
            <stop offset="55%" stopColor="var(--orange-2)" />
            <stop offset="100%" stopColor="#0a0a0a" />
          </radialGradient>
        </defs>
        <path ref={pathRef} fill="url(#blobGrad)" />
      </svg>
      <div className="bg-embers">
        {Array.from({ length: EMBER_COUNT }).map((_, i) => (
          <span
            key={i}
            className="ember"
            style={
              {
                left: `${25 + ((i * 53) % 60)}%`,
                bottom: `${8 + ((i * 29) % 30)}%`,
                "--drift": `${((i % 5) - 2) * 14}px`,
                animationDelay: `${(i * 0.9) % 8}s`,
                animationDuration: `${5 + (i % 4)}s`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}
