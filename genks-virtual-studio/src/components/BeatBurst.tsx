import { useEffect, useRef } from "react";
import { rng } from "../lib/music.ts";
import { setDive } from "../lib/shots.ts";
import { setBusy, travelToId } from "../lib/stepper.ts";
import { clamp01, ease } from "../scene/camera-path.ts";
import s from "../styles/vs.module.css";
import { prefersReducedMotion } from "./ui.tsx";

let play: (() => Promise<void>) | null = null;
let running = false;

/** Mixer display → Beat Store: the camera dives into the screen, the waveform breaks apart and its pieces land on the beat cards. */
export function enterStore(): Promise<void> {
  if (running) return Promise.resolve();
  return play ? play() : travelToId("beat-store", 1);
}

const storeTop = () => {
  const el = document.getElementById("beat-store");
  return el ? el.getBoundingClientRect().top + window.scrollY : 0;
};

export function BeatBurst() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    play = () => new Promise<void>(resolve => {
      const store = document.getElementById("beat-store");
      if (!store || prefersReducedMotion()) { window.scrollTo(0, storeTop()); resolve(); return; }
      running = true;
      setBusy(true);
      const dpr = Math.min(window.devicePixelRatio, 1.5);
      const W = window.innerWidth, H = window.innerHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.dataset.on = "true";
      store.dataset.reveal = "0";
      // waveform bars across the display, then each splits in two fragments
      const N = Math.round(Math.min(96, Math.max(48, W / 16)));
      const r = rng(7);
      const amp = Array.from({ length: N }, (_, i) => 0.3 + Math.abs(Math.sin(i * 0.37) * Math.cos(i * 0.11)) * 0.55 + r() * 0.15);
      type Frag = { sx: number; sy: number; sw: number; sh: number; tx: number; ty: number; tw: number; th: number; delay: number; spin: number };
      let frags: Frag[] = [];
      let landed = false, revealed = false;
      const start = performance.now();

      const land = () => {
        // jump to the store behind the veil, then aim every fragment at a real card
        window.scrollTo(0, storeTop());
        setDive(0);
        const cards = [...store.querySelectorAll<HTMLElement>("[data-card]")].map(c => c.getBoundingClientRect());
        const targets = cards.length ? cards : [{ left: W * 0.3, top: H * 0.4, width: W * 0.4, height: H * 0.2 } as DOMRect];
        const bw = (W * 0.86) / N;
        frags = [];
        for (let i = 0; i < N; i++) {
          const x = W * 0.07 + i * bw, bh = amp[i] * H * 0.55, y = H / 2 - bh / 2;
          for (let half = 0; half < 2; half++) {
            const c = targets[(i * 2 + half) % targets.length];
            const slot = Math.floor((i * 2 + half) / targets.length);
            const per = Math.ceil((N * 2) / targets.length);
            const cover = Math.min(c.height, c.width * 0.45);
            const tw = Math.max(2, (cover * 0.8) / per * 0.55);
            frags.push({
              sx: x, sy: y + (half ? bh / 2 : 0), sw: bw * 0.62, sh: bh / 2,
              tx: c.left + cover * 0.1 + slot * ((cover * 0.8) / per), ty: c.top + c.height / 2 - (amp[i] * cover * 0.32) / 2, tw, th: amp[i] * cover * 0.32,
              delay: (i / N) * 0.22 + half * 0.05, spin: (r() - 0.5) * 2.4,
            });
          }
        }
      };

      const draw = (now: number) => {
        const t = (now - start) / 1000;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        if (t < 0.8) {
          // A: dive into the display, the waveform swells to fill the screen
          const e = ease(clamp01(t / 0.8));
          setDive(e);
          ctx.fillStyle = `rgba(6,11,23,${clamp01((t - 0.3) / 0.45)})`;
          ctx.fillRect(0, 0, W, H);
          const bw = (W * (0.3 + 0.56 * e)) / N, x0 = (W - bw * N) / 2;
          for (let i = 0; i < N; i++) {
            const bh = amp[i] * H * (0.08 + 0.47 * e) * (0.85 + 0.15 * Math.sin(t * 14 + i));
            ctx.fillStyle = i % 5 === 0 ? "#9CBFFF" : "#4C83FF";
            ctx.globalAlpha = clamp01(t / 0.25);
            ctx.fillRect(x0 + i * bw, H / 2 - bh / 2, bw * 0.62, bh);
          }
          ctx.globalAlpha = 1;
        } else {
          if (!landed) { landed = true; land(); }
          // B: the bars break apart and fly onto the beat cards while the veil lifts
          ctx.fillStyle = `rgba(6,11,23,${1 - clamp01((t - 0.85) / 0.5)})`;
          ctx.fillRect(0, 0, W, H);
          const fade = 1 - clamp01((t - 1.45) / 0.35);
          for (const f of frags) {
            const m = ease(clamp01((t - 0.8 - f.delay) / 0.6));
            const x = f.sx + (f.tx - f.sx) * m, y = f.sy + (f.ty - f.sy) * m;
            const fw = f.sw + (f.tw - f.sw) * m, fh = f.sh + (f.th - f.sh) * m;
            ctx.save();
            ctx.globalAlpha = fade;
            ctx.translate(x + fw / 2, y + fh / 2);
            ctx.rotate(Math.sin(Math.PI * m) * f.spin);
            ctx.fillStyle = "#4C83FF";
            ctx.fillRect(-fw / 2, -fh / 2, fw, fh);
            ctx.restore();
          }
          if (!revealed && t > 1.2) { revealed = true; store.dataset.reveal = "1"; }
        }
        if (t < 1.85) requestAnimationFrame(draw);
        else {
          ctx.clearRect(0, 0, W, H);
          delete canvas.dataset.on;
          setDive(0);
          setBusy(false);
          running = false;
          window.setTimeout(() => { delete store.dataset.reveal; }, 1200);
          resolve();
        }
      };
      requestAnimationFrame(draw);
    });
    return () => { play = null; };
  }, []);

  return <canvas ref={ref} className={s.burst} aria-hidden="true" />;
}
