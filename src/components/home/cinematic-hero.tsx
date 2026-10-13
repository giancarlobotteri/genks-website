"use client";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowDown, ArrowUpRight, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import styles from "./cinematic-hero.module.css";

const WooferScene = dynamic(() => import("./woofer-scene"), { ssr: false });

export function CinematicHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const progressRef = useRef(0);
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    const stage = section?.firstElementChild as HTMLElement | null;
    if (!section || !stage) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let target = 0;
    let current = progressRef.current;
    let frame = 0;
    let lastTime = 0;
    let travel = 1;
    let sectionTop = 0;
    const smoothstep = (from: number, to: number, value: number) => {
      const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
      return t * t * (3 - 2 * t);
    };
    const paint = (time: number) => {
      const delta = lastTime ? Math.min((time - lastTime) / 1000, .05) : 1 / 60;
      lastTime = time;
      current += (target - current) * (1 - Math.exp(-delta * 14));
      if (Math.abs(current - target) < .0001) current = target;
      progressRef.current = current;
      const fade = smoothstep(.78, .96, current);
      const ui = 1 - smoothstep(.035, .25, current);
      const zoom = smoothstep(0, .78, current);
      section.style.setProperty("--hero-opacity", String(1 - fade));
      section.style.setProperty("--hero-ui-opacity", String(ui));
      section.style.setProperty("--hero-ui-visibility", current > .28 ? "hidden" : "visible");
      section.style.setProperty("--poster-zoom", String(Math.exp(zoom * Math.log(9))));
      stage.style.pointerEvents = fade > .8 ? "none" : "auto";
      section.style.pointerEvents = fade > .8 ? "none" : "auto";
      frame = current === target ? 0 : requestAnimationFrame(paint);
    };
    const scroll = () => {
      target = reduced.matches || paused ? 0 : Math.min(1, Math.max(0, (window.scrollY - sectionTop) / travel));
      if (!frame) { lastTime = 0; frame = requestAnimationFrame(paint); }
    };
    const measure = () => {
      sectionTop = section.getBoundingClientRect().top + window.scrollY;
      travel = Math.max(1, section.offsetHeight - stage.offsetHeight);
      scroll();
    };
    const observer = new ResizeObserver(measure);
    observer.observe(section);
    observer.observe(stage);
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("resize", measure, { passive: true });
    reduced.addEventListener("change", measure);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("resize", measure);
      reduced.removeEventListener("change", measure);
    };
  }, [paused]);

  return (
    <section id="home" ref={sectionRef} className={`${styles.sequence} ${paused ? styles.motionPaused : ""}`} aria-labelledby="cinematic-title">
      <div className={styles.stage}>
        <div className={styles.halo} aria-hidden="true" />
        <div className={styles.topline}>
          <span className={styles.signature}><i aria-hidden="true" /> GENKS / SUONO INDIPENDENTE</span>
          <span className={styles.preview}>PRODUZIONE MUSICALE</span>
        </div>

        <h1 id="cinematic-title" className="sr-only">GENKS — Il suono prende forma.</h1>
        <div className={styles.visual}>
          <div className={`${styles.poster} ${ready ? styles.posterHidden : ""}`}>
            <Image src="/brand/genks-logo.jpeg" alt="" fill preload sizes="(max-width: 700px) 85vw, 500px" />
          </div>
          <WooferScene sectionRef={sectionRef} heroProgressRef={progressRef} paused={paused}
            onReady={() => { setReady(true); window.dispatchEvent(new Event("genks:hero-settled")); }}
            onUnavailable={() => { setReady(false); window.dispatchEvent(new Event("genks:hero-settled")); }} />
        </div>

        <div className={styles.caption} aria-hidden="true">
          <span>SUONO</span><span>VISIONE</span><span>ISTINTO</span>
        </div>
        <div className={styles.content}>
          <p className={styles.claim}>Il suono prende forma.</p>
          <div className={styles.actions}>
            <Link className={styles.primary} href="#catalog">Esplora i beat <ArrowUpRight size={19} aria-hidden="true" /></Link>
            <Link className={styles.secondary} href="/services">Prenota una sessione <ArrowUpRight size={17} aria-hidden="true" /></Link>
          </div>
        </div>

        <div className={styles.bottomline}>
          <a className={styles.scroll} href="#catalog"><ArrowDown size={14} aria-hidden="true" /> Scopri il tuo prossimo suono</a>
          <button type="button" className={styles.motion} disabled={!ready} aria-pressed={paused} onClick={() => setPaused(value => !value)}>
            {paused ? <Play size={12} aria-hidden="true" /> : <Pause size={12} aria-hidden="true" />}
            {paused ? "Riprendi animazione" : "Pausa animazione"}
          </button>
        </div>
      </div>
    </section>
  );
}
