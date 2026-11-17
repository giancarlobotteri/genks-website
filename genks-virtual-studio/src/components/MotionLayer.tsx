import { useEffect, useRef } from "react";
import s from "../styles/vs.module.css";
import { prefersReducedMotion } from "./ui.tsx";

/**
 * Page-wide motion that does not belong to a single component:
 * scroll reveals with stagger, 3D tilt + glare on cards, a cursor light and a scroll progress line.
 */
export function MotionLayer() {
  const glow = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const sel = [s.beatCard, s.bundleCard, s.sectionHead, s.customIntro, s.customForm, s.storeTools].filter(Boolean).map(c => `.${c}`).join(",") + `, .${s.steps} > li`;
    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) { (e.target as HTMLElement).dataset.reveal = "in"; io.unobserve(e.target); }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    const tag = () => {
      const groups = new Map<Element | null, number>();
      document.querySelectorAll<HTMLElement>(sel).forEach(el => {
        if (el.dataset.reveal) return;
        const i = groups.get(el.parentElement) ?? 0; groups.set(el.parentElement, i + 1);
        el.dataset.reveal = "out"; el.style.setProperty("--ri", String(i % 8));
        io.observe(el);
      });
    };
    tag();
    const mo = new MutationObserver(tag);
    mo.observe(document.querySelector("main") ?? document.body, { childList: true, subtree: true });

    // tilt + glare on cards (mouse only)
    const tiltSel = `.${s.beatCard}, .${s.bundleCard}`;
    let tilted: HTMLElement | null = null;
    const onMove = (e: PointerEvent) => {
      if (glow.current) glow.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      if (e.pointerType !== "mouse") return;
      const card = (e.target as Element).closest?.(tiltSel) as HTMLElement | null;
      if (tilted && tilted !== card) { tilted.style.removeProperty("--rx"); tilted.style.removeProperty("--ry"); tilted.removeAttribute("data-tilt"); }
      tilted = card;
      if (!card) return;
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      card.dataset.tilt = "on";
      card.style.setProperty("--rx", `${(0.5 - y) * 9}deg`);
      card.style.setProperty("--ry", `${(x - 0.5) * 11}deg`);
      card.style.setProperty("--gx", `${x * 100}%`);
      card.style.setProperty("--gy", `${y * 100}%`);
    };
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.current?.style.setProperty("transform", `scaleX(${max > 0 ? window.scrollY / max : 0})`);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => { io.disconnect(); mo.disconnect(); window.removeEventListener("pointermove", onMove); window.removeEventListener("scroll", onScroll); };
  }, []);

  return (
    <>
      <div ref={bar} className={s.scrollBar} aria-hidden="true" />
      <div ref={glow} className={s.cursorGlow} aria-hidden="true" />
    </>
  );
}
