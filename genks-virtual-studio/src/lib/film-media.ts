/**
 * The photographic studio. The opening film (Higgsfield Genjutsu, one continuous take: microphone →
 * the four services → the studio lights up → DAW → console → display) is also the studio itself:
 * after the preview, moving from stop to stop scrubs that same footage (keyframe every 4 frames, so
 * seeking is instant). The live 3D studio stays underneath as the fallback when the video can't play.
 */
import { prefersReducedMotion } from "../components/ui.tsx";
import type { FilmLike } from "./film-seq.ts";

/**
 * The film as sharp stills (lib/film-seq: /film/xl, /film/hd or /film/sd, 313 WebP frames at 24 fps, from the 4K master) and the
 * depth of every frame (Depth Anything V2) packed in one atlas: the studio is drawn as a living
 * photograph (scene/living-plate).
 */
export const FILM = {
  xl: `${import.meta.env.BASE_URL}film/xl`, hd: `${import.meta.env.BASE_URL}film/hd`, sd: `${import.meta.env.BASE_URL}film/sd`, frames: 313, depthAtlas: `${import.meta.env.BASE_URL}film/depth-atlas.webp`, depthGrid: [14, 23] as [number, number],
  vault: `${import.meta.env.BASE_URL}film/vault.webp`, vaultDepth: `${import.meta.env.BASE_URL}film/vault-depth.webp`,
  /** the arrival at the microphone after the preview: a real dolly from far across the studio (Kling) */
  arrive: `${import.meta.env.BASE_URL}film/arrive.mp4`,
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
  // the width of the picture on screen, in device pixels: a portrait phone shows the 16:9 frame at the
  // full height of the screen (cropped at the sides), so it needs a wide file as much as a large monitor
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const need = Math.max(window.innerWidth, window.innerHeight * 16 / 9) * dpr;
  // 2560 px frames (from the 4K master) whenever the screen would enlarge the 1920 ones
  return need > 2000 ? FILM.xl : need > 1350 ? FILM.hd : FILM.sd;
}

/**
 * The moment of the take that is each stop of the tour (s): mic, studio, DAW, Mix, Master, Mix & Master,
 * the four services together, and the Beat Store (its own place, the record vault: not in the film).
 * Mix, Master and Mix & Master are three moments of the one sharp push into the console (11.2 → 12.4 s).
 */
export const STOP_T = [0.6, 5.8, 7.6, 11.17, 11.85, 12.4, 3.4, 3.4];
/** stops reached by a cut (a quick dip through the dark) rather than by moving through the footage */
const CUT_TO = new Set([1, 6, 7]);
/** the stop of the Beat Store: the photographic record vault */
export const STORE_STOP_INDEX = 7;
/** the record of the Beat Store on its plinth, in the frame of the four services */
export const STORE_T = 3.4;
export const VINYL = { x: 0.7734, y: 0.3528, r: 0.106 };
/** Film time for a (fractional) tour position. */
export function filmTimeAt(pos: number) {
  const p = Math.max(0, Math.min(STOP_T.length - 1, pos));
  const i = Math.min(STOP_T.length - 2, Math.floor(p)), f = p - i;
  // across a cut each side holds its own moment (with a little drift towards the other)
  if (CUT_TO.has(i + 1)) return f < 0.5 ? STOP_T[i] + Math.min(0.2, f * 0.4) : STOP_T[i + 1] - Math.min(0.2, (1 - f) * 0.4);
  return STOP_T[i] + (STOP_T[i + 1] - STOP_T[i]) * f;
}
/** Film time for the preview shots and the service screens. */
export const SHOT_T: Record<string, number> = {
  "reel:choose": 5.8, "reel:intro": 5.8, "reel:dark": 0.6, "reel:rec": 0.6, "reel:custom": 7.6, "reel:mix": 11.17, "reel:store": STORE_T,
  rec: 0.6, custom: 7.6, mix: 11.17, "mix:mix": 11.17, "mix:master": 11.85, "mix:mixmaster": 12.4, "mix:remote": 11.17,
};

/** Where things are in the picture (fractions of the 16:9 frame) at their stop. */
export const SPOTS = {
  mic: { x: 0.47, y: 0.42, r: 0.11 },
  screen: { x: 0.5, y: 0.4, r: 0.16 },
  /** the Beat Store: its record (see VINYL) */
  display: { x: 0.7734, y: 0.3528, r: 0.12 },
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
