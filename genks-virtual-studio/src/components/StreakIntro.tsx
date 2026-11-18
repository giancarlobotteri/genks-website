import { useEffect, useRef } from "react";
import s from "../styles/vs.module.css";
import { GenksSymbol } from "./brand.tsx";

/**
 * Opening titles: comets of blue light fly in from the dark, converge and draw a ring; the ring is the
 * outline of the GENKS symbol, which then appears exactly as designed (original vector, never redrawn).
 * Then the picture passes through it in a burst of light, into the studio. Short (~2.4 s), not skippable.
 */
const N = 7;
const DUR = 2.4; // seconds

export function StreakIntro({ onDone, onReveal }: { onDone: () => void; onReveal?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const symRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(onDone);
  const revealRef = useRef(onReveal);
  useEffect(() => { doneRef.current = onDone; revealRef.current = onReveal; });

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
      return { th, ts: 0.04 + k * 0.035, ta: 0.6 + k * 0.03, trail: [] as { x: number; y: number }[], hue: k % 3 === 0 ? "#ffffff" : k % 2 ? "#9CBFFF" : "#4C83FF" };
    });
    const sweep = (2 * Math.PI) / N, sweepT = 0.36;
    const rays = Array.from({ length: 56 }, (_, k) => ({ a: (k / 56) * Math.PI * 2 + (k % 3) * 0.02, sp: 0.7 + ((k * 37) % 10) / 10, w: 0.6 + ((k * 13) % 7) / 4 }));
    const ease = (u: number) => 1 - Math.pow(1 - u, 3);
    let raf = 0, finished = false, revealed = false;
    const t0 = performance.now();
    const finish = () => { if (finished) return; finished = true; doneRef.current(); };
    const frame = (now: number) => {
      const t = (now - t0) / 1000;
      if (t >= DUR) { finish(); return; }
      // the picture underneath starts moving as the overlay begins to fade
      if (!revealed && t >= 1.85) { revealed = true; revealRef.current?.(); }
      raf = requestAnimationFrame(frame);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      const far = Math.max(w, h) * 0.95;
      const fadeComets = 1 - Math.min(1, Math.max(0, (t - 1.25) / 0.3));
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
        if (c.trail.length > 30) c.trail.shift();
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
      const flash = Math.max(0, 1 - Math.abs(t - 1.12) / 0.22);
      if (flash > 0) {
        const g = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.6);
        g.addColorStop(0, `rgba(76,131,255,${0.5 * flash})`); g.addColorStop(1, "rgba(76,131,255,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.6, 0, Math.PI * 2); ctx.fill();
      }
      // passing through the symbol: a burst of light rays, like a jump at speed (motion blur)
      const burst = Math.max(0, (t - 1.62) / 0.7);
      if (burst > 0 && burst < 1) {
        const fade = Math.sin(Math.PI * burst);
        for (const r of rays) {
          const r0 = R * (0.9 + burst * 3.2 * r.sp), r1 = r0 + R * (0.4 + burst * 2.6 * r.sp);
          const gx = ctx.createLinearGradient(cx + Math.cos(r.a) * r0, cy + Math.sin(r.a) * r0, cx + Math.cos(r.a) * r1, cy + Math.sin(r.a) * r1);
          gx.addColorStop(0, "rgba(156,191,255,0)"); gx.addColorStop(1, `rgba(156,191,255,${0.75 * fade})`);
          ctx.strokeStyle = gx; ctx.lineWidth = r.w * (1 + burst * 2);
          ctx.beginPath(); ctx.moveTo(cx + Math.cos(r.a) * r0, cy + Math.sin(r.a) * r0); ctx.lineTo(cx + Math.cos(r.a) * r1, cy + Math.sin(r.a) * r1); ctx.stroke();
        }
      }
      ctx.globalCompositeOperation = "source-over";
      // the symbol appears inside the ring, then the camera passes through it
      const sIn = Math.min(1, Math.max(0, (t - 1.02) / 0.32));
      const sOut = Math.min(1, Math.max(0, (t - 1.72) / 0.6));
      sym.style.opacity = String(ease(sIn) * (1 - sOut));
      sym.style.transform = `scale(${(0.9 + 0.1 * ease(sIn)) * (1 + 1.4 * sOut * sOut)})`;
      sym.style.filter = `blur(${(sOut * 10).toFixed(1)}px) drop-shadow(0 0 ${(18 + 30 * flash).toFixed(0)}px rgba(76,131,255,0.75))`;
      root.style.setProperty("--fade", String(1 - Math.min(1, Math.max(0, (t - 1.85) / 0.55))));
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", size);
    };
  }, []);

  return (
    <div ref={rootRef} className={s.streakIntro} aria-hidden="true" data-streak-intro>
      <canvas ref={canvasRef} />
      <div ref={symRef} className={s.streakSymbol}><GenksSymbol size={512} /></div>
    </div>
  );
}
