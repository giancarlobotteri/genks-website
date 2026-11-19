/**
 * The photographic studio. The opening film (Higgsfield Genjutsu, one continuous take: microphone →
 * the four services → the studio lights up → DAW → console → display) is also the studio itself:
 * after the preview, moving from stop to stop scrubs that same footage (keyframe every 4 frames, so
 * seeking is instant). The live 3D studio stays underneath as the fallback when the video can't play.
 */
import { prefersReducedMotion } from "../components/ui.tsx";
import type { FilmLike } from "./film-seq.ts";

/**
 * The film as sharp stills (lib/film-seq: /film/hd or /film/sd, 313 WebP frames at 24 fps) and the
 * depth of every frame (Depth Anything V2) packed in one atlas: the studio is drawn as a living
 * photograph (scene/living-plate).
 */
export const FILM = {
  hd: "/film/hd", sd: "/film/sd", frames: 313, depthAtlas: "/film/depth-atlas.webp", depthGrid: [14, 23] as [number, number],
  vault: "/film/vault.webp", vaultDepth: "/film/vault-depth.webp",
};

// The film has one player, owned by the studio stage; the preview plays it, the tour scrubs it.
let filmVideo: FilmLike | null = null;
let reelFilm = false;
const videoSubs = new Set<(v: FilmLike | null) => void>();
export const setFilmVideo = (v: FilmLike | null) => {
  if (v === filmVideo) return;
  filmVideo = v;
  // read-only handle for the automated checks (scripts/smoke.cjs)
  if (typeof window !== "undefined") (window as unknown as { __vsFilm: FilmLike | null }).__vsFilm = v;
  videoSubs.forEach(f => f(v));
};
/** The studio (and its film) may mount after the preview: be told when the film is there. */
export const onFilmVideo = (f: (v: FilmLike | null) => void) => { videoSubs.add(f); return () => { videoSubs.delete(f); }; };
export const getFilmVideo = () => filmVideo;
/** The preview is playing the film: the studio shows it as it plays (no seeking). */
export const setReelFilm = (on: boolean) => { reelFilm = on; };
export const isReelFilm = () => reelFilm;
/** Portrait screens during the preview: where the subject is across the film (crop position, %). */
const FILM_PAN: [number, number][] = [[0, 50], [2.4, 50], [2.7, 24], [4.6, 76], [5.1, 50], [13, 50]];
export const panAt = (t: number) => {
  for (let k = 0; k < FILM_PAN.length - 1; k++) {
    const [t0, x0] = FILM_PAN[k], [t1, x1] = FILM_PAN[k + 1];
    if (t <= t1) { const u = Math.max(0, (t - t0) / (t1 - t0)); return x0 + (x1 - x0) * (0.5 - 0.5 * Math.cos(Math.PI * u)); }
  }
  return 50;
};
export const FILM_W = 1920, FILM_H = 1080;

/** Which file this device should play (null: no film at all, e.g. data saver). */
export function pickFilm(opts: { motion?: boolean } = {}): string | null {
  if (typeof window === "undefined") return null;
  if (opts.motion !== false && prefersReducedMotion()) return null;
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (c?.saveData || /(^|-)2g$/.test(c?.effectiveType ?? "")) return null;
  // phones crop the 16:9 picture to fill the portrait screen, so they need the sharper file too
  const px = Math.max(window.screen.width, window.screen.height) * Math.min(2, window.devicePixelRatio || 1);
  return px >= 1600 ? FILM.hd : FILM.sd;
}

/** The moment of the take that is each stop of the tour (s): mic, services, studio, DAW, Mix, Master, Mix & Master, display. */
export const STOP_T = [0.6, 3.4, 5.8, 7.6, 9.4, 10.0, 11.2, 12.95];
/** Film time for a (fractional) tour position. */
export function filmTimeAt(pos: number) {
  const p = Math.max(0, Math.min(STOP_T.length - 1, pos));
  const i = Math.min(STOP_T.length - 2, Math.floor(p));
  return STOP_T[i] + (STOP_T[i + 1] - STOP_T[i]) * (p - i);
}
/** Film time for the preview shots and the service screens. */
export const SHOT_T: Record<string, number> = {
  "reel:choose": 5.8, "reel:intro": 5.8, "reel:dark": 0.6, "reel:rec": 0.6, "reel:custom": 7.6, "reel:mix": 9.4, "reel:store": 12.95,
  rec: 0.6, custom: 7.6, mix: 9.4, "mix:mix": 9.4, "mix:master": 10.0, "mix:mixmaster": 11.2, "mix:remote": 9.4,
};

/** Where things are in the picture (fractions of the 16:9 frame) at their stop. */
export const SPOTS = {
  mic: { x: 0.47, y: 0.42, r: 0.11 },
  screen: { x: 0.5, y: 0.4, r: 0.16 },
  display: { x: 0.5, y: 0.36, r: 0.14 },
  mixer: { x: 0.5, y: 0.6, r: 0.3 },
  /** the four services on their plinths (captions sit under them) */
  lineup: [{ x: 0.24, y: 0.83 }, { x: 0.41, y: 0.83 }, { x: 0.6, y: 0.83 }, { x: 0.79, y: 0.83 }],
  lineupObj: [{ x: 0.22, y: 0.38 }, { x: 0.41, y: 0.38 }, { x: 0.6, y: 0.38 }, { x: 0.79, y: 0.38 }],
};

/** Portrait screens: horizontal position of the crop along the tour (0..1): the microphone sits a little left. */
export const panAtPos = (pos: number) => (pos < 0.5 ? 0.47 : 0.5);

/**
 * Screen position of a point of the film frame, given how the plate is laid out: object-fit cover
 * in a w×h box with horizontal object position `ox` (0..1), then scaled by `scale` around the centre
 * and moved by `tx`, `ty` (px).
 */
export function frameToScreen(nx: number, ny: number, w: number, h: number, ox: number, scale: number, tx: number, ty: number) {
  const cs = Math.max(w / FILM_W, h / FILM_H);
  const dw = FILM_W * cs, dh = FILM_H * cs;
  const px = (w - dw) * ox + nx * dw, py = (h - dh) * 0.5 + ny * dh;
  return { x: w / 2 + (px - w / 2) * scale + tx, y: h / 2 + (py - h / 2) * scale + ty, unit: dw * scale };
}
