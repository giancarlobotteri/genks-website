/**
 * Step-by-step scrolling through the studio: every scroll gesture (wheel, swipe, keyboard)
 * plays one complete, slow camera move to the next stop instead of free scrolling.
 * Outside the studio range the page scrolls normally.
 */
import { prefersReducedMotion } from "../components/ui.tsx";

type Stops = () => number[]; // absolute scrollY values, ascending

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

let anim = 0;
let animating = false;
const listeners = new Set<(on: boolean) => void>();
const setAnimating = (on: boolean) => { animating = on; listeners.forEach(l => l(on)); };
export const onTravel = (l: (on: boolean) => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const isTraveling = () => animating;

/** Animated scroll to an absolute Y, with an ease that starts and ends slowly. */
export function travelTo(y: number, duration?: number) {
  const from = window.scrollY;
  const to = Math.max(0, Math.min(y, document.documentElement.scrollHeight - window.innerHeight));
  cancelAnimationFrame(anim);
  if (prefersReducedMotion() || Math.abs(to - from) < 2) { window.scrollTo(0, to); setAnimating(false); return; }
  const dur = duration ?? Math.min(3200, 1500 + Math.abs(to - from) / window.innerHeight * 120);
  const start = performance.now();
  setAnimating(true);
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / dur);
    window.scrollTo(0, from + (to - from) * easeInOut(t));
    if (t < 1) anim = requestAnimationFrame(step);
    else setAnimating(false);
  };
  anim = requestAnimationFrame(step);
}

export function travelToId(id: string, duration?: number) {
  const el = document.getElementById(id);
  if (!el) return;
  const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
  travelTo(el.getBoundingClientRect().top + window.scrollY - margin, duration);
}

const blocked = (target: EventTarget | null) => {
  const html = document.documentElement;
  if (html.dataset.vsLocked != null || html.dataset.vsIntro === "on") return true;
  const el = target instanceof Element ? target : null;
  return Boolean(el?.closest("dialog, nav[data-open], input, textarea, select, [contenteditable]"));
};

/** Install the stepper. Returns a cleanup function. */
export function installStepper(stops: Stops, durations: (from: number, to: number) => number) {
  if (prefersReducedMotion()) return () => {};
  let lastWheel = 0;
  let touchY: number | null = null;
  let touchUsed = false;

  const inZone = (dir: number) => {
    const s = stops(), y = window.scrollY;
    // the last stop (Beat Store) is the exit: below it the page scrolls freely
    if (y > s[s.length - 1] + 2) return false;
    if (y >= s[s.length - 1] - 2 && dir > 0) return false;
    if (y < s[0] - 2) return false;
    return true;
  };
  const go = (dir: number) => {
    const s = stops(), y = window.scrollY;
    const next = dir > 0 ? s.find(v => v > y + 4) : [...s].reverse().find(v => v < y - 4);
    if (next == null) return;
    // from the nearest stop, so a slightly-off position still uses the right duration
    const fromIdx = s.reduce((bi, v, i) => (Math.abs(v - y) < Math.abs(s[bi] - y) ? i : bi), 0);
    travelTo(next, durations(fromIdx, s.indexOf(next)));
  };

  const onWheel = (e: WheelEvent) => {
    if (e.ctrlKey || Math.abs(e.deltaY) < Math.abs(e.deltaX) || blocked(e.target)) return;
    const dir = Math.sign(e.deltaY);
    if (!dir || !inZone(dir)) return;
    e.preventDefault();
    const now = performance.now(), gap = now - lastWheel;
    lastWheel = now;
    // ignore the inertia tail of a trackpad swipe: a new step needs a new gesture
    if (animating || gap < 180 || Math.abs(e.deltaY) < 4) return;
    go(dir);
  };
  const onTouchStart = (e: TouchEvent) => { touchY = e.touches.length === 1 ? e.touches[0].clientY : null; touchUsed = false; };
  const onTouchMove = (e: TouchEvent) => {
    if (touchY == null || blocked(e.target)) return;
    const dy = touchY - e.touches[0].clientY;
    const dir = Math.sign(dy);
    if (!dir || !inZone(dir)) return;
    e.preventDefault();
    if (!touchUsed && !animating && Math.abs(dy) > 28) { touchUsed = true; go(dir); }
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey || blocked(e.target)) return;
    const dir = ["ArrowDown", "PageDown", " "].includes(e.key) && !e.shiftKey ? 1 : ["ArrowUp", "PageUp"].includes(e.key) || (e.key === " " && e.shiftKey) ? -1 : 0;
    if (!dir || !inZone(dir)) return;
    if (e.key === " " && (e.target as Element | null)?.closest("button, a")) return;
    e.preventDefault();
    if (!animating) go(dir);
  };

  window.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: false });
  window.addEventListener("keydown", onKey);
  return () => {
    window.removeEventListener("wheel", onWheel);
    window.removeEventListener("touchstart", onTouchStart);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("keydown", onKey);
  };
}
