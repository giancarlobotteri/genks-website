import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import s from "../styles/vs.module.css";
import { GenksWordmark } from "./brand.tsx";
import { prefersReducedMotion } from "./ui.tsx";

export type QuickLink = { label: string; go: () => void };

/** Short, skippable brand intro. No audio. Respects prefers-reduced-motion. */
export function Intro({ onDone, links }: { onDone: () => void; links: QuickLink[] }) {
  const [leaving, setLeaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const done = useRef(false);

  const finish = (after?: () => void) => {
    if (done.current) return;
    done.current = true;
    try { sessionStorage.setItem("genks:vs:intro", "1"); } catch { /* ignore */ }
    // run the shortcut once the page is scrollable again
    const end = () => { onDone(); if (after) requestAnimationFrame(() => requestAnimationFrame(after)); };
    if (prefersReducedMotion()) end();
    else { setLeaving(true); window.setTimeout(end, 650); }
  };

  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>("[data-skip]")?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") finish(); };
    // Never gate the scroll: the first wheel/swipe simply enters the studio.
    const onScrollIntent = () => finish();
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onScrollIntent, { passive: true });
    window.addEventListener("touchmove", onScrollIntent, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", onScrollIntent);
      window.removeEventListener("touchmove", onScrollIntent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={ref} className={s.intro} data-leaving={leaving || undefined} role="region" aria-label="Introduzione GENKS">
      <div className={s.introGlow} aria-hidden="true" />
      <div className={s.introLogo}>
        <GenksWordmark className={s.introWordmark} />
        <span className={s.introSweep} aria-hidden="true" />
      </div>
      <p className={s.introLine}>Virtual Studio · registrazione, mix &amp; master, beat</p>
      <div className={s.introActions}>
        <button type="button" className={s.btnPrimary} onClick={() => finish()}>Entra nello studio</button>
        <button type="button" data-skip className={s.btnGhost} onClick={() => finish()}>Salta intro</button>
      </div>
      <button type="button" className={s.introScroll} onClick={() => finish()} aria-label="Scorri verso il basso per entrare nello studio">
        <span className={s.introMouse} aria-hidden="true"><i /></span>
        <span>Scorri per entrare</span>
        <ChevronDown size={18} aria-hidden="true" className={s.introChevron} />
      </button>
      <nav className={s.introLinks} aria-label="Vai direttamente a">
        <span>Vai direttamente a</span>
        {links.map(l => <button key={l.label} type="button" onClick={() => finish(l.go)}>{l.label}</button>)}
      </nav>
    </div>
  );
}
