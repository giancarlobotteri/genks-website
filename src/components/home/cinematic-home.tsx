"use client";

import { createContext, useContext, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { BrandIntro } from "./brand-intro";
import styles from "./cinematic-home.module.css";

const SceneActivation = createContext(true);
export function useHomeSceneActive() { return useContext(SceneActivation); }

export function CinematicHome({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [introComplete, setIntroComplete] = useState(false);
  const finishIntro = useCallback(() => setIntroComplete(true), []);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const animations = new Set<Animation>();
    const seen = new WeakSet<Element>();
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting || seen.has(entry.target)) return;
        seen.add(entry.target);
        if (reduced.matches) return;
        const animation = entry.target.animate([
          { opacity: .2, transform: "translate3d(0,45px,0)", filter: "blur(4px)" },
          { opacity: 1, transform: "translate3d(0,0,0)", filter: "blur(0)" },
        ], { duration: 1000, easing: "cubic-bezier(.16,1,.3,1)" });
        animations.add(animation);
        animation.onfinish = () => animations.delete(animation);
      });
    }, { threshold: .08 });
    const observe = () => root.querySelectorAll(".section-heading, .beat-card, .beat-row, .service-row, .purchase-guide article, .about-content").forEach(element => observer.observe(element));
    observe();
    const mutations = new MutationObserver(observe);
    mutations.observe(root, { childList: true, subtree: true });
    const onChange = () => {
      if (reduced.matches) animations.forEach(animation => animation.cancel());
    };
    reduced.addEventListener("change", onChange);
    return () => {
      observer.disconnect();
      mutations.disconnect();
      animations.forEach(animation => animation.cancel());
      reduced.removeEventListener("change", onChange);
    };
  }, []);

  return (
    <div className={styles.experience} ref={rootRef}>
      {!introComplete ? <BrandIntro onComplete={finishIntro} /> : null}
      <SceneActivation value={introComplete}>{children}</SceneActivation>
    </div>
  );
}
