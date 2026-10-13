"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "./brand-intro.module.css";

// Reveal the original chrome wordmark, preserving the lettering and blue reflections.
const letters = [
  { label: "G", start: 135, end: 420 },
  { label: "E", start: 420, end: 605 },
  { label: "N", start: 605, end: 768 },
  { label: "K", start: 768, end: 930 },
  { label: "S", start: 930, end: 1185 },
];

type Props = { onComplete: () => void };

export function BrandIntro({ onComplete }: Props) {
  const id = useId().replace(/:/g, "");
  const skipRef = useRef<HTMLButtonElement>(null);
  const completeRef = useRef(onComplete);
  const [phase, setPhase] = useState<"loading" | "letters" | "opening">("loading");
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
      later(finish, reducedMotion.matches ? 180 : 850);
    };
    openRef.current = open;
    const start = () => {
      if (started || disposed || opening) return;
      started = true;
      setPhase("letters");
      // 5 letter reveals, a brief hold, then the two panels open onto the page.
      later(open, reducedMotion.matches ? 180 : 2250);
    };
    const image = new window.Image();
    image.onload = start;
    image.onerror = open;
    image.src = "/brand/genks-logo.jpeg";
    if (image.complete && image.naturalWidth) start();
    later(open, 5000);
    const onMotionChange = () => { if (reducedMotion.matches) open(); };
    reducedMotion.addEventListener("change", onMotionChange);

    return () => {
      disposed = true;
      timers.forEach(clearTimeout);
      image.onload = null;
      image.onerror = null;
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
        <div className={styles.identity} data-started={phase !== "loading"}>
          <svg className={styles.wordmark} viewBox="135 375 1050 490" role="img" aria-label="GENKS" data-protected-visual>
            <defs>
              <clipPath id={`${id}-wordmark`}>
                <path d="M650 390 C480 385 270 420 185 500 L140 575 L135 690 L205 870 L320 770 C500 795 650 800 770 820 L805 770 C965 795 1075 780 1130 760 L1120 870 L1190 680 L1185 570 L1120 470 C950 390 800 385 650 390Z" />
              </clipPath>
              {letters.map(letter => <clipPath key={letter.label} id={`${id}-${letter.label}`}><rect x={letter.start} y="375" width={letter.end - letter.start} height="490" /></clipPath>)}
            </defs>
            <g clipPath={`url(#${id}-wordmark)`}>
              {letters.map((letter, index) => (
                <g key={letter.label} clipPath={`url(#${id}-${letter.label})`}>
                  <image
                    className={styles.letter}
                    href="/brand/genks-logo.jpeg"
                    x="0" y="0" width="1320" height="1243"
                    style={{ animationDelay: `${index * 340}ms` }}
                  />
                </g>
              ))}
            </g>
          </svg>
        </div>
        <button ref={skipRef} type="button" className={styles.skip} onClick={() => openRef.current()}>Salta introduzione</button>
      </div>
    </>
  );
}
