import { useEffect, useRef } from "react";
import { publicBeats } from "../lib/catalog.ts";
import { rng } from "../lib/music.ts";
import { clamp01, ease } from "../scene/camera-path.ts";
import { useStudio } from "../store.tsx";
import s from "../styles/vs.module.css";
import { prefersReducedMotion } from "./ui.tsx";

const PER = 12;

/**
 * The mixer's waveform expands to full screen and its bars regroup into the beat covers:
 * a scroll-controlled, skippable transition from the studio to the Beat Store.
 */
export function WaveBridge() {
  const { content } = useStudio();
  const ref = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const beats = publicBeats(content.beats).slice(0, 6);
  const titles = beats.map(b => b.title).join("|");

  useEffect(() => {
    const section = ref.current!, canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const reduced = prefersReducedMotion();
    const n = Math.max(1, beats.length);
    const heights = beats.map(b => { const r = rng(b.seed * 7 + 3); return Array.from({ length: PER }, (_, i) => 0.25 + Math.abs(Math.sin(i * 0.55 + b.seed)) * 0.5 + r() * 0.25); });
    let raf = 0, visible = false, w = 0, h = 0, dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { rootMargin: "200px" }); io.observe(section);

    const rr = (x: number, y: number, ww: number, hh: number, r: number) => { ctx.beginPath(); ctx.roundRect(x, y, ww, hh, r); };

    const draw = (time: number) => {
      raf = requestAnimationFrame(draw);
      if (!visible) return;
      const rect = section.getBoundingClientRect();
      const q = clamp01(-rect.top / Math.max(1, rect.height - window.innerHeight));
      const t = reduced ? 0 : time / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#060B17"; ctx.fillRect(0, 0, w, h);
      // phases
      const expand = ease(clamp01(q / 0.3));
      const morph = clamp01((q - 0.28) / 0.47);
      const frames = clamp01((q - 0.62) / 0.25);
      // card grid
      const cols = w < 640 ? 2 : 3, rows = Math.ceil(n / cols);
      const gap = w < 640 ? 12 : 22;
      const gw = Math.min(w - 32, 1080), gh = Math.min(h * 0.6, rows * 300);
      const cw = (gw - gap * (cols - 1)) / cols, ch = (gh - gap * (rows - 1)) / rows;
      const gx = (w - gw) / 2, gy = h * 0.27;
      // waveform layout (display → full screen)
      const ww = (0.32 + 0.6 * expand) * w, wh = (0.12 + 0.42 * expand) * h;
      const wx = (w - ww) / 2, wy = h / 2;
      const total = n * PER, bw = ww / total;
      const glow = 0.5 + 0.5 * expand;
      for (let c = 0; c < n; c++) {
        const col = c % cols, row = Math.floor(c / cols);
        const cx = gx + col * (cw + gap), cy = gy + row * (ch + gap);
        const cover = Math.min(cw, ch * 0.72);
        if (frames > 0) {
          ctx.shadowBlur = 0;
          ctx.globalAlpha = frames;
          ctx.fillStyle = "#0b1428"; rr(cx, cy, cw, ch, 14); ctx.fill();
          ctx.strokeStyle = "rgba(156,191,255,.28)"; ctx.lineWidth = 1; ctx.stroke();
          ctx.fillStyle = "#EEF3FF"; ctx.font = `600 ${Math.max(12, Math.min(18, cw / 12))}px "Space Grotesk", sans-serif`;
          ctx.fillText(beats[c]?.title ?? "", cx + 14, cy + cover + Math.min(30, (ch - cover) * 0.55));
          ctx.globalAlpha = 1;
        }
        for (let j = 0; j < PER; j++) {
          const i = c * PER + j;
          const stagger = clamp01(morph * 1.6 - (i / total) * 0.6);
          const m = ease(stagger);
          const amp = heights[c][j] * (reduced ? 1 : 0.75 + 0.25 * Math.sin(t * 3 + i * 0.4));
          // from: waveform bar
          const fx = wx + i * bw, fh = Math.max(2, amp * wh), fy = wy - fh / 2, fW = Math.max(1, bw * 0.62);
          // to: bar inside the cover
          const pad = cw * 0.08;
          const tx = cx + pad + j * ((cw - pad * 2) / PER), tW = (cw - pad * 2) / PER * 0.5;
          const th = heights[c][j] * cover * 0.6, ty = cy + cover * 0.52 - th / 2;
          const x = fx + (tx - fx) * m, y = fy + (ty - fy) * m, bwid = fW + (tW - fW) * m, bh = fh + (th - fh) * m;
          ctx.fillStyle = j % 5 === 0 ? "#9CBFFF" : "#4C83FF";
          ctx.shadowColor = "#4C83FF"; ctx.shadowBlur = 14 * glow * (1 - m * 0.7);
          rr(x, y, bwid, bh, Math.min(bwid / 2, 3)); ctx.fill();
        }
      }
      ctx.shadowBlur = 0;
      if (titleRef.current) {
        titleRef.current.style.opacity = String(clamp01((q - 0.8) / 0.15));
      }
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titles]);

  return (
    <section id="onda" ref={ref} className={s.bridge} aria-label="Transizione dal mixer al Beat Store">
      <div className={s.bridgeSticky}>
        <canvas ref={canvasRef} className={s.bridgeCanvas} aria-hidden="true" />
        <div ref={titleRef} className={s.bridgeTitle}>
          <p className={s.kicker}>05 · Beat Store</p>
          <p className={s.bridgeHeadline}>Ogni onda è un beat.</p>
        </div>
        <button type="button" className={`${s.btnGhost} ${s.bridgeSkip}`} onClick={() => document.getElementById("beat-store")?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth" })}>
          Salta al catalogo
        </button>
      </div>
    </section>
  );
}
