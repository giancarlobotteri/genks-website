/**
 * Camera "shots" for everything the user does inside a service: each choice, field group,
 * upload or confirmation asks the studio camera for its own framing.
 * Panels only *name* a shot; StudioStage turns names into camera moves.
 */

let sub: string | null = null;
let dive = 0;
const subs = new Set<() => void>();
const emit = () => subs.forEach(f => f());

export const getSubShot = () => sub;
export function setSubShot(id: string | null) {
  if (id === sub) return;
  sub = id;
  emit();
}
export const onShot = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

/** 0..1: how far the camera dives into the mixer display (used by the Beat Store transition). */
export const getDive = () => dive;
export const setDive = (v: number) => { dive = v; };

let diveAnim = 0;
/** Animate the dive towards `to` (1 = inside the display, 0 = back in the room). */
export function animateDive(to: number, ms: number): Promise<void> {
  cancelAnimationFrame(diveAnim);
  const from = dive;
  if (from === to || ms <= 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { dive = to; return Promise.resolve(); }
  const t0 = performance.now();
  return new Promise(resolve => {
    const step = (now: number) => {
      const u = Math.min(1, (now - t0) / ms);
      const e = u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2;
      dive = from + (to - from) * e;
      if (u < 1) diveAnim = requestAnimationFrame(step);
      else resolve();
    };
    diveAnim = requestAnimationFrame(step);
  });
}
