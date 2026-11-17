import { ArrowRight, ChevronLeft, ChevronRight, Disc3, Mic, MonitorPlay, Pause, Play, RotateCcw, SlidersHorizontal, Compass } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { formatEuro } from "../lib/catalog.ts";
import { getDirector, setReelShot } from "../lib/director.ts";
import { enterStore, goService, goStudio } from "../lib/nav.ts";
import { useStudio } from "../store.tsx";
import s from "../styles/vs.module.css";
import { GenksSymbol } from "./brand.tsx";
import { DemoBadge, prefersReducedMotion } from "./ui.tsx";
import { KineticWords } from "./Wizard.tsx";

type Chapter = {
  id: string; shot: string; ms: number; num?: string; kicker: string; title: string[]; text: string;
  chips: string[]; cta?: { label: string; go: () => void };
};

const SEEN = "genks:vs:reel";
const wasSeen = () => { try { return sessionStorage.getItem(SEEN) === "1"; } catch { return false; } };
const markSeen = () => { try { sessionStorage.setItem(SEEN, "1"); } catch { /* private mode */ } };

/** Kinetic headline: every word rises out of its own mask, one after another, line by line. */
function Words({ lines, delay = 0 }: { lines: string[]; delay?: number }) {
  const offsets = lines.map((_, li) => lines.slice(0, li).reduce((n, l) => n + l.split(" ").length, 0));
  return (
    <>
      {lines.map((line, li) => (
        <span key={li} className={s.kLine}>
          <KineticWords text={line} from={offsets[li]} delay={delay} />
          {li < lines.length - 1 ? " " : null}
        </span>
      ))}
    </>
  );
}

/**
 * The preview "video": a directed sequence over the live 3D studio. Each chapter has its own
 * camera move (lib/director → StudioStage) and its own kinetic typography; the user can pause,
 * jump between chapters, pick a service at any time, or skip to the final question.
 */
