/**
 * Site navigation as camera moves: every entry point (preview choice, hotspots, dock, menu)
 * goes through here, so the same transition plays wherever the user comes from.
 */
import type { Panel } from "../store.tsx";
import { getDirector, openStore, playReel, setScreen, type StoreTab } from "./director.ts";
import { animateDive, getSubShot } from "./shots.ts";
import { goToStop, isMoving, stopPos } from "./stepper.ts";

export type ServiceKind = "recording" | "custom" | "mix";
/** Studio stop of each service (index into STOPS). */
export const SERVICE_STOP: Record<ServiceKind, number> = { recording: 0, custom: 3, mix: 4 };
export const STORE_STOP = 7;

let openFn: ((p: Panel) => void) | null = null;
let closeFn: (() => void) | null = null;
export const bindNav = (open: (p: Panel) => void, close: () => void) => { openFn = open; closeFn = close; };

let busy = false;
const lock = (on: boolean) => {
  busy = on;
  if (on) document.documentElement.dataset.busy = "true";
  else delete document.documentElement.dataset.busy;
};

/** Open a service screen: the camera flies to its object (from the preview, the studio or the store). */
export async function goService(kind: ServiceKind, extra?: { tab?: "mix" | "master" | "mixmaster"; view?: "services" | "remote" }) {
  if (busy) return;
  const fromStore = getDirector().screen === "store";
  setScreen("studio");
  void goToStop(SERVICE_STOP[kind], true);
  if (fromStore) void animateDive(0, 1100);
  openFn?.(kind === "mix" ? { type: "mix", ...extra } : { type: kind });
}

/** Free tour of the studio from a stop. */
export async function goStudio(stop = 0) {
  if (busy) return;
  closeFn?.();
  const fromStore = getDirector().screen === "store";
  setScreen("studio");
  if (fromStore) { void goToStop(STORE_STOP, true); await animateDive(0, 1300); }
  await goToStop(stop);
}

/** Into the Beat Store screen: the camera dives into the mixer display, then the store intro plays. */
export async function enterStore(tab: StoreTab = "beats") {
  if (busy) return;
  if (getDirector().screen === "store") { openStore(tab); return; }
  closeFn?.();
  lock(true);
  try {
    await animateDive(1, 850);
    openStore(tab);
  } finally {
    lock(false);
  }
}

/** Back to the animated preview. */
export function replayReel() {
  if (busy) return;
  closeFn?.();
  void animateDive(0, 600);
  playReel();
}

/** Read-only state for the automated end-to-end checks (scripts/smoke.cjs). */
if (typeof window !== "undefined") {
  (window as unknown as { __vs: unknown }).__vs = {
    pos: () => stopPos(), moving: () => isMoving(), screen: () => getDirector().screen,
    reel: () => getDirector().reelShot, shot: () => getSubShot(),
    /** jump the virtual scroll to any position, fractional too (screenshots / checks) */
    go: (p: number) => goToStop(p, true),
  };
}
