"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import styles from "./brand-intro.module.css";

type Props = { onComplete: () => void };

export function BrandIntro({ onComplete }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const completeRef = useRef(onComplete);
  const [phase, setPhase] = useState<"letters" | "opening">("letters");
  const finishRef = useRef<() => void>(() => {});

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
    const overlay = overlayRef.current;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let opening = false;
    let started = false;
    let disposed = false;
    let finished = false;
    document.body.style.overflow = "hidden";
    overlay?.focus({ preventScroll: true });

    const later = (callback: () => void, delay: number) => {
      const timer = setTimeout(() => { timers.delete(timer); callback(); }, delay);
      timers.add(timer);
    };
    const finish = () => {
      if (disposed || finished || !opening) return;
      finished = true;
      try { sessionStorage.setItem("genks:intro-document", documentKey); } catch { /* Optional storage. */ }
      completeRef.current();
    };
    finishRef.current = finish;
    const open = () => {
      if (opening || disposed) return;
      opening = true;
      setPhase("opening");
      // The transition event completes the handoff; this timeout covers interrupted or missing events.
      later(finish, reducedMotion.matches ? 500 : 1800);
    };
    const onSceneReady = () => {
      if (started || disposed) return;
      started = true;
      later(open, reducedMotion.matches ? 180 : Math.max(0, 2100 - (performance.now() - introStarted)));
    };
    const introStarted = performance.now();
    window.addEventListener("genks:hero-settled", onSceneReady);
    later(open, 4200);
    const onMotionChange = () => { if (reducedMotion.matches) open(); };
    reducedMotion.addEventListener("change", onMotionChange);

    return () => {
      disposed = true;
      timers.forEach(clearTimeout);
      window.removeEventListener("genks:hero-settled", onSceneReady);
      reducedMotion.removeEventListener("change", onMotionChange);
      document.body.style.overflow = previousOverflow;
      if (document.activeElement === overlay) {
        (previousFocus && previousFocus !== document.body ? previousFocus : document.getElementById("main-content"))?.focus({ preventScroll: true });
      }
    };
  }, []);

  return (
    <>
      <noscript><style>{".genks-brand-intro{display:none!important}"}</style></noscript>
      <div
        className={`genks-brand-intro ${styles.overlay} ${phase === "opening" ? styles.opening : ""}`}
        ref={overlayRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Introduzione GENKS"
        onTransitionEnd={event => {
          if (event.target === event.currentTarget && event.propertyName === "opacity") finishRef.current();
        }}
        onKeyDown={event => {
          if (event.key === "Tab") { event.preventDefault(); overlayRef.current?.focus(); }
        }}
      >
        <div className={styles.leftPanel} aria-hidden="true" />
        <div className={styles.rightPanel} aria-hidden="true" />
        <div className={styles.identity}>
          <Image className={styles.wordmark} src="/brand/genks-logo.jpeg" alt="GENKS" width={1320} height={1243} quality={85} priority sizes="(max-width:700px) 88vw, 650px" />
        </div>
        <div className={styles.pulse} aria-hidden="true" />
      </div>
    </>
  );
}