export function Reel() {
  const { content } = useStudio();
  const reduced = prefersReducedMotion();
  const fromRec = content.recording.reduce<number | null>((m, p) => (p.price == null ? m : m == null ? p.price : Math.min(m, p.price)), null);
  const fromMix = content.mix.reduce<number | null>((m, p) => (p.price == null ? m : m == null ? p.price : Math.min(m, p.price)), null);
  const beats = content.beats.filter(b => b.status === "published").length;

  const chapters = useMemo<Chapter[]>(() => [
    { id: "intro", shot: "reel:intro", ms: 4600, kicker: "GENKS Virtual Studio", title: ["Il tuo studio,", "anche online."], text: "Quattro servizi in un unico spazio. Guarda cosa puoi fare qui.", chips: ["Registrazione", "Beat su misura", "Mix & Master", "Beat Store"] },
    { id: "rec", shot: "reel:rec", ms: 5600, num: "01", kicker: "Registrazione voce", title: ["Entra in sala.", "Registra la tua voce."], text: "Sessioni con fonico in studio: scegli le ore, il giorno e l’orario.", chips: content.recording.map(p => `${p.hours} h · ${p.price != null ? formatEuro(p.price) : "su richiesta"}`), cta: { label: "Prenota una sessione", go: () => void goService("recording") } },
    { id: "custom", shot: "reel:custom", ms: 5600, num: "02", kicker: "Beat su misura", title: ["Un beat costruito", "sul tuo brano."], text: `Dal brief alla consegna, con un preventivo chiaro${content.customBeat.priceFrom != null ? ` · da ${formatEuro(content.customBeat.priceFrom)}` : ""}.`, chips: content.customBeat.steps.map(x => x.title), cta: { label: "Richiedi un beat", go: () => void goService("custom") } },
    { id: "mix", shot: "reel:mix", ms: 5600, num: "03", kicker: "Mix & Master", title: ["Diamo equilibrio", "e vita al brano."], text: "Mandi le tracce da remoto, ricevi il brano finito per lo streaming.", chips: content.mix.map(m => `${m.name}${m.price != null ? ` · ${formatEuro(m.price)}` : ""}`), cta: { label: "Scegli il servizio", go: () => void goService("mix") } },
    { id: "store", shot: "reel:store", ms: 5600, num: "04", kicker: "Beat Store", title: [`${beats} beat originali,`, "pronti da ascoltare."], text: "Anteprime istantanee e licenze chiare, dall’MP3 all’esclusiva.", chips: ["Anteprime", "MP3 · WAV · Stems", "Licenze chiare"], cta: { label: "Apri il Beat Store", go: () => void enterStore() } },
  ], [content, beats]);

  const [i, setI] = useState(() => (reduced || (wasSeen() && !getDirector().reelFromStart) ? chapters.length : 0));
  const [paused, setPaused] = useState(false);
  const choosing = i >= chapters.length;
  const barRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const elapsed = useRef(0);

  const go = useCallback((n: number) => {
    elapsed.current = 0;
    setI(Math.max(0, Math.min(chapters.length, n)));
  }, [chapters.length]);

  // the camera follows the chapter
  useEffect(() => {
    setReelShot(choosing ? "reel:choose" : chapters[i].shot);
    if (choosing) markSeen();
  }, [i, choosing, chapters]);

  // timeline: one rAF, progress written straight to the bars (no React work per frame)
  useEffect(() => {
    if (choosing) return;
    let raf = 0, last = performance.now();
    const step = (now: number) => {
      const dt = now - last; last = now;
      if (!paused && !document.hidden) elapsed.current += dt;
      const u = Math.min(1, elapsed.current / chapters[i].ms);
      barRefs.current.forEach((b, k) => b?.style.setProperty("--fill", k < i ? "1" : k === i ? u.toFixed(4) : "0"));
      if (u >= 1) go(i + 1);
      else raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [i, paused, choosing, chapters, go]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as Element | null)?.closest("input, textarea, select, dialog")) return;
      if (e.key === "ArrowRight") go(i + 1);
      else if (e.key === "ArrowLeft") go(i - 1);
      else if (e.key === "Escape") go(chapters.length);
      else if (e.key === " " && !choosing && !(e.target as Element | null)?.closest("button, a")) { e.preventDefault(); setPaused(v => !v); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [i, choosing, chapters.length, go]);

  const ch = chapters[i];
  // tap zones on the picture: left half = back, right half = forward (like stories)
  const onStageTap = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as Element).closest("button, a")) return;
    go(e.clientX < window.innerWidth * 0.35 ? i - 1 : i + 1);
  };

  return (
    <div className={s.reel} data-choosing={choosing || undefined} role="region" aria-roledescription="anteprima" aria-label="Anteprima dei servizi GENKS">
      <div className={s.reelShade} aria-hidden="true" />
      <header className={s.reelTop}>
        <span className={s.reelBrand}><GenksSymbol size={34} /><span>GENKS</span><DemoBadge>FREE · DEMO</DemoBadge></span>
        {!choosing && (
          <div className={s.reelControls}>
            <button type="button" className={s.iconBtn} onClick={() => setPaused(v => !v)} aria-label={paused ? "Riprendi l’anteprima" : "Metti in pausa l’anteprima"}>{paused ? <Play size={18} /> : <Pause size={18} />}</button>
            <button type="button" className={s.btnGhost} data-skip onClick={() => go(chapters.length)}>Salta <ArrowRight size={16} /></button>
          </div>
        )}
      </header>
      {!choosing && (
        <ol className={s.reelBars} aria-label="Capitoli dell’anteprima">
          {chapters.map((c, k) => (
            <li key={c.id}><button type="button" onClick={() => go(k)} aria-label={`Capitolo ${k + 1}: ${c.kicker}`} aria-current={k === i ? "step" : undefined}><span ref={el => { barRefs.current[k] = el; }} style={{ ["--fill" as string]: k < i ? 1 : 0 } as CSSProperties} /></button></li>
          ))}
        </ol>
      )}

      {!choosing ? (
        <div className={s.reelStage} onPointerUp={onStageTap}>
          {/* keyed by chapter: every element plays its entrance again */}
          <article key={ch.id} className={s.reelChapter} data-id={ch.id} aria-live="polite">
            {ch.num && <span className={s.reelNum} aria-hidden="true">{ch.num}</span>}
            <div className={s.reelWipe} aria-hidden="true" />
            <p className={s.reelKicker}><span>{ch.kicker}</span></p>
            <h2 className={s.reelTitle}><Words lines={ch.title} delay={180} /></h2>
            <p className={s.reelText}>{ch.text}</p>
            <ul className={s.reelChips}>{ch.chips.map((c, k) => <li key={c} style={{ ["--c" as string]: k } as CSSProperties}>{c}</li>)}</ul>
            {ch.cta && <button type="button" className={s.btnPrimary} data-reel-cta onClick={ch.cta.go}>{ch.cta.label} <ArrowRight size={16} /></button>}
          </article>
          <div className={s.reelNav}>
            <button type="button" className={s.iconBtn} onClick={() => go(i - 1)} disabled={i === 0} aria-label="Capitolo precedente"><ChevronLeft size={20} /></button>
            <button type="button" className={s.iconBtn} onClick={() => go(i + 1)} aria-label="Capitolo successivo"><ChevronRight size={20} /></button>
          </div>
        </div>
      ) : (
        <Choose fromRec={fromRec} fromMix={fromMix} fromCustom={content.customBeat.priceFrom} beats={beats} onReplay={() => go(0)} />
      )}
    </div>
  );
}

