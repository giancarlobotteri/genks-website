import { useEffect, useRef } from "react";
import s from "../styles/vs.module.css";
import { GenksSymbol } from "./brand.tsx";

/**
 * Opening titles: comets of blue light fly in from the dark, converge and draw a ring; the ring is the
 * outline of the GENKS symbol, which then appears exactly as designed (original vector, never redrawn).
 * Then the picture passes through the symbol into the studio. Click, tap or any key skips it.
 */
const N = 7;
const DUR = 3.7; // seconds

export function StreakIntro({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const symRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(onDone);
  useEffect(() => { doneRef.current = onDone; });

  useEffect(() => {
    const canvas = canvasRef.current!, root = rootRef.current!, sym = symRef.current!;
    const ctx = canvas.getContext("2d")!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let w = 1, h = 1, R = 1, cx = 0, cy = 0;
    const size = () => {
      w = root.clientWidth; h = root.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      R = Math.min(w, h) * 0.16; cx = w / 2; cy = h * 0.47;
      sym.style.width = sym.style.height = `${R * 2}px`;
      sym.style.left = `${cx - R}px`; sym.style.top = `${cy - R}px`;
    };
    size();
    window.addEventListener("resize", size);
    const comets = Array.from({ length: N }, (_, k) => {
      const th = -Math.PI / 2 + (k * 2 * Math.PI) / N;
      return { th, ts: 0.12 + k * 0.07, ta: 1.15 + k * 0.05, trail: [] as { x: number; y: number }[], hue: k % 3 === 0 ? "#ffffff" : k % 2 ? "#9CBFFF" : "#4C83FF" };
    });
    const sweep = (2 * Math.PI) / N, sweepT = 0.62;
    const ease = (u: number) => 1 - Math.pow(1 - u, 3);
    let raf = 0, finished = false;
    const t0 = performance.now();
    const finish = () => { if (finished) return; finished = true; doneRef.current(); };
    const frame = (now: number) => {
      const t = (now - t0) / 1000;
      if (t >= DUR) { finish(); return; }
      raf = requestAnimationFrame(frame);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      const far = Math.max(w, h) * 0.95;
      const fadeComets = 1 - Math.min(1, Math.max(0, (t - 2.15) / 0.5));
      for (const c of comets) {
        let x: number, y: number;
        if (t < c.ts) continue;
        if (t < c.ta) {
          // quadratic path from far away, curling in towards its point on the ring
          const u = ease((t - c.ts) / (c.ta - c.ts));
          const a0 = c.th + 1.05, a1 = c.th + 0.5;
          const sx = cx + Math.cos(a0) * far, sy = cy + Math.sin(a0) * far;
          const px = cx + Math.cos(a1) * R * 2.7, py = cy + Math.sin(a1) * R * 2.7;
          const ex = cx + Math.cos(c.th) * R, ey = cy + Math.sin(c.th) * R;
          x = (1 - u) * (1 - u) * sx + 2 * (1 - u) * u * px + u * u * ex;
          y = (1 - u) * (1 - u) * sy + 2 * (1 - u) * u * py + u * u * ey;
        } else {
          // on the ring: each comet draws its own arc, together they close the circle
          const u = Math.min(1, (t - c.ta) / sweepT);
          const a = c.th + sweep * ease(u);
          x = cx + Math.cos(a) * R; y = cy + Math.sin(a) * R;
          ctx.strokeStyle = `rgba(110,160,255,${0.85 * fadeComets})`;
          ctx.lineWidth = Math.max(2, R * 0.035);
          ctx.beginPath(); ctx.arc(cx, cy, R, c.th, a); ctx.stroke();
        }
        c.trail.push({ x, y });
        if (c.trail.length > 22) c.trail.shift();
        // trail: thinner and fainter towards the tail
        for (let k = 1; k < c.trail.length; k++) {
          const q = k / c.trail.length;
          ctx.strokeStyle = `rgba(120,165,255,${0.55 * q * fadeComets})`;
          ctx.lineWidth = 0.5 + q * 3.2;
          ctx.beginPath(); ctx.moveTo(c.trail[k - 1].x, c.trail[k - 1].y); ctx.lineTo(c.trail[k].x, c.trail[k].y); ctx.stroke();
        }
        const g = ctx.createRadialGradient(x, y, 0, x, y, 18);
        g.addColorStop(0, c.hue); g.addColorStop(0.25, "rgba(76,131,255,0.55)"); g.addColorStop(1, "rgba(76,131,255,0)");
        ctx.globalAlpha = fadeComets;
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
      // the ring flashes when it closes
      const flash = Math.max(0, 1 - Math.abs(t - 2.0) / 0.35);
      if (flash > 0) {
        const g = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.6);
        g.addColorStop(0, `rgba(76,131,255,${0.5 * flash})`); g.addColorStop(1, "rgba(76,131,255,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      // the symbol appears inside the ring, then the camera passes through it
      const sIn = Math.min(1, Math.max(0, (t - 1.9) / 0.6));
      const sOut = Math.min(1, Math.max(0, (t - 3.0) / 0.7));
      sym.style.opacity = String(ease(sIn) * (1 - sOut));
      sym.style.transform = `scale(${(0.9 + 0.1 * ease(sIn)) * (1 + 1.4 * sOut * sOut)})`;
      sym.style.filter = `blur(${(sOut * 10).toFixed(1)}px) drop-shadow(0 0 ${(18 + 30 * flash).toFixed(0)}px rgba(76,131,255,0.75))`;
      root.style.setProperty("--fade", String(1 - Math.min(1, Math.max(0, (t - 3.05) / 0.6))));
    };
    raf = requestAnimationFrame(frame);
    const skip = () => { cancelAnimationFrame(raf); finish(); };
    root.addEventListener("pointerup", skip);
    window.addEventListener("keydown", skip);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", size);
      root.removeEventListener("pointerup", skip);
      window.removeEventListener("keydown", skip);
    };
  }, []);

  return (
    <div ref={rootRef} className={s.streakIntro} aria-hidden="true" data-streak-intro>
      <canvas ref={canvasRef} />
      <div ref={symRef} className={s.streakSymbol}><GenksSymbol size={512} /></div>
    </div>
  );
}
