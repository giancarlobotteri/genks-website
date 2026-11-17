import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { localCart, localContent } from "./adapters.ts";
import { demoContent } from "./data/fixtures.ts";
import { upsertCart } from "./lib/catalog.ts";
import { bindAudio, envelopeOf, registerEnvelope } from "./lib/level.ts";
import { renderBeatPreview } from "./lib/synth.ts";
import { encodeWav } from "./lib/wav.ts";
import type { Beat, CartItem, StudioContent } from "./types.ts";

/* ---------------- Panels / UI ---------------- */
export type Panel =
  | { type: "recording" }
  | { type: "custom" }
  | { type: "mix"; tab?: "mix" | "master" | "mixmaster"; view?: "services" | "remote" }
  | { type: "beat"; id: string }
  | { type: "cart" }
  | { type: "checkout" }
  | { type: "exclusive"; beatId: string }
  | { type: "bundle"; id: string };

type StudioCtx = {
  content: StudioContent;
  hydrated: boolean;
  setContent: (next: StudioContent) => void;
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (beatId: string) => void;
  clearCart: () => void;
  panel: Panel | null;
  /** Last opened panel: keeps content visible during the closing animation. */
  lastPanel: Panel | null;
  open: (p: Panel) => void;
  close: () => void;
};

const Ctx = createContext<StudioCtx | null>(null);

export function useStudio() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStudio outside StudioProvider");
  return v;
}

/* ---------------- Player ---------------- */
type PlayerState = { currentId: string | null; playing: boolean; loading: boolean; error: string | null; volume: number; queue: string[] };
type PlayerCtx = PlayerState & {
  toggle: (beat: Beat, queue?: string[]) => void;
  pause: () => void;
  next: () => void;
  prev: () => void;
  seek: (t: number) => void;
  setVolume: (v: number) => void;
};
type ProgressCtx = { time: number; duration: number };

const PCtx = createContext<PlayerCtx | null>(null);
const ProgCtx = createContext<ProgressCtx>({ time: 0, duration: 0 });
export function usePlayer() {
  const v = useContext(PCtx);
  if (!v) throw new Error("usePlayer outside StudioProvider");
  return v;
}
export const useProgress = () => useContext(ProgCtx);

/** Any other audio source (e.g. the step sequencer) announces itself so only one plays. */
export const AUDIO_CLAIM = "genks:vs:audio-claim";