function Choose({ fromRec, fromMix, fromCustom, beats, onReplay }: { fromRec: number | null; fromMix: number | null; fromCustom: number | null; beats: number; onReplay: () => void }) {
  const options: { id: string; Icon: typeof Mic; title: string; text: string; meta: string; shot: string; go: () => void }[] = [
    { id: "rec", Icon: Mic, title: "Registrare la voce", text: "Prenota una sessione in studio con fonico.", meta: fromRec != null ? `da ${formatEuro(fromRec)}` : "su richiesta", shot: "reel:rec", go: () => void goService("recording") },
    { id: "custom", Icon: MonitorPlay, title: "Un beat su misura", text: "Prodotto sul tuo brano, dal brief alla consegna.", meta: fromCustom != null ? `da ${formatEuro(fromCustom)}` : "su preventivo", shot: "reel:custom", go: () => void goService("custom") },
    { id: "mix", Icon: SlidersHorizontal, title: "Mix & Master", text: "Mandi le tracce, ricevi il brano finito.", meta: fromMix != null ? `da ${formatEuro(fromMix)}` : "su preventivo", shot: "reel:mix", go: () => void goService("mix") },
    { id: "store", Icon: Disc3, title: "Un beat già pronto", text: `${beats} beat originali con anteprima e licenza.`, meta: "Beat Store", shot: "reel:store", go: () => void enterStore() },
  ];
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => { ref.current?.focus({ preventScroll: true }); }, []);
  // pointing at an option moves the camera onto that service
  const aim = (shot: string | null) => setReelShot(shot ?? "reel:choose");
  return (
    <div className={s.choose}>
      <p className={s.reelKicker}><span>Si parte da qui</span></p>
      <h2 ref={ref} tabIndex={-1} className={s.chooseTitle}><Words lines={["Di cosa", "hai bisogno?"]} /></h2>
      <ul className={s.chooseGrid} onPointerLeave={() => aim(null)}>
        {options.map((o, k) => (
          <li key={o.id} style={{ ["--c" as string]: k } as CSSProperties}>
            <button type="button" className={s.chooseCard} data-id={o.id} onClick={o.go} onPointerEnter={() => aim(o.shot)} onFocus={() => aim(o.shot)} onBlur={() => aim(null)}>
              <span className={s.chooseIcon} aria-hidden="true"><o.Icon size={24} /></span>
              <strong>{o.title}</strong>
              <span className={s.chooseText}>{o.text}</span>
              <span className={s.chooseMeta}>{o.meta}<ArrowRight size={16} aria-hidden="true" /></span>
            </button>
          </li>
        ))}
      </ul>
      <div className={s.chooseMore}>
        <button type="button" className={s.btnText} onClick={() => void goStudio(0)}><Compass size={16} /> Esplora lo studio liberamente</button>
        <button type="button" className={s.btnText} onClick={onReplay}><RotateCcw size={16} /> Rivedi l’anteprima</button>
      </div>
    </div>
  );
}

