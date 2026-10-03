import type Lenis from "lenis";
import type { LenisOptions } from "lenis";

/**
 * Smooth (inertial) mouse-wheel scrolling: the settings, and the one entry point other code uses to scroll the page
 * smoothly. The Lenis instance itself lives in components/SmoothScroll.tsx (mounted once, in the root layout).
 */
export const WHEEL_DURATION = 1.9;
const expoOut = (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t));

/** True for elements that scroll (or lock scrolling) by themselves: modals must keep native wheel behaviour. */
const isDialog = (node: HTMLElement) =>
  node.getAttribute("role") === "dialog" ||
  node.getAttribute("aria-modal") === "true";

export const LENIS_OPTIONS: LenisOptions = {
  autoRaf: false,
  smoothWheel: true,
  duration: WHEEL_DURATION,
  easing: expoOut,
  wheelMultiplier: 0.8,
  syncTouch: false,
  stopInertiaOnNavigate: true,
  respectReducedMotion: true,
  prevent: isDialog,
};

interface Driver {
  lenis: Lenis;
  wake: () => void;
}
let driver: Driver | null = null;

export function setSmoothScrollDriver(next: Driver | null) {
  driver = next;
}

export const isSmoothScrollActive = () => driver !== null;

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const anchorSeconds = (distance: number) => Math.min(1.6, 0.8 + distance / 5000);

export function smoothScrollTo(top: number): boolean {
  if (!driver) return false;
  const { lenis, wake } = driver;
  lenis.scrollTo(top, { duration: anchorSeconds(Math.abs(top - lenis.scroll)), easing: easeInOutCubic });
  wake();
  return true;
}
