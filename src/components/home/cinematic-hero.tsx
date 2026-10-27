"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ArrowDown, ArrowUpRight, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { useHomeSceneActive } from "./cinematic-home";
import styles from "./cinematic-hero.module.css";

const WooferScene = dynamic(() => import("./woofer-scene"), { ssr: false });

export function CinematicHero({ serviceLanding = false, sideContent }: { serviceLanding?: boolean; sideContent?: ReactNode }) {
  const router = useRouter();
  const active = useHomeSceneActive();
  const sectionRef = useRef<HTMLElement>(null);
  const progressRef = useRef(0);
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);
  const catalogScroll = useRef<{ frame: number; progress: number; cancel: () => void } | null>(null);
  useEffect(() => () => catalogScroll.current?.cancel(), []);
  const goToCatalog = (event: MouseEvent<HTMLAnchorElement>, destination = "#catalog") => {
    if (destination.startsWith("/")) router.prefetch(destination);
    const catalog = document.getElementById("catalog") ?? document.getElementById("collection");
    if (!catalog || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    event.preventDefault();
    catalogScroll.current?.cancel();
    const from = window.scrollY;
    const to = Math.max(0, catalog.getBoundingClientRect().top + from);
    const started = performance.now();
    const controller = { frame: 0, progress: 0, cancel: () => {} };
    const cancel = () => {
      cancelAnimationFrame(controller.frame);
      window.removeEventListener("wheel", cancel);
      window.removeEventListener("touchstart", cancel);
      window.removeEventListener("keydown", cancel);
      if (catalogScroll.current === controller) catalogScroll.current = null;
    };
    controller.cancel = cancel;
    catalogScroll.current = controller;
    window.addEventListener("wheel", cancel, { passive: true });
    window.addEventListener("touchstart", cancel, { passive: true });
    window.addEventListener("keydown", cancel);
    const step = (now: number) => {
      const t = Math.min(1, (now - started) / (destination.startsWith("/") ? 4600 : 4900));
      const eased = t * t * (3 - 2 * t);
      controller.progress = eased;
      window.dispatchEvent(new Event("genks:hero-progress"));
      if (t < 1) controller.frame = requestAnimationFrame(step);
      else {
        // Let the final scene frame paint before changing route or moving focus.
        controller.frame = requestAnimationFrame(() => {
          cancel();
          if (destination.startsWith("/")) router.push(destination);
          else {
            window.scrollTo({ top: to, behavior: "instant" });
            history.replaceState(history.state, "", destination);
            catalog.tabIndex = -1;
            catalog.focus({ preventScroll: true });
          }
        });
      }
    };
    controller.frame = requestAnimationFrame(step);
  };

  useEffect(() => {
    const section = sectionRef.current;
    const stage = section?.firstElementChild as HTMLElement | null;
    if (!section || !stage) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const uiTargets = [
      [".genks-header", 0, 0, true], [".genks-menu-toggle", -180, 0, false],
      [".genks-header-logo", 0, -110, false], [".cart-rail", 380, 0, true],
      [".cart-rail-toggle", 110, 0, true], [".offers-rail", -380, 0, true], [".offers-toggle", -110, 0, true], [".cart-rail-backdrop", 0, 0, true],
      [".persistent-player", 0, 140, true], [".site-footer", 0, 140, true],
      ["[data-genks-assistant-launcher]", 0, 140, true],
    ].flatMap(([selector, x, y, fade]) => {
      const element = document.querySelector<HTMLElement>(String(selector));
      return element ? [{ element, x: Number(x), y: Number(y), fade: Boolean(fade) }] : [];
    });
    const originalStyles = uiTargets.map(({ element }) => ({ opacity: element.style.opacity, translate: element.style.translate }));
    let lastInterface = -1;
    let interfaceHidden = false;
    let target = 0;
    let current = progressRef.current;
    let interfaceProgress = 1;
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
      current = catalogScroll.current ? target : current + (target - current) * (1 - Math.exp(-delta * 14));
      if (Math.abs(current - target) < .0001) current = target;
      progressRef.current = current;
      const fade = smoothstep(.9, 1, current);
      const ui = 1 - smoothstep(.002, .16, current);
      const desiredInterface = Math.max(ui, smoothstep(.98, 1, current));
      interfaceProgress += (desiredInterface - interfaceProgress) * (1 - Math.exp(-delta * 5));
      if (Math.abs(interfaceProgress - desiredInterface) < .001) interfaceProgress = desiredInterface;
      const sceneUi = interfaceProgress;
      // Update only the animated elements, avoiding inherited CSS changes across the whole page each frame.
      const roundedInterface = Number(sceneUi.toFixed(4));
      if (roundedInterface !== lastInterface) {
        lastInterface = roundedInterface;
        for (const { element, x, y, fade: fadeElement } of uiTargets) {
          if (fadeElement) element.style.opacity = String(roundedInterface);
          if (x || y) element.style.translate = reduced.matches ? "none" : `${x * (1 - roundedInterface)}px ${y * (1 - roundedInterface)}px`;
        }
      }
      const hidden = sceneUi < .001;
      if (hidden !== interfaceHidden) {
        interfaceHidden = hidden;
        document.body.toggleAttribute("data-cinematic-ui-hidden", hidden);
      }
      const zoom = smoothstep(.56, .92, current);
      section.style.setProperty("--hero-opacity", String(1 - fade));
      section.style.setProperty("--hero-ui-opacity", String(ui));
      section.style.setProperty("--hero-ui-visibility", ui < .01 ? "hidden" : "visible");
      section.style.setProperty("--poster-zoom", String(Math.exp(zoom * Math.log(9))));
      section.style.setProperty("--scene-travel", String(current));
      stage.style.pointerEvents = fade > .8 ? "none" : "auto";
      section.style.pointerEvents = fade > .8 ? "none" : "auto";
      frame = current === target && interfaceProgress === desiredInterface ? 0 : requestAnimationFrame(paint);
    };
    const scroll = () => {
      target = reduced.matches || paused ? 0 : (catalogScroll.current?.progress ?? Math.min(1, Math.max(0, (window.scrollY - sectionTop) / travel)));
      if (!frame) { lastTime = 0; frame = requestAnimationFrame(paint); }
    };
    const measure = () => {
      sectionTop = section.getBoundingClientRect().top + window.scrollY;
      const catalog = document.getElementById("collection");
      const catalogStart = catalog ? catalog.getBoundingClientRect().top + window.scrollY - sectionTop : Infinity;
      // Finish the fade before the catalog, including short viewports where the stage has a minimum height.
      travel = Math.max(1, Math.min(section.offsetHeight - stage.offsetHeight, catalogStart));
      scroll();
    };
    const observer = new ResizeObserver(measure);
    observer.observe(section);
    observer.observe(stage);
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("genks:hero-progress", scroll);
    window.addEventListener("resize", measure, { passive: true });
    reduced.addEventListener("change", measure);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      uiTargets.forEach(({ element }, index) => {
        element.style.opacity = originalStyles[index].opacity;
        element.style.translate = originalStyles[index].translate;
      });
      document.body.removeAttribute("data-cinematic-ui-hidden");
      observer.disconnect();
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("genks:hero-progress", scroll);
      window.removeEventListener("resize", measure);
      reduced.removeEventListener("change", measure);
    };
  }, [paused]);

  return (
    <section id="home" ref={sectionRef} className={`${styles.sequence} ${paused ? styles.motionPaused : ""} ${serviceLanding ? styles.serviceLanding : ""}`} aria-labelledby="cinematic-title">
      <div className={styles.stage}>
        <div className={styles.halo} aria-hidden="true" />
        <div className={styles.atmosphere} aria-hidden="true">
          <div className={styles.currentA} />
          <div className={styles.currentB} />
          <div className={styles.currentC} />
        </div>

        <h1 id="cinematic-title" className="sr-only">{serviceLanding ? "GENKS — Mix, master e registrazione" : "GENKS — Beat e servizi musicali"}</h1>
        <div className={styles.visual}>
          <div className={`${styles.poster} ${ready ? styles.posterHidden : ""}`}>
            <Image src={serviceLanding ? "/brand/genks-header.svg" : "/brand/genks-logo.jpeg"} alt="" fill preload sizes="(max-width: 700px) 85vw, 500px" />
          </div>
          {active ? <WooferScene sectionRef={sectionRef} heroProgressRef={progressRef} paused={paused} wideLayout={serviceLanding}
            onReady={() => { setReady(true); window.dispatchEvent(new Event("genks:hero-settled")); }}
            onUnavailable={() => { setReady(false); window.dispatchEvent(new Event("genks:hero-settled")); }} /> : null}
        </div>

        {sideContent && <div className={styles.serviceDesk}>{sideContent}</div>}
        <div className={styles.content}>
          <div className={styles.actions}>
            {serviceLanding ? <>
            <Link className={styles.primary} href="/services" onClick={event => goToCatalog(event, "/services")}><span>Scegli un servizio</span><ArrowUpRight size={20} aria-hidden="true" /></Link>
            <Link className={styles.secondary} href="/services/recording" onClick={event => goToCatalog(event, "/services/recording")}><span>Prenota lo studio</span><ArrowUpRight size={20} aria-hidden="true" /></Link>
            </> : <>
            <Link className={styles.primary} href="/services" onClick={event => goToCatalog(event, "/services")}><span>Prenota un servizio<small>Registrazione, mix e master.</small></span><ArrowUpRight size={20} aria-hidden="true" /></Link>
            <a className={styles.secondary} href="#catalog" onClick={event => goToCatalog(event)}><span>Vai al catalogo<small>Ascolta i beat. Trova il tuo suono.</small></span><ArrowUpRight size={20} aria-hidden="true" /></a>
            </>}
          </div>
        </div>

        {!serviceLanding && <div className={styles.bottomline}>
          <a className={styles.scroll} href="#catalog" onClick={event => goToCatalog(event)}><ArrowDown size={14} aria-hidden="true" /> Scopri il tuo prossimo suono</a>
          <button type="button" className={styles.motion} disabled={!ready} aria-pressed={paused} onClick={() => setPaused(value => !value)}>
            {paused ? <Play size={12} aria-hidden="true" /> : <Pause size={12} aria-hidden="true" />}
            {paused ? "Riprendi animazione" : "Pausa animazione"}
          </button>
        </div>}
      </div>
    </section>
  );
}
