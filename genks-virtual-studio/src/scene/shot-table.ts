// Camera framings for every service step. Pure data + math (unit-tested).
import type { Pose, V3 } from "./camera-path.ts";

/** Orbit framing: look at `t` from `dist` metres, `yaw` around Y (0 = from +Z), `pitch` up. */
export type Orbit = { t: V3; yaw: number; pitch: number; dist: number };

const MIC: V3 = [-0.94, 1.44, 0.95];
const SCREEN: V3 = [0, 1.43, -2.02];
const MIXER: V3 = [0, 0.86, -1.46];

export const SHOTS: Record<string, Orbit> = {
  // Registrazione
  rec: { t: MIC, yaw: 0.7, pitch: 0.1, dist: 0.8 },
  "rec:pkg": { t: MIC, yaw: -0.55, pitch: 0.16, dist: 0.85 },
  "rec:cal": { t: [-0.94, 1.25, 0.95], yaw: 0.25, pitch: 0.42, dist: 1.7 },
  "rec:contact": { t: [-0.94, 1.46, 0.95], yaw: 1.35, pitch: 0.02, dist: 0.6 },
  "rec:done": { t: [-0.6, 1.2, 0.2], yaw: 0.45, pitch: 0.25, dist: 2.7 },
  // Beat su misura
  custom: { t: SCREEN, yaw: -0.32, pitch: 0.05, dist: 1.05 },
  "custom:seq": { t: [-1.0, 0.86, -1.47], yaw: 0.3, pitch: 0.78, dist: 0.8 },
  "custom:steps": { t: [-1.15, 1.3, -1.95], yaw: 0.5, pitch: 0.06, dist: 0.95 },
  "custom:form": { t: [1.15, 1.3, -1.95], yaw: -0.5, pitch: 0.06, dist: 0.95 },
  "custom:done": { t: [0, 1.25, -1.9], yaw: 0.15, pitch: 0.24, dist: 2.4 },
  // Mix & Master
  mix: { t: MIXER, yaw: 0, pitch: 0.95, dist: 1.25 },
  "mix:mix": { t: [-0.3, 0.86, -1.42], yaw: -0.3, pitch: 0.72, dist: 0.95 },
  "mix:master": { t: [0.38, 0.88, -1.45], yaw: 0.42, pitch: 0.6, dist: 0.9 },
  "mix:mixmaster": { t: MIXER, yaw: 0.05, pitch: 1.05, dist: 1.25 },
  "mix:compare": { t: [0, 0.95, -1.7], yaw: -0.6, pitch: 0.35, dist: 1.5 },
  "mix:remote": { t: [2.35, 1.0, -2.4], yaw: -0.25, pitch: 0.12, dist: 1.6 },
  "mix:upload": { t: SCREEN, yaw: 0.28, pitch: 0.02, dist: 1.05 },
  "mix:contact": { t: [1.15, 1.3, -1.95], yaw: -0.45, pitch: 0.08, dist: 1.0 },
  "mix:done": { t: [0, 1.0, -1.6], yaw: -0.3, pitch: 0.3, dist: 2.7 },
};

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
  };
}
