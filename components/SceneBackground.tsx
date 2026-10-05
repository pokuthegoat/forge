"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import * as THREE from "three";
import { createGrain } from "@/lib/grain";

/**
 * The site's background, in layers behind the page:
 *
 *  0. Film grain over the whole layer.
 *  1. Flat outline shapes (rings, squares, a pill, a dot grid) that drift at different speeds as you scroll.
 *     They are hairlines only, never filled.
 *  2. One blob, drawn by a ray-marching shader and printed as a halftone (orange, with black dots for the shading). Scrolling down morphs it between three shapes: a tri-lobed
 *     metaball with holes, a soft lumpy blob, and a rounded cube with holes. It also glides across the screen from
 *     section to section. The shapes are signed distance fields, so the holes open and close smoothly while it morphs.
 *
 * With `prefers-reduced-motion` (or no WebGL) nothing animates: the shapes stay put and the blob is a still frame,
 * or a soft CSS orb when WebGL isn't there. `dim` (pages that don't scroll) lets the blob morph on a slow timer instead
 * of on scroll.
 */

// ---- Blob shader --------------------------------------------------------------------------------------------------

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const FRAG = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uMorph;   // 0 = tri-lobed, 1 = lumpy blob, 2 = holed cube
uniform float uRot;
uniform vec2 uRes;
uniform float uCell;    // the halftone's cell size, in the shape's own pixels
varying vec2 vUv;

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float smin(float a, float b, float k) { float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }
float smax(float a, float b, float k) { return -smin(-a, -b, k); }
float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}
float sdRoundBox(vec3 p, vec3 b, float r) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}

// The blob is ONE shape that changes, not three shapes faded into each other. Fading two distance fields together gives a
// crumpled, seamy in-between at the halfway point. Instead each change is a single formula with a dial (0..1) that moves
// smoothly from one end to the other, so every point along the way is a clean, believable shape.

// The soft lumps of the middle shape: three slow, broad swells added to a sphere's surface, so it reads as a smooth pebble.
// (An earlier version also had a fine, fast wobble on top, and that is what made it look like a crumpled ball: keep every
// wave here long, at most about 2.6 across the sphere, so nothing can crinkle.)
float lump(vec3 p) {
  float w = 0.055 * sin(2.2 * p.x + 1.7 * p.y + uTime * 0.25);
  w += 0.04 * sin(2.6 * p.y - 1.9 * p.z + 1.3 - uTime * 0.2);
  w += 0.03 * sin(2.0 * p.z + 1.4 * p.x + 2.0 + uTime * 0.15);
  return w;
}

// First change, e = 0..1: four lobes joined by thin necks (their loops are holes) swell and draw in toward the middle until
// they have merged into one lumpy sphere. Each lobe's centre slides to the origin and its radius grows to the sphere's, so
// the holes close up as the lobes fill in, with no jump.
float shapeAB(vec3 p, float e) {
  const float R = 0.82;
  float w = uTime * 0.5;
  float s = 1.0 - e; // how far the lobes are still spread out
  vec3 c0 = vec3( 0.55 + 0.03 * sin(w),        0.45, 0.10) * s;
  vec3 c1 = vec3(-0.55, -0.42 + 0.03 * sin(w + 1.0), 0.20) * s;
  vec3 c2 = vec3(-0.60,  0.40, -0.25 + 0.04 * sin(w + 2.0)) * s;
  vec3 c3 = vec3( 0.50, -0.55 + 0.03 * sin(w + 3.0), -0.30) * s;
  float d = length(p - c0) - mix(0.42, R, e);
  d = smin(d, length(p - c1) - mix(0.46, R, e), 0.25);
  d = smin(d, length(p - c2) - mix(0.25, R, e), 0.25);
  d = smin(d, length(p - c3) - mix(0.30, R, e), 0.25);
  d = smin(d, sdCapsule(p, c0, c1, mix(0.11, R, e)), 0.22);
  d = smin(d, sdCapsule(p, c1, c2, mix(0.10, R, e)), 0.22);
  d = smin(d, sdCapsule(p, c2, c0, mix(0.09, R, e)), 0.22);
  d = smin(d, sdCapsule(p, c0, c3, mix(0.10, R, e)), 0.22);
  d = smin(d, sdCapsule(p, c3, c1, mix(0.10, R, e)), 0.22);
  d += lump(p) * e; // the lumps fade in as the lobes merge
  // Merged lobes are a hair smaller than a true sphere (smooth unions shave a little off), so over the last stretch the
  // formula hands over to the plain lumpy sphere. By then the two are nearly identical, so there is no visible jump.
  float k = smoothstep(0.8, 1.0, e);
  if (k > 0.0) d = mix(d, length(p) - R + lump(p), k);
  return d;
}

