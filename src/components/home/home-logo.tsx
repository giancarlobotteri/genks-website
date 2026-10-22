"use client";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useRef, useState } from "react";
import styles from "./service-home.module.css";
const WooferScene = dynamic(() => import("./woofer-scene"), { ssr: false });
export function HomeLogo() {
 const section = useRef<HTMLDivElement>(null);
 const progress = useRef(0);
 const [ready, setReady] = useState(false);
 const [unavailable, setUnavailable] = useState(false);
 return <div ref={section} className={styles.logoStage} aria-label="Modello 3D GENKS">
  <div className={`${styles.logoFallback} ${ready ? styles.logoReady : ""}`} aria-hidden="true"><Image src="/brand/genks-header.svg" width={280} height={170} alt="" /></div>
  {!unavailable && <WooferScene sectionRef={section} heroProgressRef={progress} paused={false} mode="showcase" onReady={() => setReady(true)} onUnavailable={() => {setReady(false);setUnavailable(true);}} />}
 </div>;
}
