// Scroll-driven camera path. Pure math, unit-tested.
export type V3 = [number, number, number];
/** `lens` scales the field of view: < 1 = longer focal length (compressed, product-shot look), 1 = the base lens. */
export type Pose = { pos: V3; target: V3; lens?: number };
export type Key = Pose & { p: number };

export const MIC: V3 = [-0.94, 1.43, 0.95];
const MIXER_T: V3 = [0, 0.86, -1.48];

/**
 * The camera rests only on STOPS; the other keys are pass-through points of a smooth spline,
 * so each scroll step is one continuous move (no stop-and-go at intermediate keys).
 * Directed as one take: microphone alone in the dark (long lens) → pull back while the studio
 * lights up (the lens opens) → establishing shot → DAW → crane over the desk → macro shots of the console.
 */
export const KEYS: Key[] = [
  { p: 0, pos: [-0.67, 1.355, 1.9], target: MIC, lens: 0.6 },                    // microphone · hero, ~70 mm
  { p: 0.06, pos: [0.33, 1.3, 2.72], target: [0.35, 1.12, 0.47], lens: 0.78 },   // the services under the spotlights
  { p: 0.15, pos: [0.55, 1.52, 3.0], target: [-0.3, 1.3, -1.05], lens: 1 },     // the studio · establishing, ~40 mm
  { p: 0.28, pos: [0.1, 1.5, -0.9], target: [0, 1.43, -2.02], lens: 0.95 },      // DAW monitor: custom production
  { p: 0.39, pos: [0.85, 1.95, 0.35], target: [0, 0.95, -1.5], lens: 1 },        // crane over the desk
  { p: 0.5, pos: [0.37, 0.995, -0.96], target: [-0.12, 0.848, -1.27], lens: 0.72 }, // mixer · Mix: fader macro, ~85 mm
  { p: 0.62, pos: [-0.47, 1.14, -1.0], target: [-0.04, 0.93, -1.62], lens: 0.82 },  // mixer · Master: knobs → meters
  { p: 0.74, pos: [0.06, 1.56, -0.42], target: MIXER_T, lens: 1 },               // mixer · Mix & Master: the whole console
  // p = 1 is resolved at runtime: square in front of the mixer display (see endPose)
];

/** Where the camera rests, in scroll order. `glide` = seconds of the spring towards the next stop. */
export const STOPS = [
  { id: "mic", p: 0, glide: 0.75 },
  { id: "studio", p: 0.15, glide: 0.62 },
  { id: "daw", p: 0.28, glide: 0.6 },
  { id: "mix", p: 0.5, glide: 0.5 },
  { id: "master", p: 0.62, glide: 0.5 },
  { id: "mixmaster", p: 0.74, glide: 0.55 },
  // the four services together come at the end of the tour, as a summary, right before the Beat Store
  { id: "services", p: 0.06, glide: 0.95 },
  { id: "display", p: 1, glide: 0.5 },
] as const;

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerpV = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const lerpPose = (a: Pose, b: Pose, t: number): Pose => ({ pos: lerpV(a.pos, b.pos, t), target: lerpV(a.target, b.target, t), lens: lerp(a.lens ?? 1, b.lens ?? 1, t) });

/** Catmull-Rom between b and c (a, d are the neighbours). */
const cr = (a: number, b: number, c: number, d: number, t: number) => {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3);
};
const crV = (a: V3, b: V3, c: V3, d: V3, t: number): V3 => [cr(a[0], b[0], c[0], d[0], t), cr(a[1], b[1], c[1], d[1], t), cr(a[2], b[2], c[2], d[2], t)];

/** Camera pose for scroll progress p (0..1). `end` is the final pose in front of the display. */
export function poseAt(p: number, end: Pose, reduced = false): Pose {
  const keys: Key[] = [...KEYS, { p: 1, ...end }];
  const q = clamp01(p);
  if (reduced) {
    // Reduced motion: no continuous dolly — cut to the nearest key pose.
    let best = keys[0];
    for (const k of keys) if (Math.abs(k.p - q) < Math.abs(best.p - q)) best = k;
    return { pos: best.pos, target: best.target, lens: best.lens ?? 1 };
  }
  for (let i = 0; i < keys.length - 1; i++) {
    const b = keys[i], c = keys[i + 1];
    if (q === c.p) return { pos: c.pos, target: c.target, lens: c.lens ?? 1 };
    if (q <= c.p) {
      const a = keys[i - 1] ?? b, d = keys[i + 2] ?? c;
      const t = (q - b.p) / (c.p - b.p || 1);
      // the lens eases between keys (no spline overshoot on the focal length)
      const lt = t * t * (3 - 2 * t);
      return { pos: crV(a.pos, b.pos, c.pos, d.pos, t), target: crV(a.target, b.target, c.target, d.target, t), lens: lerp(b.lens ?? 1, c.lens ?? 1, lt) };
    }
  }
  const last = keys[keys.length - 1];
  return { pos: last.pos, target: last.target, lens: last.lens ?? 1 };
}

/** Visibility 0..1 of a band [a,b] with soft edges of width f. */
export function band(p: number, a: number, b: number, f = 0.05) {
  if (p < a - f || p > b + f) return 0;
  if (p < a) return (p - (a - f)) / f;
  if (p > b) return 1 - (p - b) / f;
  return 1;
}
