/**
 * The site is a sequence of full-screen "screens" over one live 3D studio, never a scrolling page:
 *   reel    → the animated preview of the services, ending with "Di cosa hai bisogno?"
 *   studio  → free tour of the studio, stop by stop (virtual scroll, see lib/stepper)
 *   store   → the Beat Store screen (with its own animated intro)
 * Service screens (recording / custom / mix) open on top of the studio through the store's `panel`.
 */
import { useSyncExternalStore } from "react";

export type Screen = "reel" | "studio" | "store";
export type StoreTab = "beats" | "bundles";

type State = {
  screen: Screen;
  /** camera shot requested by the reel (null outside the reel) */
  reelShot: string | null;
  storeTab: StoreTab;
  /** bumps every time the store is entered, so its intro replays */
  storeVisit: number;
  /** the preview starts from its first chapter (false: straight to the final question) */
  reelFromStart: boolean;
  /** the preview is showing its final question (the picture stays centred) */
  reelChoosing: boolean;
  /** page of the beat catalogue on screen (the store's camera travels with it) */
  storePage: number;
};

let state: State = { screen: "reel", reelShot: "reel:intro", storeTab: "beats", storeVisit: 0, reelFromStart: false, reelChoosing: false, storePage: 0 };
const subs = new Set<() => void>();
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  if (typeof document !== "undefined") document.documentElement.dataset.screen = state.screen;
  subs.forEach(f => f());
};
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

export const getDirector = () => state;
export const onDirector = subscribe;
export function useDirector() {
  return useSyncExternalStore(subscribe, getDirector, getDirector);
}

export const setScreen = (screen: Screen) => set({ screen, reelShot: screen === "reel" ? state.reelShot ?? "reel:intro" : null });
/** Play the preview again from its first chapter. */
export const playReel = () => set({ screen: "reel", reelShot: "reel:intro", reelFromStart: true });
export const setReelShot = (reelShot: string | null) => { if (reelShot !== state.reelShot) set({ reelShot }); };
export const setReelChoosing = (reelChoosing: boolean) => { if (reelChoosing !== state.reelChoosing) set({ reelChoosing }); };
export const openStore = (tab: StoreTab = "beats") => set({ screen: "store", reelShot: null, storeTab: tab, storeVisit: state.storeVisit + 1 });
export const setStoreTab = (storeTab: StoreTab) => set({ storeTab });
export const setStorePage = (storePage: number) => { if (storePage !== state.storePage) set({ storePage }); };

if (typeof document !== "undefined") document.documentElement.dataset.screen = state.screen;
