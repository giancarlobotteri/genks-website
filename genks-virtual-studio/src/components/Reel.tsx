import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { formatEuro } from "../lib/catalog.ts";
import { getDirector, setAfterReel, setReelChoosing, setReelShot } from "../lib/director.ts";
import { enterStore, goService, goStudio } from "../lib/nav.ts";
import { useStudio } from "../store.tsx";
import s from "../styles/vs.module.css";
import { GenksSymbol } from "./brand.tsx";
import { getFilmVideo, onFilmVideo, pickFilm, setReelFilm } from "../lib/film-media.ts";
import { StreakIntro } from "./StreakIntro.tsx";
import { DemoBadge, prefersReducedMotion } from "./ui.tsx";
import { KineticWords } from "./Wizard.tsx";

type Chapter = {
  id: string; shot: string; ms: number; num?: string; kicker: string; title: string[]; text: string;
  chips: string[]; cta?: { label: string; go: () => void };
  /** where the chapter starts in the opening film (s), and its shorter headline there */
  at: number; short: string[];
};

/**
 * The opening film: one continuous take through the studio, made with Higgsfield Genjutsu from the
 * site's own camera move (scripts/render-intro.cjs). No logo is drawn in it: the GENKS symbol stays the
 * original vector of the titles. Played when the device can (not with reduced motion or data saver);
 * otherwise, or if it fails to load, the preview runs live over the 3D studio as before.
 */

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
  const beats = content.beats.filter(b => b.status === "published").length;

  const chapters = useMemo<Chapter[]>(() => [
    { id: "intro", shot: "reel:intro", ms: 4600, at: 0, short: ["Il tuo studio,", "anche online."], kicker: "GENKS Virtual Studio", title: ["Il tuo studio,", "anche online."], text: "Quattro servizi in un unico spazio. Guarda cosa puoi fare qui.", chips: ["Registrazione", "Beat su misura", "Mix & Master", "Beat Store"] },
    { id: "rec", shot: "reel:rec", ms: 5600, at: 5.4, short: ["Entra in sala."], num: "01", kicker: "Registrazione voce", title: ["Entra in sala.", "Registra la tua voce."], text: "Sessioni con fonico in studio: scegli le ore, il giorno e l’orario.", chips: content.recording.map(p => `${p.hours} h · ${p.price != null ? formatEuro(p.price) : "su richiesta"}`), cta: { label: "Prenota una sessione", go: () => void goService("recording") } },
    { id: "custom", shot: "reel:custom", ms: 5600, at: 7.3, short: ["Un beat", "sul tuo brano."], num: "02", kicker: "Beat su misura", title: ["Un beat costruito", "sul tuo brano."], text: `Dal brief alla consegna, con un preventivo chiaro${content.customBeat.priceFrom != null ? ` · da ${formatEuro(content.customBeat.priceFrom)}` : ""}.`, chips: content.customBeat.steps.map(x => x.title), cta: { label: "Richiedi un beat", go: () => void goService("custom") } },
    { id: "mix", shot: "reel:mix", ms: 5600, at: 9.2, short: ["Equilibrio e vita", "al tuo brano."], num: "03", kicker: "Mix & Master", title: ["Diamo equilibrio", "e vita al brano."], text: "Mandi le tracce da remoto, ricevi il brano finito per lo streaming.", chips: content.mix.map(m => `${m.name}${m.price != null ? ` · ${formatEuro(m.price)}` : ""}`), cta: { label: "Scegli il servizio", go: () => void goService("mix") } },
    { id: "store", shot: "reel:store", ms: 5600, at: 11.5, short: [`${beats} beat`, "pronti da ascoltare."], num: "04", kicker: "Beat Store", title: [`${beats} beat originali,`, "pronti da ascoltare."], text: "Anteprime istantanee e licenze chiare, dall’MP3 all’esclusiva.", chips: ["Anteprime", "MP3 · WAV · Stems", "Licenze chiare"], cta: { label: "Apri il Beat Store", go: () => void enterStore() } },
  ], [content, beats]);

  const [i, setI] = useState(() => (reduced || (wasSeen() && !getDirector().reelFromStart) ? chapters.length : 0));
  const [paused, setPaused] = useState(false);
  // opening titles (light streaks → GENKS symbol) when the preview starts from its first chapter
  const [intro, setIntro] = useState(() => !reduced && i === 0);
  const choosing = i >= chapters.length;
  const barRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const elapsed = useRef(0);
  // the film is the studio's own video (living photograph, see StudioStage): the preview plays it
  const [film, setFilm] = useState(() => Boolean(pickFilm()));
  const filmOn = film && !choosing;
  // the studio (with the video) can mount a moment after the preview: wait for it, a few seconds at most
  const [vid, setVid] = useState(getFilmVideo);
  useEffect(() => onFilmVideo(v => { if (v) setVid(v); }), []);
  useEffect(() => {
    if (!film || vid) return;
    const t = window.setTimeout(() => { if (!getFilmVideo()) setFilm(false); }, 6000);
    return () => window.clearTimeout(t);
  }, [film, vid]);
  useEffect(() => {
    if (!vid) return;
    const fail = () => setFilm(false);
    vid.addEventListener("error", fail);
    return () => vid.removeEventListener("error", fail);
  }, [vid]);
  useEffect(() => { setReelFilm(filmOn); return () => setReelFilm(false); }, [filmOn]);

  const go = useCallback((n: number) => {
    elapsed.current = 0;
    const k = Math.max(0, Math.min(chapters.length, n));
    // in the film, a chapter is a moment of the take: jump there
    const v = getFilmVideo();
    if (v && film && k < chapters.length) { setReelFilm(true); fromTop.current = false; }
    if (v && film && k < chapters.length) { try { v.currentTime = chapters[k].at + 0.01; } catch { /* not seekable yet */ } }
    setI(k);
  }, [chapters, film]);

  // the camera follows the chapter
  useEffect(() => {
    // behind the film the 3D camera already waits on the final question, ready for the cross-fade
    setReelShot(choosing || film ? "reel:choose" : intro && i === 0 ? "reel:dark" : chapters[i].shot);
    setReelChoosing(choosing);
    // the preview ends (or is skipped) straight into the studio, at its first stop: the microphone
    if (choosing) { markSeen(); setAfterReel(true); void goStudio(0); }
  }, [i, choosing, chapters, intro, film]);

  // the film: its own clock drives the chapters, the bars and (on portrait screens) the crop
  // the first start of this preview plays the take from the top (the tour may have left it anywhere)
  const fromTop = useRef(true);
  const startFilm = useCallback(() => {
    const v = getFilmVideo();
    if (!v) return;
    v.muted = true;
    setReelFilm(true);
    // eslint-disable-next-line react-hooks/immutability -- the film is an external media object, not React state
    if (fromTop.current || v.ended || v.currentTime > 12.5) { fromTop.current = false; try { v.currentTime = 0; } catch { /* not seekable yet */ } }
    v.play().catch(() => setFilm(false));
  }, []);
  // a fresh preview: back to the top of the take straight away, still, under the titles
  // eslint-disable-next-line react-hooks/immutability -- the film is an external media object, not React state
  useEffect(() => {
    if (!filmOn || !vid || !fromTop.current || i !== 0) return;
    setReelFilm(true);
    vid.pause();
    // eslint-disable-next-line react-hooks/immutability -- the film is an external media object, not React state
    try { vid.currentTime = 0; } catch { /* not seekable yet */ }
  }, [filmOn, vid, i]);
  useEffect(() => {
    const v = vid;
    if (!filmOn || !v) return;
    if (paused) v.pause();
    else if (!intro) startFilm();
  }, [filmOn, paused, intro, startFilm, vid]);
  useEffect(() => {
    const v = vid;
    if (!filmOn || !v) return;
    let raf = 0, lastT = -1, still = performance.now();
    const tick = (now: number) => {
      // the take hasn't started yet (titles on screen): nothing to follow
      if (intro || fromTop.current) { raf = requestAnimationFrame(tick); return; }
      const t = v.currentTime, d = v.duration || 13;
      if (t !== lastT) { lastT = t; still = now; }
      // stuck for a while (network): carry on live over the 3D studio
      else if (!paused && !intro && now - still > 6000) { setFilm(false); return; }
      let k = chapters.length - 1;
      while (k > 0 && t < chapters[k].at) k--;
      if (k !== i) { setI(k); return; }
      barRefs.current.forEach((b, j) => {
        const a = chapters[j].at, z = chapters[j + 1]?.at ?? d;
        b?.style.setProperty("--fill", Math.min(1, Math.max(0, (t - a) / (z - a))).toFixed(4));
      });
      if (v.ended || t >= d - 0.03) { v.pause(); go(chapters.length); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [filmOn, i, chapters, paused, intro, go, vid]);

  // timeline: one rAF, progress written straight to the bars (no React work per frame)
  useEffect(() => {
    if (choosing || film) return;
    let raf = 0, last = performance.now();
    const step = (now: number) => {
      const dt = now - last; last = now;
      if (!paused && !intro && !document.hidden) elapsed.current += dt;
      const u = Math.min(1, elapsed.current / chapters[i].ms);
      barRefs.current.forEach((b, k) => b?.style.setProperty("--fill", k < i ? "1" : k === i ? u.toFixed(4) : "0"));
      if (u >= 1) go(i + 1);
      else raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [i, paused, choosing, chapters, go, intro, film]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (intro || (e.target as Element | null)?.closest("input, textarea, select, dialog")) return;
      if (e.key === "ArrowRight") go(i + 1);
      else if (e.key === "ArrowLeft") go(i - 1);
      else if (e.key === "Escape") go(chapters.length);
      else if (e.key === " " && !choosing && !(e.target as Element | null)?.closest("button, a")) { e.preventDefault(); setPaused(v => !v); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [i, choosing, chapters.length, go, intro]);

  const ch = chapters[i];
  // tap zones on the picture: left half = back, right half = forward (like stories)
  const onStageTap = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as Element).closest("button, a")) return;
    go(e.clientX < window.innerWidth * 0.35 ? i - 1 : i + 1);
  };

  return (
    <div className={s.reel} data-choosing={choosing || undefined} data-film={filmOn || undefined} role="region" aria-roledescription="anteprima" aria-label="Anteprima dei servizi GENKS">
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
          {!(intro && i === 0) && <article key={ch.id} className={s.reelChapter} data-id={ch.id} aria-live="polite">
            {ch.num && <span className={s.reelNum} aria-hidden="true">{ch.num}</span>}
            <div className={s.reelWipe} aria-hidden="true" />
            <p className={s.reelKicker}><span>{ch.kicker}</span></p>
            <h2 className={s.reelTitle}><Words lines={filmOn ? ch.short : ch.title} delay={180} /></h2>
            {/* in the film each moment is short: the headline, and the four services when they appear in the light */}
            {!filmOn && <p className={s.reelText}>{ch.text}</p>}
            {(!filmOn || ch.id === "intro") && <ul className={s.reelChips}>{ch.chips.map((c, k) => <li key={c} style={{ ["--c" as string]: k } as CSSProperties}>{c}</li>)}</ul>}
            {ch.cta && !filmOn && <button type="button" className={s.btnPrimary} data-reel-cta onClick={ch.cta.go}>{ch.cta.label} <ArrowRight size={16} /></button>}
          </article>}
          <div className={s.reelNav}>
            <button type="button" className={s.iconBtn} onClick={() => go(i - 1)} disabled={i === 0} aria-label="Capitolo precedente"><ChevronLeft size={20} /></button>
            <button type="button" className={s.iconBtn} onClick={() => go(i + 1)} aria-label="Capitolo successivo"><ChevronRight size={20} /></button>
          </div>
        </div>
      ) : (
        null
      )}
      {intro && i === 0 && <StreakIntro onReveal={startFilm} onDone={() => setIntro(false)} />}
    </div>
  );
}


