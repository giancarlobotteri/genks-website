"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Pause, Play } from "lucide-react";
import { useRef, useState } from "react";
import styles from "./sound-chapter.module.css";

const WooferScene = dynamic(() => import("./woofer-scene"), { ssr: false });

export function SoundChapter() {
  const sectionRef = useRef<HTMLElement>(null);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  return (
    <section ref={sectionRef} className={styles.chapter} aria-labelledby="sound-detail-title">
      <div className={styles.frame}>
        <div className={styles.copy}>
          <span className={styles.eyebrow}>DENTRO IL SUONO / GENKS</span>
          <h2 id="sound-detail-title">Ogni dettaglio.<br /><span>La tua identità.</span></h2>
          <p>Dal beat alla voce. Dalla prima idea al suono che ti rappresenta.</p>
          <Link href="#catalog">Trova il tuo beat <ArrowUpRight size={19} aria-hidden="true" /></Link>
        </div>
        <div className={styles.object}>
          <div className={`${styles.poster} ${ready ? styles.hidden : ""}`}>
            <Image src="/brand/genks-logo.jpeg" alt="" fill sizes="(max-width: 700px) 80vw, 500px" />
          </div>
          <WooferScene sectionRef={sectionRef} mode="exploded" paused={paused} onReady={() => setReady(true)} onUnavailable={() => setReady(false)} />
        </div>
        <div className={styles.footer}>
          <span>PRODUZIONE / REGISTRAZIONE / MIX / MASTER</span>
          <button type="button" disabled={!ready} aria-pressed={paused} onClick={() => setPaused(value => !value)}>
            {paused ? <Play size={12} aria-hidden="true" /> : <Pause size={12} aria-hidden="true" />}
            {paused ? "Riprendi animazione" : "Pausa animazione"}
          </button>
        </div>
      </div>
    </section>
  );
}
