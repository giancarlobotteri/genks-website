/**
 * Virtual, physics-based scrolling through the studio stops. The page itself never scrolls:
 * wheel, trackpad, swipe and keys move a "position" measured in stops (0 = microphone …
 * last = mixer display). While the finger/trackpad moves, the camera follows it; on release it
 * glides to the next stop with a critically-damped spring (no linear starts or abrupt stops,
 * the speed carries over when a new gesture arrives mid-move). The 3D loop advances the spring
 * in its own frame (tickStepper), so camera and UI share one value per frame at any refresh rate.
 */
import { prefersReducedMotion } from "../components/ui.tsx";

let count = 6;
let pos = 0, vel = 0, target = 0;
let mode: "idle" | "follow" | "snap" = "idle";
let waiters: (() => void)[] = [];

const FOLLOW_T = 0.085; // seconds: how tightly the camera follows a finger / trackpad
const SNAP_T = 0.5; // seconds: the cinematic glide between stops
/** Per-segment glide time (segment k = stop k → k+1): a story beat can take longer than a simple move. */
let segTimes: number[] = [];
let snapT = SNAP_T;
/** The slowest segment the move crosses sets its pace, fixed for the whole move. */
const snapTimeFor = (from: number, to: number) => {
  const a = Math.max(0, Math.floor(Math.min(from, to) + 1e-3)), b = Math.min(count - 1, Math.ceil(Math.max(from, to) - 1e-3));
  let t = 0;
  for (let k = a; k < b; k++) t = Math.max(t, segTimes[k] ?? SNAP_T);
  return t || SNAP_T;
};

export const stopCount = () => count;
export const stopPos = () => pos;
export const stopTarget = () => target;
/** 0 at rest on a stop, up to ~0.35 while pulling past the last stop (the "dive" towards the Beat Store). */
export const overshoot = () => Math.max(0, pos - (count - 1));
export const isMoving = () => mode !== "idle";

const rubber = (x: number, k = 0.32) => k * (1 - Math.exp(-x / k));
const limit = (t: number) => (t < 0 ? -rubber(-t, 0.18) : t > count - 1 ? count - 1 + rubber(t - (count - 1), 0.4) : t);

/** Critically damped spring towards `to` (Unity-style SmoothDamp): smooth start, smooth landing, never overshoots. */
export function smoothDamp(cur: number, to: number, v: number, smoothTime: number, dt: number): [number, number] {
  const omega = 2 / Math.max(1e-4, smoothTime);
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = cur - to;
  const temp = (v + omega * change) * dt;
  let nv = (v - omega * temp) * exp;
  let out = to + (change + temp) * exp;
  if ((to - cur > 0) === (out > to)) { out = to; nv = 0; }
  return [out, nv];
}

/** Advance the spring. Called once per rendered frame by the 3D loop (dt in seconds). */
export function tickStepper(dt: number) {
  if (mode === "idle") return;
  // fixed sub-steps: a dropped frame is caught up, never turned into slow motion
  let rem = Math.min(dt, 0.25);
  while (rem > 1e-6) {
    const h = Math.min(rem, 1 / 120);
    [pos, vel] = smoothDamp(pos, target, vel, mode === "follow" ? FOLLOW_T : snapT, h);
    rem -= h;
  }
  // landed: the last few thousandths of a stop are invisible, so the tour is "at rest" as soon as it looks it
  if (mode === "snap" && Math.abs(pos - target) < 4e-3 && Math.abs(vel) < 2e-2) {
    pos = target; vel = 0; mode = "idle";
    const w = waiters; waiters = []; w.forEach(f => f());
  }
}

/** Glide to stop `i`. Resolves when the camera has landed. */
export function goToStop(i: number, instant = false): Promise<void> {
  target = Math.max(0, Math.min(count - 1, i));
  if (instant || prefersReducedMotion()) {
    pos = target; vel = 0; mode = "idle";
    const w = waiters; waiters = []; w.forEach(f => f());
    return Promise.resolve();
  }
  snapT = snapTimeFor(pos, target);
  mode = "snap";
  return new Promise(r => waiters.push(r));
}

const blocked = (el: EventTarget | null) => {
  const html = document.documentElement;
  if (html.dataset.screen !== "studio" || html.dataset.vsLocked != null || html.dataset.service != null || html.dataset.busy != null) return true;
  const node = el instanceof Element ? el : null;
  return Boolean(node?.closest("dialog, nav[data-open], input, textarea, select, [contenteditable], [data-own-scroll]"));
};

