// Cinematic cues: when the visitor chooses a service or a payment method, the panel steps aside,
// the 3D camera flies to the matching object in the studio (microphone, faders, rack, clock,
// POS terminal, cash box…) and then the panel comes back. Same motion language as the
// microphone → mixer → catalogue scroll, triggered by buttons instead of scroll.
import { useSyncExternalStore } from "react";

export type ShotId =
  | "mic" | "onair" | "clock" | "faders" | "rack" | "console" | "screen" | "display"
  | "speakers" | "keys" | "pos" | "cash" | "approved" | "sofa";

export type Cue = {
  id: number;
  shot: ShotId;
  kicker: string;
  title: string;
  sub?: string;
  /** Total duration in ms (flight + hold). */
  ms: number;
  /** Free data for the scene (e.g. the chosen time for the clock, a label for the display). */
  data?: Record<string, string>;
};

type State = { cue: Cue | null; leaving: boolean };
let state: State = { cue: null, leaving: false };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
const set = (next: State) => { state = next; emit(); syncDom(); };

let seq = 0;
let timer = 0;
let leaveTimer = 0;
let resolveCurrent: (() => void) | null = null;

function syncDom() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const v = state.cue ? (state.leaving ? "out" : "on") : null;
  if (v) root.dataset.vsCinema = v; else delete root.dataset.vsCinema;
  // ::backdrop is not restyled when an ancestor attribute changes: mark the open dialogs themselves
  document.querySelectorAll("dialog").forEach(d => { if (v) d.dataset.cinema = v; else delete d.dataset.cinema; });
}

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
/** The 3D stage sets this when it is rendering; in lite mode or on the admin page cues resolve at once. */
export const stageLive = () => typeof document !== "undefined" && document.documentElement.dataset.vsStage === "3d";

function finish() {
  window.clearTimeout(timer);
  const r = resolveCurrent;
  resolveCurrent = null;
  if (!state.cue) { r?.(); return; }
  set({ cue: state.cue, leaving: true });
  window.clearTimeout(leaveTimer);
  leaveTimer = window.setTimeout(() => set({ cue: null, leaving: false }), 520);
  r?.();
}

/**
 * Play a cue. Resolves when the shot is over (or skipped) so the caller can continue
 * (e.g. show the success state after the "approved" shot).
 */
export function playCue(shot: ShotId, text: { kicker: string; title: string; sub?: string }, opts: { ms?: number; data?: Record<string, string> } = {}): Promise<void> {
  if (typeof window === "undefined" || !stageLive() || reduced()) return Promise.resolve();
  // a new cue replaces the running one: resolve the previous caller immediately
  const prev = resolveCurrent;
  resolveCurrent = null;
  prev?.();
  window.clearTimeout(timer);
  window.clearTimeout(leaveTimer);
  // ?cueslow=N stretches cues for visual QA on slow (software-rendered) browsers
  const slow = Number(new URLSearchParams(window.location.search).get("cueslow")) || 1;
  const cue: Cue = { id: ++seq, shot, ...text, ms: (opts.ms ?? 2100) * slow, data: opts.data };
  set({ cue, leaving: false });
  return new Promise<void>(resolve => {
    resolveCurrent = resolve;
    timer = window.setTimeout(finish, cue.ms);
  });
}

export function skipCue() { if (state.cue && !state.leaving) finish(); }
export const cueActive = () => Boolean(state.cue && !state.leaving);
export const getCue = () => state;

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const useCue = () => useSyncExternalStore(subscribe, getCue, getCue);
export const subscribeCue = subscribe;
