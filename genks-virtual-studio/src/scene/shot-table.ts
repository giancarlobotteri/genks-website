// Camera framings for every service step. Pure data + math (unit-tested).
import type { Pose, V3 } from "./camera-path.ts";

/** Orbit framing: look at `t` from `dist` metres, `yaw` around Y (0 = from +Z), `pitch` up. */
export type Orbit = {
  t: V3; yaw: number; pitch: number; dist: number;
  /** slow movement while the shot is held: yaw rad/s, distance change per second (negative = push in), target slide m/s on X */
  spin?: number; push?: number; slide?: number;
  /** field-of-view scale (< 1 = longer lens, see camera-path) */
  lens?: number;
};

const MIC: V3 = [-0.94, 1.44, 0.95];
const SCREEN: V3 = [0, 1.43, -2.02];
const MIXER: V3 = [0, 0.86, -1.46];

export const SHOTS: Record<string, Orbit> = {
  // Registrazione
  rec: { t: MIC, yaw: 0.7, pitch: 0.1, dist: 1.05, lens: 0.75 },
  "rec:pkg": { t: MIC, yaw: -0.55, pitch: 0.16, dist: 1.1, lens: 0.75 },
  "rec:cal": { t: [-0.94, 1.25, 0.95], yaw: 0.25, pitch: 0.42, dist: 1.7 },
  "rec:contact": { t: [-0.94, 1.46, 0.95], yaw: 1.35, pitch: 0.02, dist: 0.85, lens: 0.7 },
  "rec:done": { t: [-0.6, 1.2, 0.2], yaw: 0.45, pitch: 0.25, dist: 2.7 },
  // Beat su misura
  custom: { t: SCREEN, yaw: -0.32, pitch: 0.05, dist: 1.05 },
  "custom:seq": { t: [-1.0, 0.86, -1.47], yaw: 0.3, pitch: 0.78, dist: 0.8 },
  "custom:steps": { t: [-1.15, 1.3, -1.95], yaw: 0.5, pitch: 0.06, dist: 0.95 },
  "custom:form": { t: [1.15, 1.3, -1.95], yaw: -0.5, pitch: 0.06, dist: 0.95 },
  "custom:done": { t: [0, 1.25, -1.9], yaw: 0.15, pitch: 0.24, dist: 2.4 },
  // Mix & Master
  mix: { t: MIXER, yaw: 0, pitch: 0.95, dist: 1.25 },
  "mix:mix": { t: [-0.3, 0.86, -1.42], yaw: -0.3, pitch: 0.72, dist: 1.15, lens: 0.8 },
  "mix:master": { t: [0.38, 0.88, -1.45], yaw: 0.42, pitch: 0.6, dist: 0.9 },
  "mix:mixmaster": { t: MIXER, yaw: 0.05, pitch: 1.05, dist: 1.25 },
  "mix:compare": { t: [0, 0.95, -1.7], yaw: -0.6, pitch: 0.35, dist: 1.5 },
  "mix:remote": { t: [2.35, 1.0, -2.4], yaw: -0.25, pitch: 0.12, dist: 1.6 },
  "mix:upload": { t: SCREEN, yaw: 0.28, pitch: 0.02, dist: 1.05 },
  "mix:contact": { t: [1.15, 1.3, -1.95], yaw: -0.45, pitch: 0.08, dist: 1.0 },
  "mix:done": { t: [0, 1.0, -1.6], yaw: -0.3, pitch: 0.3, dist: 2.7 },
  // The preview "video": one slow, moving shot per service
  "reel:intro": { t: [-0.3, 1.15, -0.8], yaw: -0.55, pitch: 0.32, dist: 5.2, spin: 0.05, push: -0.07 },
  // behind the opening titles: the dark studio, far away; the first chapter then pushes in
  "reel:dark": { t: [-0.3, 1.25, -0.8], yaw: -0.85, pitch: 0.2, dist: 6.6, spin: 0.03 },
  "reel:rec": { t: [-0.94, 1.42, 0.95], yaw: 1.05, pitch: 0.06, dist: 1.3, spin: -0.09, push: -0.035, lens: 0.7 },
  "reel:custom": { t: [0, 1.4, -2.0], yaw: 0.42, pitch: 0.05, dist: 1.45, spin: -0.07, push: -0.05 },
  "reel:mix": { t: [-0.45, 0.86, -1.45], yaw: -0.2, pitch: 0.62, dist: 1.0, slide: 0.16, spin: 0.03 },
  // "reel:store" is added at runtime: it frames the mixer display (see StudioStage)
  "reel:choose": { t: [-0.2, 1.1, -0.9], yaw: 0.35, pitch: 0.3, dist: 3.9, spin: -0.035 },
};

/** The framing of an orbit after it has been held for `held` seconds. */
export function drift(o: Orbit, held: number): Orbit {
  if (!o.spin && !o.push && !o.slide) return o;
  const h = Math.min(held, 30);
  return { ...o, yaw: o.yaw + (o.spin ?? 0) * h, dist: o.dist * Math.max(0.55, 1 + (o.push ?? 0) * h), t: [o.t[0] + (o.slide ?? 0) * Math.min(h, 6), o.t[1], o.t[2]] };
}

/** Pull-back distance in the middle of a move, so long moves arc around the room instead of cutting through it. */
export const arcFor = (a: Pose, b: Pose) => {
  const d = Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1], a.pos[2] - b.pos[2]);
  return Math.min(0.7, d * 0.22);
};

/** Move duration in seconds: unhurried, longer for longer journeys. */
export const durFor = (a: Pose, b: Pose) => {
  const d = Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1], a.pos[2] - b.pos[2]);
  const dt = Math.hypot(a.target[0] - b.target[0], a.target[1] - b.target[1], a.target[2] - b.target[2]);
  return Math.min(2.4, Math.max(1.1, 1.0 + d * 0.35 + dt * 0.25));
};

export function orbitPose(o: Orbit, portrait = false): Pose {
  // portrait phones: the panel covers the lower part, so step back a little to keep the subject whole
  const dist = o.dist * (portrait ? 1.35 : 1);
  const cp = Math.cos(o.pitch);
  return {
    pos: [o.t[0] + dist * Math.sin(o.yaw) * cp, o.t[1] + dist * Math.sin(o.pitch), o.t[2] + dist * Math.cos(o.yaw) * cp],
    target: [...o.t] as V3,
    lens: o.lens ?? 1,
  };
}
