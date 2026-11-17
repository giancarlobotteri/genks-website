import { useEffect, useState } from "react";
import { skipCue, useCue } from "../cinema.ts";
import s from "../styles/vs.module.css";

/** Letterbox, lower-third caption and timecode shown while the camera performs a cue. */
export function CinemaOverlay() {
  const { cue, leaving } = useCue();
  const [tc, setTc] = useState("00:00:00:00");

  useEffect(() => {
    if (!cue || leaving) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" || e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); skipCue(); } };
    // capture phase: the click must not reach the (hidden) dialog behind
    const onDown = (e: PointerEvent) => { e.preventDefault(); e.stopPropagation(); skipCue(); };
    window.addEventListener("keydown", onKey, true);
    const t = window.setTimeout(() => window.addEventListener("pointerdown", onDown, true), 250);
    const start = performance.now();
    let raf = 0;
    const loop = () => {
      const ms = performance.now() - start;
      const f = Math.floor((ms / 1000) * 25) % 25, sec = Math.floor(ms / 1000);
      setTc(`01:${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}:${String(f).padStart(2, "0")}`);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { window.removeEventListener("keydown", onKey, true); window.removeEventListener("pointerdown", onDown, true); window.clearTimeout(t); cancelAnimationFrame(raf); };
  }, [cue, leaving]);

  if (!cue) return null;
  return (
    <div className={s.cinema} data-leaving={leaving || undefined} key={cue.id} style={{ ["--cue-ms" as string]: `${cue.ms}ms` }} aria-live="polite">
      <div className={s.cinemaFlash} aria-hidden="true" />
      <div className={s.cinemaBarTop} aria-hidden="true">
        <span className={s.cinemaRec}><i /> REC</span>
        <span className={s.cinemaTc}>{tc}</span>
        <span className={s.cinemaCam}>CAM {String((cue.id % 4) + 1).padStart(2, "0")} · {cue.shot.toUpperCase()}</span>
      </div>
      <div className={s.cinemaFrame} aria-hidden="true"><i /><i /><i /><i /></div>
      <div className={s.cinemaCaption}>
        <p className={s.cinemaKicker}>{cue.kicker}</p>
        <p className={s.cinemaTitle}>
          {cue.title.split(" ").map((w, i) => <span key={i} style={{ ["--i" as string]: i }}>{w}&nbsp;</span>)}
        </p>
        {cue.sub && <p className={s.cinemaSub}>{cue.sub}</p>}
        <span className={s.cinemaProgress} aria-hidden="true" />
      </div>
      <div className={s.cinemaBarBottom} aria-hidden="true">
        <span>Tocca o premi Esc per continuare</span>
      </div>
    </div>
  );
}
