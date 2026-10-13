"use client";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowDown, ArrowUpRight, Pause, Play } from "lucide-react";
import { useRef, useState } from "react";
import styles from "./cinematic-hero.module.css";

const WooferScene = dynamic(() => import("./woofer-scene"), { ssr: false });

export function CinematicHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);

  return (
    <section id="home" ref={sectionRef} className={styles.sequence} aria-labelledby="cinematic-title">
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
          <WooferScene sectionRef={sectionRef} paused={paused} onReady={() => setReady(true)} onUnavailable={() => setReady(false)} />
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
