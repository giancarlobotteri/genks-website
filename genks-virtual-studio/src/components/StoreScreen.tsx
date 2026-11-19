import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { setStoreTab, useDirector } from "../lib/director.ts";
import { rng } from "../lib/music.ts";
import { goStudio, STORE_STOP } from "../lib/nav.ts";
import { clamp01, ease } from "../scene/camera-path.ts";
import { useStudio } from "../store.tsx";
import s from "../styles/vs.module.css";
import { GenksSymbol } from "./brand.tsx";
import { BeatStore } from "./BeatStore.tsx";
import { Bundles } from "./Bundles.tsx";
import { prefersReducedMotion } from "./ui.tsx";
import { CountUp } from "./Wizard.tsx";

const SEEN = "genks:vs:store-intro";

/** Chapters of the store intro (seconds). The short version (later visits) only plays the landing. */
const FULL = { title: 0.25, count: 2.1, lic: 3.9, land: 5.6 };
const SHORT = { title: -1, count: -1, lic: -1, land: 0.55 };
const LAND_DUR = 1.15;

/**
 * The Beat Store's own animated intro: inside the mixer display the waveform pulses, the title
 * assembles letter by letter, the catalogue counts itself, the licences fly in — then the wave
 * breaks apart and every fragment lands on a beat card, which opens where it lands.
 */