// Second change, t = 0..1: the lumpy sphere becomes a cube with a round hole in every face. It is one rounded box whose
// core shrinks or grows and whose corner radius tightens (a box with no core and a big radius IS a sphere), so the sphere
// firms up into a cube. The lumps fade out; the face holes open, and last of all the hollow core, once the faces are flat.
float shapeBC(vec3 p, float t) {
  float e = smoothstep(0.0, 1.0, t);
  float d = sdRoundBox(p, vec3(0.56 * e), mix(0.82, 0.2, e)) + lump(p) * (1.0 - e);
  float hr = 0.5 * smoothstep(0.35, 1.0, t);   // the face holes' radius
  float cr = 0.56 * smoothstep(0.5, 1.0, t);   // the hollow core's radius
  if (hr > 0.005) {
    float holes = length(p - vec3(0.85, 0.0, 0.0)) - hr;
    holes = min(holes, length(p + vec3(0.85, 0.0, 0.0)) - hr);
    holes = min(holes, length(p - vec3(0.0, 0.85, 0.0)) - hr);
    holes = min(holes, length(p + vec3(0.0, 0.85, 0.0)) - hr);
    holes = min(holes, length(p - vec3(0.0, 0.0, 0.85)) - hr);
    holes = min(holes, length(p + vec3(0.0, 0.0, 0.85)) - hr);
    d = smax(d, -holes, 0.06);
  }
  if (cr > 0.005) d = smax(d, -(length(p) - cr), 0.05);
  return d;
}

float map(vec3 p) {
  p.xz *= rot(uRot);
  p.yz *= rot(uRot * 0.6 + 0.4);
  if (uMorph < 1.0) return shapeAB(p, uMorph);
  return shapeBC(p, uMorph - 1.0);
}

vec3 calcNormal(vec3 p) {
  vec2 e = vec2(1.0, -1.0) * 0.0015;
  return normalize(e.xyy * map(p + e.xyy) + e.yyx * map(p + e.yyx) + e.yxy * map(p + e.yxy) + e.xxx * map(p + e.xxx));
}

