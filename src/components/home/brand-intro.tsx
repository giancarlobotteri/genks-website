"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { genksLetters } from "@/data/genks-lettering";
import styles from "./brand-intro.module.css";

type Props = { onComplete: () => void };

export function BrandIntro({ onComplete }: Props) {
  const id = useId().replace(/:/g, "");
  const skipRef = useRef<HTMLButtonElement>(null);
  const completeRef = useRef(onComplete);
  const [phase, setPhase] = useState<"letters" | "opening">("letters");
  const openRef = useRef<() => void>(() => {});

  useEffect(() => { completeRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    const documentKey = String(performance.timeOrigin);
    try {
      if (sessionStorage.getItem("genks:intro-document") === documentKey) {
        completeRef.current();
        return;
      }
    } catch { /* The introduction works when browser storage is unavailable. */ }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const skipButton = skipRef.current;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let opening = false;
    let started = false;
    let disposed = false;
    document.body.style.overflow = "hidden";
    skipButton?.focus({ preventScroll: true });

    const later = (callback: () => void, delay: number) => {
      const timer = setTimeout(() => { timers.delete(timer); callback(); }, delay);
      timers.add(timer);
    };
    const finish = () => {
      if (disposed) return;
      try { sessionStorage.setItem("genks:intro-document", documentKey); } catch { /* Optional storage. */ }
      completeRef.current();
    };
    const open = () => {
      if (opening || disposed) return;
      opening = true;
      setPhase("opening");
      later(finish, reducedMotion.matches ? 180 : 800);
    };
    openRef.current = open;
    const onSceneReady = () => {
      if (started || disposed) return;
      started = true;
      later(open, reducedMotion.matches ? 180 : Math.max(0, 2100 - (performance.now() - introStarted)));
    };
    const introStarted = performance.now();
    window.addEventListener("genks:hero-settled", onSceneReady);
    later(open, 6500);
    const onMotionChange = () => { if (reducedMotion.matches) open(); };
    reducedMotion.addEventListener("change", onMotionChange);

    return () => {
      disposed = true;
      timers.forEach(clearTimeout);
      window.removeEventListener("genks:hero-settled", onSceneReady);
      reducedMotion.removeEventListener("change", onMotionChange);
      document.body.style.overflow = previousOverflow;
      if (document.activeElement === skipButton) {
        (previousFocus && previousFocus !== document.body ? previousFocus : document.getElementById("main-content"))?.focus({ preventScroll: true });
      }
    };
  }, []);

  return (
    <>
      <noscript><style>{".genks-brand-intro{display:none!important}"}</style></noscript>
      <div
        className={`genks-brand-intro ${styles.overlay} ${phase === "opening" ? styles.opening : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Introduzione GENKS"
        onKeyDown={event => {
          if (event.key === "Escape") openRef.current();
          if (event.key === "Tab") { event.preventDefault(); skipRef.current?.focus(); }
        }}
      >
        <div className={styles.leftPanel} aria-hidden="true" />
        <div className={styles.rightPanel} aria-hidden="true" />
        <div className={styles.identity}>
          <svg className={styles.wordmark} viewBox="0 0 1050 490" role="img" aria-label="GENKS" data-protected-visual>
            <defs>
              <linearGradient id={`${id}-chrome`} gradientUnits="userSpaceOnUse" x1="110" y1="20" x2="150" y2="455">
                <stop offset="0" stopColor="#80b8ff" />
                <stop offset=".18" stopColor="#f9fcff" />
                <stop offset=".32" stopColor="#6584ad" />
                <stop offset=".47" stopColor="#f0f5ff" />
                <stop offset=".62" stopColor="#185ece" />
                <stop offset=".76" stopColor="#b9d3ff" />
                <stop offset="1" stopColor="#90baff" />
              </linearGradient>
            </defs>
              {genksLetters.map((letter, index) => (
                <g className={styles.glyph} key={letter.label} style={{ "--letter-index": index } as CSSProperties}>
                  <path className={styles.glyphPath} d={letter.path} pathLength="1" fill={`url(#${id}-chrome)`} fillRule="evenodd" stroke="#619dff" strokeWidth="1.1" strokeLinejoin="round" />
                </g>
              ))}
          </svg>
        </div>
        <button ref={skipRef} type="button" className={styles.skip} onClick={() => openRef.current()}>Salta introduzione</button>
      </div>
    </>
  );
}
