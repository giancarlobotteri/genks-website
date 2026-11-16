// Scroll-driven camera path. Pure math, unit-tested.
export type V3 = [number, number, number];
export type Pose = { pos: V3; target: V3 };
export type Key = Pose & { p: number };

export const MIC: V3 = [-0.94, 1.44, 0.95];

export const KEYS: Key[] = [
  { p: 0, pos: [-0.86, 1.52, 1.62], target: MIC },
  { p: 0.14, pos: [-0.62, 1.6, 1.85], target: [-0.94, 1.4, 0.92] },
  { p: 0.36, pos: [0.15, 1.95, 3.3], target: [-0.45, 1.2, -0.4] },
  { p: 0.56, pos: [0.85, 2.15, 3.7], target: [0, 1.1, -1.6] },
  { p: 0.78, pos: [0, 1.58, -0.32], target: [0, 0.86, -1.48] },
  // p = 1 is resolved at runtime: in front of the mixer display (see displayPose)
];

/** Chapters for the progress rail and the overlays. */
export const CHAPTERS = [
  { id: "mic", label: "Microfono", p: 0.04 },
  { id: "reveal", label: "Studio", p: 0.46 },
  { id: "mixer", label: "Mixer", p: 0.8 },
  { id: "display", label: "Display", p: 0.97 },
] as const;

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerpV = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const lerpPose = (a: Pose, b: Pose, t: number): Pose => ({ pos: lerpV(a.pos, b.pos, t), target: lerpV(a.target, b.target, t) });

/** Camera pose for scroll progress p (0..1). `end` is the final pose in front of the display. */
export function poseAt(p: number, end: Pose, reduced = false): Pose {
  const keys: Key[] = [...KEYS, { p: 1, ...end }];
  let q = clamp01(p);
  if (reduced) {
    // Reduced motion: no continuous dolly — cut to the nearest key pose.
    let best = keys[0];
    for (const k of keys) if (Math.abs(k.p - q) < Math.abs(best.p - q)) best = k;
    return { pos: best.pos, target: best.target };
  }
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (q <= b.p) {
      q = (q - a.p) / (b.p - a.p || 1);
      return lerpPose(a, b, ease(q));
    }
  }
  const last = keys[keys.length - 1];
  return { pos: last.pos, target: last.target };
}

/** Visibility 0..1 of a band [a,b] with soft edges of width f. */
export function band(p: number, a: number, b: number, f = 0.05) {
  if (p < a - f || p > b + f) return 0;
  if (p < a) return (p - (a - f)) / f;
  if (p > b) return 1 - (p - b) / f;
  return 1;
}