// One ray through the screen point uv. Returns a premultiplied colour and alpha. nearEdge is set when the pixel is on or
// close to the silhouette, where a single ray can't tell how much of the pixel the blob covers.
vec4 trace(vec2 uv, out float nearEdge) {
  nearEdge = 0.0;
  vec3 ro = vec3(0.0, 0.0, 3.6);
  vec3 rd = normalize(vec3(uv, -2.9));

  float t = 0.0;
  float edge = 1e3;   // how close (as an angle) the ray came to the surface
  float tEdge = 0.0;  // ...and how far along it was at that closest point
  bool hit = false;
  for (int i = 0; i < 110; i++) {
    float d = map(ro + rd * t);
    float e = d / max(t, 0.001);
    if (e < edge) { edge = e; tEdge = t; }
    if (d < 0.001) { hit = true; break; }
    t += d * 0.45;
    if (t > 7.0) break;
  }

  float pix = (2.0 / uRes.y) / 2.9;
  // A ray that skims the silhouette creeps along the surface without ever quite landing (or lands by luck), which shows
  // up as a dotted outline. Anything that got within a pixel's width counts as a hit, shaded where it came closest.
  if (!hit && edge < pix * 0.5) { hit = true; t = tEdge; }
  if (!hit) {
    float a = 1.0 - smoothstep(0.0, pix * 1.2, edge);
    nearEdge = edge < pix * 3.0 ? 1.0 : 0.0;
    return vec4(vec3(0.039) * a, a);
  }

  vec3 p = ro + rd * t;
  vec3 n = calcNormal(p);
  vec3 v = -rd;
  float ndv = clamp(dot(n, v), 0.0, 1.0);
  nearEdge = ndv < 0.3 ? 1.0 : 0.0;

  // Liquid glass: a smooth near-black body lit by two soft studio-style lights, so the highlights read as long
  // bright streaks following the surface's curvature rather than one hard dot. The silhouette's edge goes bright
  // white (true glass/chrome rim behaviour), with a thin band of red just outside that core - like the chromatic
  // fringe you get at the edge of a glossy render - instead of any colour on the body itself.
  vec3 L1 = normalize(vec3(-0.5, 0.75, 0.6));
  vec3 L2 = normalize(vec3(0.65, 0.45, 0.5));
  vec3 refl1 = reflect(-L1, n);
  vec3 refl2 = reflect(-L2, n);
  float spec1 = pow(max(dot(refl1, v), 0.0), 20.0);
  float spec2 = pow(max(dot(refl2, v), 0.0), 26.0);

  vec3 black = vec3(0.012, 0.009, 0.01);
  vec3 white = vec3(1.0);
  vec3 red = vec3(0.95, 0.38, 0.1);

  float rimCore = pow(1.0 - ndv, 7.0);
  float rimWide = pow(1.0 - ndv, 3.0);
  float rimFringe = clamp(rimWide - rimCore, 0.0, 1.0);

  vec3 col = black;
  col += white * spec1 * 0.95;
  col += white * spec2 * 0.6;
  col += white * rimCore;
  col += red * rimFringe * 1.3;

  return vec4(col, 1.0);
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float near;
  vec4 c = trace(uv, near);
  if (near > 0.5) {
    // An edge pixel: four more rays inside it (a rotated grid), averaged with the first, give it a proper partial
    // coverage, so the outline is smooth instead of stair-stepped. Only these few pixels pay for it.
    vec2 px = vec2(2.0 / uRes.x, 2.0 / uRes.y);
    c += trace(uv + px * vec2( 0.125,  0.375), near);
    c += trace(uv + px * vec2(-0.375,  0.125), near);
    c += trace(uv + px * vec2(-0.125, -0.375), near);
    c += trace(uv + px * vec2( 0.375, -0.125), near);
    c *= 0.2;
  }
  gl_FragColor = c;
}`;

// ---- Flat shapes --------------------------------------------------------------------------------------------------

type ShapeKind = "ring" | "square" | "dots" | "pill";
type Shape = {
  kind: ShapeKind;
  /** Horizontal centre, as a percent of the viewport width. */
  x: number;
  /** The scroll position (in screens) at which the shape crosses the middle of the viewport. */
  at: number;
  size: number;
  /** How much of the scroll it follows: below 1 it lags the page, so it reads as further away. */
  k: number;
  /** Turns slowly on its own. */
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

// ---- Where the blob goes, and what it is, at each point of the scroll -----------------------------------------------

/**
 * The blob's route, as points it passes through: [centre x as a fraction of the viewport width, centre y as a fraction of
 * its height]. They are spaced evenly along the scroll (the first is the top of the page, the last the bottom), and a
 * smooth spline is drawn through them, so the route is one flowing curve of big S-bends, with no straight legs and no
 * stops at the points. The points swing in y as well as x, so it loops and dives rather than just going side to side.
 */
const PATH_DESKTOP: [number, number][] = [
  [0.8, 0.42], // the top of the page: on the right, clear of the hero text
  [0.56, 0.7],
  [0.3, 0.56],
  [0.16, 0.32],
  [0.36, 0.28],
  [0.66, 0.34],
  [0.84, 0.58],
  [0.66, 0.72],
  [0.36, 0.68],
  [0.2, 0.46],
  [0.44, 0.28],
  [0.76, 0.32],
  [0.86, 0.52], // about where the last shape (the cube) is reached, on the right, clear of the FAQ
  [0.72, 0.74],
  [0.46, 0.98], // the bottom of the page: the route keeps sweeping (down and to the left) so the blob sinks behind the closing black band
];
const PATH_MOBILE: [number, number][] = [
  [0.5, 0.3],
  [0.28, 0.4],
  [0.7, 0.3],
  [0.3, 0.42],
  [0.7, 0.36],
  [0.32, 0.3],
  [0.66, 0.4],
  [0.5, 0.98], // sinks behind the closing black band at the bottom of the page
];

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** A point p (0..1) of the way along a Catmull-Rom spline that passes through every point of `path`. */
function sample(path: [number, number][], p: number): [number, number] {
  const n = path.length;
  const u = Math.min(1, Math.max(0, p)) * (n - 1);
  const i = Math.min(n - 2, Math.floor(u));
  const t = u - i;
  const p0 = path[Math.max(i - 1, 0)];
  const p1 = path[i];
  const p2 = path[i + 1];
  // The last segment has no point after it. Repeating the final point (the usual trick) makes the curve slow to a crawl as
  // it arrives, which reads as a kink; instead the route is carried on in the direction it was already heading, so it
  // finishes at full speed like the rest of the path.
  const p3: [number, number] = i + 2 < n ? path[i + 2] : [2 * p2[0] - p1[0], 2 * p2[1] - p1[1]];
  const at = (k: 0 | 1) =>
    0.5 *
    (2 * p1[k] +
      (-p0[k] + p2[k]) * t +
      (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t +
      (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t * t * t);
  return [at(0), at(1)];
}

/**
 * Scroll progress -> morph value 0..2. Each of the three shapes is held for a while, then flows into the next. The last
 * shape is reached a little before the bottom, so it is on screen (not behind the closing band) for a while.
 */
function morphFor(p: number) {
  const raw = Math.min(1, Math.max(0, p / 0.86)) * 2;
  const i = Math.min(1, Math.floor(raw));
  return i + smooth(0.2, 0.8, raw - i);
}

/** The halftone's cell size in CSS pixels (at the blob's full size): the distance between neighbouring dots. */
const HALFTONE_CELL = 7;

/** How many pixels the blob is rendered at, across its full size - low on purpose, so it reads as a grid of small,
 * distinct blocks instead of a smooth surface once the browser upscales it with nearest-neighbour scaling. Fine
 * enough that the shape itself still reads clearly, coarse enough that every block is still visible as one. */
const PIXEL_RES = 120;

// ---- Component ----------------------------------------------------------------------------------------------------

export function SceneBackground({ dim = false }: { dim?: boolean }) {
  const pathname = usePathname();
  const hideBlob = pathname === "/launch" || pathname === "/coins" || pathname.startsWith("/token");
  const hostRef = useRef<HTMLDivElement>(null);
  const blobRef = useRef<HTMLDivElement>(null);
  const shapeRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const host = hostRef.current;
    const blob = blobRef.current;
    if (!host || !blob) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ---- WebGL blob ----
    let renderer: THREE.WebGLRenderer | null = null;
    let material: THREE.ShaderMaterial | null = null;
    let geometry: THREE.PlaneGeometry | null = null;
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: "high-performance" });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(1); // a fixed, low internal resolution is the point - see PIXEL_RES
      material = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        premultipliedAlpha: true, // the shader returns premultiplied colour, so blend it that way (no dark fringe)
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uMorph: { value: 0 },
          uRot: { value: 0 },
          uRes: { value: new THREE.Vector2(1, 1) },
          uCell: { value: HALFTONE_CELL },
        },
      });
      geometry = new THREE.PlaneGeometry(2, 2);
      scene.add(new THREE.Mesh(geometry, material));
      blob.appendChild(renderer.domElement);
    } catch {
      renderer = null;
      blob.classList.add("is-fallback"); // no WebGL: a soft CSS orb stands in
    }

    // ---- Film grain, on top of everything in this layer (see lib/grain.ts) ----
    const grain = createGrain(host);

    // ---- Layout ----
    let vw = window.innerWidth;
    let vh = window.innerHeight;
    let size = 600;
    const measure = () => {
      vw = window.innerWidth;
      vh = window.innerHeight;
      const mobile = vw < 900;
      size = mobile ? Math.min(vw * 0.92, 420) : Math.min(vh * 0.98, vw * 0.6, 900);
      blob.style.width = blob.style.height = `${size}px`;
      if (renderer && material) {
        // Render tiny (PIXEL_RES x PIXEL_RES), then let the canvas's CSS size (100% of `.blob`, set above) stretch
        // it up to full size - `false` here means three.js won't touch that CSS size itself. `.blob canvas`'s
        // `image-rendering: pixelated` is what turns that stretch into crisp blocks instead of a blur.
        renderer.setSize(PIXEL_RES, PIXEL_RES, false);
        material.uniforms.uRes.value.set(PIXEL_RES, PIXEL_RES);
        material.uniforms.uCell.value = HALFTONE_CELL;
      }
      grain?.resize();
    };
    measure();

    // ---- Frame ----
    // The scroll position is eased toward its target so a stepped mouse wheel still looks soft (Lenis already smooths
    // most of it, see lib/smooth-scroll.ts).
    let scrollEased = window.scrollY;
    let last = performance.now();
    let elapsed = 0;

    const draw = (dt: number) => {
      elapsed += dt;
      const max = Math.max(1, document.documentElement.scrollHeight - vh);
      scrollEased += (window.scrollY - scrollEased) * Math.min(1, dt * 12);
      const progress = Math.min(1, Math.max(0, scrollEased / max));
      const mobile = vw < 900;

      // Blob: position, opacity, shape and spin.
      let cx: number, cy: number, morph: number;
      if (dim) {
        [cx, cy] = mobile ? [0.5, 0.3] : [0.8, 0.5];
        morph = 1 + Math.sin(elapsed * 0.3);
      } else {
        [cx, cy] = sample(mobile ? PATH_MOBILE : PATH_DESKTOP, progress);
        morph = morphFor(progress);
      }
      const bob = Math.sin(elapsed * 0.6) * 10;
      // At the top of the page the blob is smaller, so it fits in the free space to the right of the hero text; it grows
      // to full size over the first stretch of the scroll. (Not on phones or the sign-in pages.)
      const grow = mobile || dim ? 1 : 0.72 + 0.28 * smooth(0, 0.1, progress);
      blob.style.transform = `translate3d(${cx * vw - size / 2}px, ${cy * vh - size / 2 + bob}px, 0) scale(${grow})`;
      blob.style.opacity = mobile ? "0.55" : dim ? "0.8" : "1";

      if (renderer && material) {
        material.uniforms.uTime.value = elapsed;
        material.uniforms.uMorph.value = morph;
        material.uniforms.uRot.value = elapsed * 0.16 + progress * 5;
        renderer.render(scene, camera);
      }
      grain?.render();

      // Flat shapes: each crosses the viewport at its own pace.
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
      geometry?.dispose();
      material?.dispose();
      renderer?.dispose();
      renderer?.domElement.remove();
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
      <div ref={blobRef} className={`blob${hideBlob ? " is-hidden" : ""}`} />
    </div>
  );
}
