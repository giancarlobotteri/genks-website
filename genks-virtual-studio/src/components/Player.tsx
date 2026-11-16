import { Loader2, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { usePlayer, useProgress, useStudio } from "../store.tsx";
import s from "../styles/vs.module.css";
import { BeatCover, DemoBadge } from "./ui.tsx";

const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

/** Persistent player: one audio element for the whole app, never autoplays. */
export function Player() {
  const p = usePlayer();
  const { time, duration } = useProgress();
  const { content, open } = useStudio();
  const beat = content.beats.find(b => b.id === p.currentId);
  if (!beat) return null;
  const multi = p.queue.length > 1;
  return (
    <aside className={s.player} aria-label="Player anteprime">
      <button type="button" className={s.playerTrack} onClick={() => open({ type: "beat", id: beat.id })} aria-label={`Apri dettagli di ${beat.title}`}>
        <BeatCover beat={beat} className={s.playerCover} />
        <span><strong>{beat.title}</strong><small>{beat.genre} · {beat.bpm} BPM <DemoBadge /></small></span>
      </button>
      <div className={s.playerControls}>
        <button type="button" className={s.iconBtn} onClick={p.prev} disabled={!multi && time < 1} aria-label="Precedente"><SkipBack size={18} /></button>
        <button type="button" className={s.playMain} onClick={() => p.toggle(beat)} aria-label={p.playing ? "Pausa" : "Riproduci"}>
          {p.loading ? <Loader2 size={20} className={s.spin} /> : p.playing ? <Pause size={20} /> : <Play size={20} />}
        </button>
        <button type="button" className={s.iconBtn} onClick={p.next} disabled={!multi} aria-label="Successivo"><SkipForward size={18} /></button>
      </div>
      <div className={s.playerProgress}>
        <span>{mmss(time)}</span>
        <input type="range" min={0} max={duration || 1} step={0.1} value={Math.min(time, duration || 1)} onChange={e => p.seek(Number(e.target.value))} aria-label="Posizione nel brano" aria-valuetext={`${mmss(time)} di ${mmss(duration)}`} />
        <span>{mmss(duration)}</span>
      </div>
      <div className={s.playerVolume}>
        <button type="button" className={s.iconBtn} onClick={() => p.setVolume(p.volume > 0 ? 0 : 0.7)} aria-label={p.volume > 0 ? "Disattiva audio" : "Riattiva audio"}>{p.volume > 0 ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
        <input type="range" min={0} max={1} step={0.05} value={p.volume} onChange={e => p.setVolume(Number(e.target.value))} aria-label="Volume" />
      </div>
      {p.error && <p className={s.playerError} role="alert">{p.error}</p>}
    </aside>
  );
}
