import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { pulseLevel } from "../lib/level.ts";
import { setSubShot } from "../lib/shots.ts";
import { bassNote, hat, kick, snare } from "../lib/synth.ts";
import { AUDIO_CLAIM } from "../store.tsx";
import s from "../styles/vs.module.css";

const ROWS = ["Kick", "Snare", "Hi-hat", "Basso"] as const;
const START: boolean[][] = [
  [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0],
  [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0],
].map(r => r.map(Boolean));

/** A small, playable 16-step sequencer: the "digital instruments" visual of the custom-beat area. */
export function Sequencer({ active }: { active: boolean }) {
  const [grid, setGrid] = useState(START);
  const [bpm, setBpm] = useState(120);
  const [wantPlay, setPlaying] = useState(false);
  // the sound stops by itself when the panel closes
  const playing = wantPlay && active;
  const [step, setStep] = useState(-1);
  const gridRef = useRef(grid);
  const bpmRef = useRef(bpm);
  useEffect(() => { gridRef.current = grid; bpmRef.current = bpm; }, [grid, bpm]);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!playing) return;
    const ctx = ctxRef.current ?? new AudioContext();
    ctxRef.current = ctx;
    void ctx.resume();
    const out = ctx.createGain(); out.gain.value = 0.6; out.connect(ctx.destination);
    let next = ctx.currentTime + 0.06, i = 0;
    const timer = window.setInterval(() => {
      while (next < ctx.currentTime + 0.12) {
        const g = gridRef.current, k = i % 16, at = next;
        if (g[0][k]) { kick(ctx, out, at); window.setTimeout(() => pulseLevel(1), Math.max(0, (at - ctx.currentTime) * 1000)); }
        else if (g[1][k]) window.setTimeout(() => pulseLevel(0.7), Math.max(0, (at - ctx.currentTime) * 1000));
        if (g[1][k]) snare(ctx, out, at, 0.8);
        if (g[2][k]) hat(ctx, out, at, 0.7);
        if (g[3][k]) bassNote(ctx, out, at, 0.25, 55, undefined, 0.7);
        window.setTimeout(() => setStep(k), Math.max(0, (at - ctx.currentTime) * 1000));
        next += 60 / bpmRef.current / 4; i++;
      }
    }, 25);
    const onClaim = (e: Event) => { if ((e as CustomEvent).detail !== "sequencer") setPlaying(false); };
    window.addEventListener(AUDIO_CLAIM, onClaim);
    return () => { window.clearInterval(timer); out.disconnect(); window.removeEventListener(AUDIO_CLAIM, onClaim); setStep(-1); };
  }, [playing]);

  useEffect(() => () => { void ctxRef.current?.close(); }, []);

  return (
    <div className={s.seq} aria-label="Sequencer">
      <div className={s.seqHead}>
        <button type="button" className={s.playBtn} aria-pressed={playing} aria-label={playing ? "Ferma il sequencer" : "Avvia il sequencer"}
          onClick={() => {
            if (!playing) {
              window.dispatchEvent(new CustomEvent(AUDIO_CLAIM, { detail: "sequencer" }));
              setSubShot("custom:seq");
              // create/resume inside the tap so mobile browsers allow sound
              ctxRef.current ??= new AudioContext();
              void ctxRef.current.resume();
            }
            setPlaying(!playing);
          }}>
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <label className={s.seqBpm}>BPM <input type="range" min={70} max={160} value={bpm} onChange={e => setBpm(Number(e.target.value))} /> <output>{bpm}</output></label>
      </div>
      <div className={s.seqGrid} role="group" aria-label="Griglia a 16 passi">
        {ROWS.map((row, r) => (
          <div key={row} role="group" aria-label={row} className={s.seqRow}>
            <span aria-hidden="true">{row}</span>
            {grid[r].map((on, c) => (
              <button key={c} type="button" aria-pressed={on} aria-label={`${row} passo ${c + 1}`} data-on={on || undefined} data-now={step === c || undefined} data-beat={c % 4 === 0 || undefined}
                onClick={() => setGrid(g => g.map((rr, ri) => (ri === r ? rr.map((v, ci) => (ci === c ? !v : v)) : rr)))} />
            ))}
          </div>
        ))}
      </div>
      <p className={s.muted}>Prova a comporre: il suono è sintetizzato nel browser e parte solo quando premi Play.</p>
    </div>
  );
}