export function StudioProvider({ children }: { children: ReactNode }) {
  // Client-only SPA: browser storage is read synchronously on first render.
  const [content, setContentState] = useState<StudioContent>(() => (typeof window === "undefined" ? demoContent : localContent.load()));
  const hydrated = true;
  const [cart, setCart] = useState<CartItem[]>(() => (typeof window === "undefined" ? [] : localCart.load()));
  const [panel, setPanel] = useState<Panel | null>(null);
  const [lastPanel, setLastPanel] = useState<Panel | null>(null);
  const openPanel = useCallback((p: Panel) => { setPanel(p); setLastPanel(p); }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key?.startsWith("genks:vs:content")) setContentState(localContent.load());
      if (e.key?.startsWith("genks:vs:cart")) setCart(localCart.load());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setContent = useCallback((next: StudioContent) => { setContentState(next); localContent.save(next); }, []);
  const saveCart = useCallback((items: CartItem[]) => { setCart(items); localCart.save(items); }, []);

  const studio = useMemo<StudioCtx>(() => ({
    content, hydrated, setContent, cart,
    addToCart: item => saveCart(upsertCart(cart, item)),
    removeFromCart: id => saveCart(cart.filter(i => i.beatId !== id)),
    clearCart: () => saveCart([]),
    panel, lastPanel, open: openPanel, close: () => setPanel(null),
  }), [content, hydrated, setContent, cart, saveCart, panel, lastPanel, openPanel]);

  /* ---- player ---- */
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urls = useRef(new Map<string, string>());
  const reqId = useRef(0);
  const unlocked = useRef(false);
  const [ps, setPs] = useState<PlayerState>({ currentId: null, playing: false, loading: false, error: null, volume: 0.7, queue: [] });
  const [prog, setProg] = useState<ProgressCtx>({ time: 0, duration: 0 });
  const contentRef = useRef(content);
  useEffect(() => { contentRef.current = content; }, [content]);
  const psRef = useRef(ps);
  useEffect(() => { psRef.current = ps; }, [ps]);

  const audio = useCallback(() => {
    if (!audioRef.current) {
      const a = new Audio();
      a.preload = "auto";
      a.volume = psRef.current.volume;
      a.addEventListener("timeupdate", () => setProg({ time: a.currentTime, duration: Number.isFinite(a.duration) ? a.duration : 0 }));
      a.addEventListener("loadedmetadata", () => setProg({ time: a.currentTime, duration: a.duration }));
      a.addEventListener("play", () => setPs(s => ({ ...s, playing: true })));
      a.addEventListener("pause", () => setPs(s => ({ ...s, playing: false })));
      a.addEventListener("ended", () => setPs(s => ({ ...s, playing: false })));
      audioRef.current = a;
      bindAudio(a);
    }
    return audioRef.current;
  }, []);

  const load = useCallback(async (beat: Beat, queue?: string[]) => {
    const id = ++reqId.current;
    window.dispatchEvent(new CustomEvent(AUDIO_CLAIM, { detail: "player" }));
    setPs(s => ({ ...s, currentId: beat.id, loading: true, error: null, queue: queue ?? (s.queue.includes(beat.id) ? s.queue : [beat.id]) }));
    // iOS/Safari only allow play() inside the tap itself. The preview is rendered asynchronously,
    // so the element is "unlocked" right now with a moment of silence, still within the gesture.
    if (!unlocked.current) {
      unlocked.current = true;
      const a = audio();
      a.src = URL.createObjectURL(new Blob([encodeWav([new Float32Array(800)], 8000)], { type: "audio/wav" }));
      void a.play().catch(() => {});
    }
    try {
      let url = urls.current.get(beat.id + beat.style + beat.bpm + beat.key);
      if (!url) {
        const blob = await renderBeatPreview(beat);
        url = URL.createObjectURL(blob);
        registerEnvelope(url, envelopeOf(blob));
        urls.current.set(beat.id + beat.style + beat.bpm + beat.key, url);
      }
      if (id !== reqId.current) return;
      const a = audio();
      if (a.src !== url) a.src = url;
      await a.play();
      setPs(s => ({ ...s, loading: false }));
    } catch {
      if (id !== reqId.current) return;
      setPs(s => ({ ...s, loading: false, playing: false, error: "Anteprima non disponibile in questo browser." }));
    }
  }, [audio]);

  const player = useMemo<PlayerCtx>(() => {
    const byId = (id: string) => contentRef.current.beats.find(b => b.id === id);
    const step = (dir: 1 | -1) => {
      const { queue, currentId } = psRef.current;
      if (!queue.length || !currentId) return;
      if (dir === -1 && (audioRef.current?.currentTime ?? 0) > 3) { audioRef.current!.currentTime = 0; return; }
      const i = queue.indexOf(currentId);
      const nextId = queue[(i + dir + queue.length) % queue.length];
      const b = nextId ? byId(nextId) : undefined;
      if (b) void load(b, queue);
    };
    return {
      ...ps,
      toggle(beat, queue) {
        const a = audioRef.current;
        if (psRef.current.currentId === beat.id && a && a.src) {
          if (a.paused) { window.dispatchEvent(new CustomEvent(AUDIO_CLAIM, { detail: "player" })); void a.play().catch(() => {}); }
          else a.pause();
          if (queue) setPs(s => ({ ...s, queue }));
          return;
        }
        void load(beat, queue);
      },
      pause: () => audioRef.current?.pause(),
      next: () => step(1),
      prev: () => step(-1),
      seek(t) { const a = audioRef.current; if (a && Number.isFinite(a.duration)) a.currentTime = Math.max(0, Math.min(a.duration, t)); },
      setVolume(v) { const a = audio(); a.volume = v; setPs(s => ({ ...s, volume: v })); },
    };
  }, [ps, load, audio]);

  useEffect(() => {
    const onClaim = (e: Event) => { if ((e as CustomEvent).detail !== "player") audioRef.current?.pause(); };
    window.addEventListener(AUDIO_CLAIM, onClaim);
    const map = urls.current;
    return () => {
      window.removeEventListener(AUDIO_CLAIM, onClaim);
      audioRef.current?.pause();
      map.forEach(u => URL.revokeObjectURL(u));
    };
  }, []);

  return <Ctx.Provider value={studio}><PCtx.Provider value={player}><ProgCtx.Provider value={prog}>{children}</ProgCtx.Provider></PCtx.Provider></Ctx.Provider>;
}