/**
 * Install the gesture handlers. `onPastEnd` runs when the user pushes beyond the last stop
 * (the mixer display → Beat Store transition).
 */
export function installStepper(stops: number, onPastEnd: () => void, segmentTimes: number[] = []) {
  count = stops;
  segTimes = segmentTimes;
  const H = () => window.innerHeight;
  let anchor = 0;
  const release = (dir: number, moved: number) => {
    const next = Math.abs(moved) > 0.1 || dir !== 0 ? anchor + (dir || Math.sign(moved)) : anchor;
    if (next > count - 1) { void goToStop(count - 1); onPastEnd(); return; }
    void goToStop(next);
  };
  const begin = () => { anchor = Math.round(Math.max(0, Math.min(count - 1, target))); mode = "follow"; };

  // ---- wheel & trackpad ----
  let acc = 0, lastWheel = 0, lastAbs = 0, lock = false, idle = 0, wheeling = false;
  const onWheel = (e: WheelEvent) => {
    if (e.ctrlKey || blocked(e.target)) return;
    e.preventDefault();
    const d = (Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : 0) * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? H() : 1);
    if (!d) return;
    const now = performance.now(), gap = now - lastWheel, a = Math.abs(d);
    lastWheel = now;
    // the inertia tail of a finished trackpad swipe is not a new gesture
    if (lock) {
      if (gap > 220 || (a > lastAbs * 1.8 && a > 24)) lock = false;
      else { lastAbs = a; return; }
    }
    lastAbs = a;
    if (!wheeling) { begin(); acc = 0; wheeling = true; }
    acc += d;
    target = limit(anchor + Math.max(-1, Math.min(1, acc / 420)));
    window.clearTimeout(idle);
    idle = window.setTimeout(() => {
      wheeling = false; lock = true;
      release(0, target - anchor);
    }, 120);
  };

  // ---- touch: the studio follows the finger, then glides on release ----
  let y0: number | null = null;
  let samples: { t: number; y: number }[] = [];
  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 1 || blocked(e.target)) { y0 = null; return; }
    y0 = e.touches[0].clientY; samples = [{ t: performance.now(), y: y0 }];
  };
  const onTouchMove = (e: TouchEvent) => {
    if (y0 == null) return;
    const y = e.touches[0].clientY, dy = y0 - y;
    if (mode !== "follow") { if (Math.abs(dy) < 6) return; begin(); }
    e.preventDefault();
    target = limit(anchor + Math.max(-1.15, Math.min(1.15, dy / (H() * 0.5))));
    const now = performance.now();
    samples.push({ t: now, y });
    while (samples.length > 2 && now - samples[0].t > 100) samples.shift();
  };
  const onTouchEnd = () => {
    if (y0 == null || mode !== "follow") { y0 = null; return; }
    const a = samples[0], b = samples[samples.length - 1];
    const v = b && a && b.t > a.t ? (a.y - b.y) / (b.t - a.t) : 0; // px/ms, positive = finger moving up
    const moved = target - anchor;
    y0 = null;
    release(Math.abs(v) > 0.3 ? Math.sign(v) : 0, Math.abs(moved) > 0.16 ? moved : 0);
  };

  // ---- keyboard ----
  const onKey = (e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey || blocked(e.target)) return;
    const dir = ["ArrowDown", "PageDown"].includes(e.key) || (e.key === " " && !e.shiftKey) ? 1 : ["ArrowUp", "PageUp"].includes(e.key) || (e.key === " " && e.shiftKey) ? -1 : 0;
    if (!dir) return;
    if (e.key === " " && (e.target as Element | null)?.closest("button, a")) return;
    e.preventDefault();
    anchor = Math.round(Math.max(0, Math.min(count - 1, target)));
    release(dir, 0);
  };

  window.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: false });
  window.addEventListener("touchend", onTouchEnd, { passive: true });
  window.addEventListener("touchcancel", onTouchEnd, { passive: true });
  window.addEventListener("keydown", onKey);
  return () => {
    window.clearTimeout(idle);
    window.removeEventListener("wheel", onWheel);
    window.removeEventListener("touchstart", onTouchStart);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("touchend", onTouchEnd);
    window.removeEventListener("touchcancel", onTouchEnd);
    window.removeEventListener("keydown", onKey);
  };
}