function StoreIntro({ full, onDone }: { full: boolean; onDone: () => void }) {
  const { content } = useStudio();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const skipRef = useRef<() => void>(() => {});
  const [phase, setPhase] = useState<"title" | "count" | "lic" | "land">(full ? "title" : "land");
  const beats = content.beats.filter(b => b.status === "published");
  const genres = [...new Set(beats.map(b => b.genre))].slice(0, 6);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const T = full ? { ...FULL } : { ...SHORT };
    const dpr = Math.min(window.devicePixelRatio, 1.5);
    const W = window.innerWidth, H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const N = Math.round(Math.min(96, Math.max(44, W / 16)));
    const r = rng(7);
    const amp = Array.from({ length: N }, (_, i) => 0.3 + Math.abs(Math.sin(i * 0.37) * Math.cos(i * 0.11)) * 0.55 + r() * 0.15);
    type Frag = { sx: number; sy: number; sw: number; sh: number; tx: number; ty: number; tw: number; th: number; delay: number; spin: number };
    let frags: Frag[] | null = null;
    let revealed = false, cur = "";
    const store = document.getElementById("beat-store");
    if (store) store.dataset.reveal = "0";
    let t0 = performance.now(), raf = 0;
    skipRef.current = () => { if (performance.now() - t0 < T.land * 1000) t0 = performance.now() - T.land * 1000; };

    const land = () => {
      const cards = [...document.querySelectorAll<HTMLElement>("#beat-store [data-card]")].map(c => c.getBoundingClientRect());
      const targets = cards.length ? cards : [{ left: W * 0.3, top: H * 0.4, width: W * 0.4, height: H * 0.2 } as DOMRect];
      const bw = (W * 0.86) / N;
      frags = [];
      for (let i = 0; i < N; i++) {
        const x = W * 0.07 + i * bw, bh = amp[i] * H * 0.3, y = H * 0.62 - bh / 2;
        for (let half = 0; half < 2; half++) {
          const c = targets[(i * 2 + half) % targets.length];
          const slot = Math.floor((i * 2 + half) / targets.length);
          const per = Math.ceil((N * 2) / targets.length);
          const cover = Math.min(c.height, c.width * 0.45);
          const tw = Math.max(2, (cover * 0.8) / per * 0.55);
          frags.push({
            sx: x, sy: y + (half ? bh / 2 : 0), sw: bw * 0.62, sh: bh / 2,
            tx: c.left + cover * 0.1 + slot * ((cover * 0.8) / per), ty: c.top + c.height / 2 - (amp[i] * cover * 0.32) / 2, tw, th: amp[i] * cover * 0.32,
            delay: (i / N) * 0.24 + half * 0.05, spin: (r() - 0.5) * 2.4,
          });
        }
      }
    };

    const draw = (now: number) => {
      const t = (now - t0) / 1000;
      const ph = t >= T.land ? "land" : t >= T.lic && T.lic >= 0 ? "lic" : t >= T.count && T.count >= 0 ? "count" : "title";
      if (ph !== cur) { cur = ph; setPhase(ph); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (t < T.land) {
        // the waveform inside the display: it breathes, sweeps and grows chapter after chapter
        const grow = ease(clamp01(t / 1.2));
        const bw = (W * 0.86) / N, x0 = W * 0.07;
        for (let i = 0; i < N; i++) {
          const wave = 0.75 + 0.25 * Math.sin(t * 5 + i * 0.35) * Math.sin(t * 1.3 + i * 0.07);
          const bh = amp[i] * H * 0.3 * grow * wave;
          const lit = Math.abs(((t * 0.45) % 1) - i / N) < 0.06;
          ctx.fillStyle = lit ? "#E8F0FF" : i % 5 === 0 ? "#9CBFFF" : "#4C83FF";
          ctx.globalAlpha = 0.35 + 0.65 * grow;
          ctx.fillRect(x0 + i * bw, H * 0.62 - bh / 2, bw * 0.62, bh);
        }
        ctx.globalAlpha = 1;
      } else {
        if (!frags) land();
        const lt = t - T.land;
        // the bars break apart and fly onto the beat cards while the veil lifts
        const fade = 1 - clamp01((lt - 0.7) / 0.4);
        for (const f of frags!) {
          const m = ease(clamp01((lt - f.delay) / 0.62));
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
        if (!revealed && lt > 0.4) { revealed = true; if (store) store.dataset.reveal = "1"; }
      }
      if (t < T.land + LAND_DUR) raf = requestAnimationFrame(draw);
      else {
        window.setTimeout(() => { if (store) delete store.dataset.reveal; }, 1200);
        onDone();
      }
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); if (store) delete store.dataset.reveal; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={s.storeIntro} data-phase={phase} data-full={full || undefined} aria-hidden={phase === "land" || undefined}>
      <div className={s.storeIntroVeil} />
      <canvas ref={canvasRef} className={s.storeIntroCanvas} aria-hidden="true" />
      {full && (
        <div className={s.storeIntroText} role="status" aria-live="polite">
          <div className={s.siTitle} data-on={phase === "title" || undefined}>
            <p className={s.reelKicker}><span>GENKS · Catalogo</span></p>
            <h2 aria-label="Beat Store">{"BEAT STORE".split("").map((ch, i) => <span key={i} style={{ ["--l" as string]: i } as CSSProperties}>{ch === " " ? " " : ch}</span>)}</h2>
          </div>
          <div className={s.siCount} data-on={phase === "count" || undefined}>
            {phase === "count" && <p className={s.siBig}><CountUp value={beats.length} ms={1100} /></p>}
            <p className={s.siLine}>beat originali, prodotti in studio</p>
            <ul className={s.siChips}>{genres.map((g, k) => <li key={g} style={{ ["--c" as string]: k } as CSSProperties}>{g}</li>)}</ul>
          </div>
          <div className={s.siLic} data-on={phase === "lic" || undefined}>
            <p className={s.siLine}>Ascolti l’anteprima, scegli la licenza</p>
            <ul className={s.siChips} data-lic>{content.licenses.map((l, k) => <li key={l.id} style={{ ["--c" as string]: k } as CSSProperties}><strong>{l.name}</strong><small>{l.format}</small></li>)}</ul>
          </div>
        </div>
      )}
      {full && phase !== "land" && (
        <button type="button" className={`${s.btnGhost} ${s.siSkip}`} onClick={() => skipRef.current()}>Vai ai beat <ArrowRight size={16} /></button>
      )}
    </div>
  );
}

/** The Beat Store as its own screen: catalogue and bundles, entered from the studio's mixer display. */
export function StoreScreen() {
  const { screen, storeTab, storeVisit } = useDirector();
  const on = screen === "store";
  // on screen while "on", and for a moment after leaving (its exit animation)
  const [leaving, setLeaving] = useState(false);
  const mounted = on || leaving;
  const [intro, setIntro] = useState<{ visit: number; full: boolean } | null>(null);
  const headRef = useRef<HTMLHeadingElement>(null);
  const wasOn = useRef(on);

  // every entry replays the intro: the full one the first time in this session, then the short landing
  useEffect(() => {
    if (on) {
      let seen = false;
      try { seen = sessionStorage.getItem(SEEN) === "1"; } catch { /* private mode */ }
      // eslint-disable-next-line react-hooks/set-state-in-effect -- entering the store resets its exit state once per visit
      setIntro(prefersReducedMotion() ? null : { visit: storeVisit, full: !seen });
      try { sessionStorage.setItem(SEEN, "1"); } catch { /* private mode */ }
      wasOn.current = true;
      setLeaving(false);
      requestAnimationFrame(() => headRef.current?.focus({ preventScroll: true }));
      return;
    }
    // only after having been on screen: keep it for its exit animation
    if (!wasOn.current) return;
    wasOn.current = false;
    setLeaving(true);
    const t = window.setTimeout(() => { setLeaving(false); setIntro(null); }, 600);
    return () => window.clearTimeout(t);
  }, [on, storeVisit]);

  if (!mounted) return null;
  return (
    <div className={s.storeScreen} data-on={on || undefined} data-tab={storeTab} role="region" aria-labelledby="store-screen-title">
      <div className={s.storeScreenBar}>
        <button type="button" className={s.btnText} data-store-back onClick={() => void goStudio(STORE_STOP)} aria-label="Torna allo studio"><ArrowLeft size={16} /><span className={s.hideXxs}> Studio</span></button>
        <h2 id="store-screen-title" ref={headRef} tabIndex={-1} className={s.srOnly}>Beat Store GENKS</h2>
        <div role="tablist" aria-label="Catalogo" className={s.storeTabs} style={{ ["--tab" as string]: storeTab === "beats" ? 0 : 1 } as CSSProperties}>
          <span className={s.tabInk} aria-hidden="true" />
          <button type="button" role="tab" aria-selected={storeTab === "beats"} onClick={() => setStoreTab("beats")}>Beat</button>
          <button type="button" role="tab" aria-selected={storeTab === "bundles"} onClick={() => setStoreTab("bundles")}>Pacchetti</button>
        </div>
        <div className={s.storeScreenEnd}>
          <button type="button" className={s.btnText} onClick={() => setIntro({ visit: Date.now(), full: true })} aria-label="Rivedi l’intro del Beat Store"><RotateCcw size={16} /><span className={s.hideXs}> Intro</span></button>
        </div>
      </div>
      <div className={s.storeScreenBody}>
        {storeTab === "beats" ? <BeatStore /> : (
          <div key="bundles" className={s.storeScroll} data-own-scroll>
            <Bundles />
            <footer className={s.footer}>
              <GenksSymbol size={40} />
              <p><strong>GENKS</strong> · Studio di registrazione, produzione e mix &amp; master</p>
              <p className={s.muted}>Via Quintina, Ponte San Giovanni, 06135 Perugia (PG) · <a href="mailto:assistenza@prodbygenks.com">assistenza@prodbygenks.com</a></p>
            </footer>
          </div>
        )}
      </div>
      {intro && storeTab === "beats" && <StoreIntro key={intro.visit} full={intro.full} onDone={() => setIntro(null)} />}
    </div>
  );
}
