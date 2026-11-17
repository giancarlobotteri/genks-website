import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatEuro } from "../lib/catalog.ts";
import { bassNote, hat, kick, snare } from "../lib/synth.ts";
import { AUDIO_CLAIM, useStudio } from "../store.tsx";
import s from "../styles/vs.module.css";
import { DemoForm } from "./DemoForm.tsx";
import { DemoBadge, Field, fieldProps } from "./ui.tsx";

const ROWS = ["Kick", "Snare", "Hi-hat", "Basso"] as const;
const START: boolean[][] = [
  [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0],
  [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0],
].map(r => r.map(Boolean));

/** A small, playable 16-step sequencer: the "digital instruments" visual of the custom-beat area. */
function Sequencer({ active }: { active: boolean }) {
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
        if (g[0][k]) kick(ctx, out, at);
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
    <div className={s.seq} aria-label="Sequencer dimostrativo">
      <div className={s.seqHead}>
        <button type="button" className={s.playBtn} aria-pressed={playing} aria-label={playing ? "Ferma il sequencer" : "Avvia il sequencer"}
          onClick={() => {
            if (!playing) {
              window.dispatchEvent(new CustomEvent(AUDIO_CLAIM, { detail: "sequencer" }));
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

/** "Beat su misura": opened from the DAW monitor in the studio or from the menu. */
export function CustomBeatPanel({ active = true }: { active?: boolean }) {
  const { content } = useStudio();
  const cfg = content.customBeat;
  return (
    <div className={s.customPanel}>
      <div className={s.customVisual}>
        <div className={s.customHero} aria-hidden="true" />
        <p className={s.customLead}>Sintetizzatori, sequencer e sound design pensati per la tua voce. Prima il brief, poi un preventivo chiaro.</p>
        <Sequencer active={active} />
        <ol className={s.steps}>{cfg.steps.map((st, i) => <li key={st.title} style={{ ["--i" as string]: i }}><span>{String(i + 1).padStart(2, "0")}</span><strong>{st.title}</strong><p>{st.text}</p></li>)}</ol>
        <dl className={s.facts}>
          <div><dt>Tempi orientativi</dt><dd>{cfg.turnaround}</dd></div>
          <div><dt>Revisioni</dt><dd>{cfg.revisions}</dd></div>
          <div><dt>Prezzo</dt><dd>{cfg.priceFrom != null ? `da ${formatEuro(cfg.priceFrom)}` : "su preventivo"} <DemoBadge /></dd></div>
        </dl>
        <p className={s.muted}>Diritti, licenza e condizioni vengono definiti nell’accordo scritto: qui non sono riportate condizioni contrattuali.</p>
      </div>
      <div className={s.customForm}>
        <h3>Richiedi un preventivo</h3>
        <DemoForm kind="custom-beat" submitLabel="Richiedi preventivo"
          rules={{ name: { required: true, label: "Nome" }, email: { required: true, email: true, label: "Email" }, genre: { required: true, label: "Genere" }, description: { required: true, label: "Descrizione" }, bpm: { min: 40, max: 220, label: "BPM" }, reference: { url: true, label: "Riferimento sonoro" } }}
          summary={v => `${v.genre}${v.bpm ? ` · ${v.bpm} BPM` : ""} · ${v.mood || "mood libero"} · ${v.name}`}>
          {errors => <>
            <Field label="Riferimento sonoro (link)" name="reference" error={errors.reference}><input {...fieldProps("reference", errors)} type="url" placeholder="https://" /></Field>
            <div className={s.grid2}>
              <Field label="Genere *" name="genre" error={errors.genre}><input {...fieldProps("genre", errors)} list="genres" /></Field>
              <Field label="BPM (facoltativo)" name="bpm" error={errors.bpm}><input {...fieldProps("bpm", errors)} type="number" inputMode="numeric" min={40} max={220} /></Field>
              <Field label="Mood" name="mood" error={errors.mood}><input {...fieldProps("mood", errors)} placeholder="es. notturno, energico" /></Field>
              <Field label="Budget indicativo" name="budget" error={errors.budget}>
                <select {...fieldProps("budget", errors)} defaultValue=""><option value="">Da definire</option><option>Fino a 250 €</option><option>250–500 €</option><option>Oltre 500 €</option></select>
              </Field>
              <Field label="Deadline" name="deadline" error={errors.deadline}><input {...fieldProps("deadline", errors)} type="date" /></Field>
              <Field label="Telefono (facoltativo)" name="phone" error={errors.phone}><input {...fieldProps("phone", errors)} type="tel" /></Field>
            </div>
            <datalist id="genres"><option>Trap</option><option>Drill</option><option>R&amp;B</option><option>Boom bap</option><option>Afro</option><option>Lo-fi</option><option>Pop</option></datalist>
            <Field label="Descrizione *" name="description" error={errors.description}><textarea {...fieldProps("description", errors)} rows={4} placeholder="Strumenti, atmosfera, struttura, destinazione del brano…" /></Field>
            <div className={s.grid2}>
              <Field label="Nome *" name="name" error={errors.name}><input {...fieldProps("name", errors)} autoComplete="name" /></Field>
              <Field label="Email *" name="email" error={errors.email}><input {...fieldProps("email", errors)} type="email" autoComplete="email" /></Field>
            </div>
          </>}
        </DemoForm>
      </div>
    </div>
  );
}
