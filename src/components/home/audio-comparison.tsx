"use client";
import { useRef, useState } from "react";
import type { AudioComparison as Comparison } from "@/data/home-content";
import styles from "./service-home.module.css";
export function AudioComparison({ item }: { item: Comparison }) {
 const audio = useRef<HTMLAudioElement>(null);
 const generation = useRef(0);
 const [version, setVersion] = useState<"before" | "after">("before");
 const [error, setError] = useState(false);
 function switchVersion(next: "before" | "after") {
  const player = audio.current;
  if (!player || next === version) return;
  const position = player.currentTime;
  const resume = !player.paused;
  const current = ++generation.current;
  player.pause(); setVersion(next); setError(false);
  player.src = item[next];
  player.onloadedmetadata = () => {
   if (generation.current !== current) return;
   player.currentTime = Number.isFinite(player.duration) ? Math.min(position, Math.max(0, player.duration - 0.01)) : position;
   if (resume) void player.play().catch(() => {});
  };
  player.load();
 }
 return <article className={styles.proofCard}>
  <div role="group" aria-label={`Confronto ${item.title}`} className={styles.switcher}>{(["before", "after"] as const).map(value => <button type="button" key={value} aria-pressed={version === value} onClick={() => switchVersion(value)}>{value === "before" ? "Prima" : "Dopo"}</button>)}</div>
  <audio ref={audio} src={item.before} controls preload="none" aria-label={`${item.title} — ${version === "before" ? "Prima" : "Dopo"}`} onError={() => setError(true)} />
  {error && <p role="status">Audio non disponibile. Riprova tra poco.</p>}
  <h3>{item.title}</h3><p>{item.artist} · {item.genre}</p>
 </article>;
}
