import { ChevronLeft, ChevronRight, Pause, Play, Search, SlidersHorizontal, RotateCcw, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { emptyFilters, filterBeats, filterOptions, formatEuro, priceFrom, type BeatFilters, type SortKey } from "../lib/catalog.ts";
import { setStorePage } from "../lib/director.ts";
import { usePlayer, useStudio } from "../store.tsx";
import s from "../styles/vs.module.css";
import type { Beat } from "../types.ts";
import { BeatCover, DemoBadge } from "./ui.tsx";

export function PlayButton({ beat, queue, size = 18, className }: { beat: Beat; queue?: string[]; size?: number; className?: string }) {
  const player = usePlayer();
  const current = player.currentId === beat.id;
  const playing = current && player.playing;
  const loading = current && player.loading;
  return (
    <button type="button" className={className ?? s.playBtn} onClick={() => player.toggle(beat, queue)} aria-label={`${playing ? "Pausa" : "Ascolta l’anteprima di"} ${beat.title}`} aria-pressed={playing}>
      {loading ? <Loader2 size={size} className={s.spin} /> : playing ? <Pause size={size} /> : <Play size={size} />}
    </button>
  );
}

const SORTS: { value: SortKey; label: string }[] = [
  { value: "recommended", label: "Consigliati" },
  { value: "newest", label: "Più recenti" },
  { value: "price-asc", label: "Prezzo crescente" },
  { value: "price-desc", label: "Prezzo decrescente" },
  { value: "bpm-asc", label: "BPM crescenti" },
  { value: "bpm-desc", label: "BPM decrescenti" },
  { value: "title", label: "Titolo A–Z" },
];

export function BeatStore() {
  const { content, open } = useStudio();
  const player = usePlayer();
  const [f, setF] = useState<BeatFilters>(emptyFilters);
  const [showFilters, setShowFilters] = useState(false);
  const opts = useMemo(() => filterOptions(content.beats), [content.beats]);
  const list = useMemo(() => filterBeats(content.beats, content.licenses, f), [content, f]);
  const queue = list.map(b => b.id);
  const set = <K extends keyof BeatFilters>(k: K, v: BeatFilters[K]) => setF(prev => ({ ...prev, [k]: v }));
  const num = (v: string) => (v === "" ? null : Number(v));
  const active = JSON.stringify({ ...f, sort: "recommended" }) !== JSON.stringify({ ...emptyFilters });
  const licName = (id: string) => content.licenses.find(l => l.id === id)?.name ?? id;

  // The catalogue is a crate of records: one vinyl per beat, browsed like a carousel. The chosen
  // record slides out of its sleeve and turns (33⅓ rpm while its preview plays, the tonearm drops).
  const [selWanted, setSel] = useState(0);
  const sel = Math.max(0, Math.min(selWanted, list.length - 1));
  const selBeat = list[sel];
  // the vault behind travels with the crate (scene → film-media vault)
  useEffect(() => { setStorePage(Math.floor(sel / 2)); }, [sel]);
  const go = (n: number) => { if (list.length) setSel(((n % list.length) + list.length) % list.length); };
  const setFilter: typeof set = (k, v) => { setSel(0); set(k, v); };
  const drag = useRef<{ x: number } | null>(null);
  const dragged = useRef(false);
  const wheelT = useRef(0);
  const onWheel = (e: React.WheelEvent) => {
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(d) < 8 || performance.now() - wheelT.current < 260) return;
    wheelT.current = performance.now();
    go(sel + (d > 0 ? 1 : -1));
  };
  const playingSel = selBeat && player.currentId === selBeat.id && player.playing;
  // hands on the record: dragging the chosen vinyl turns it (scratch), a flick spins it faster,
  // then it settles back to its own speed; the crate tilts towards the mouse and the light on the
  // grooves moves with it
  const rowRef = useRef<HTMLUListElement>(null);
  const spin = useRef({ a: 0, v: 0, on: false, x: 0, t: 0, raf: 0 });
  const scratchEl = () => rowRef.current?.querySelector<HTMLElement>("[data-on] [data-scratch]") ?? null;
  const spinLoop = () => {
    const st = spin.current;
    cancelAnimationFrame(st.raf);
    const step = () => {
      if (!st.on) { st.a += st.v / 60; st.v *= 0.95; }
      const el = scratchEl();
      if (el) el.style.transform = `rotate(${st.a.toFixed(2)}deg)`;
      if (st.on || Math.abs(st.v) > 2) st.raf = requestAnimationFrame(step);
    };
    st.raf = requestAnimationFrame(step);
  };
  useEffect(() => { spin.current.a = 0; spin.current.v = 0; const el = scratchEl(); if (el) el.style.transform = ""; }, [sel]);
  useEffect(() => () => cancelAnimationFrame(spin.current.raf), []);
  const onRowMove = (e: React.PointerEvent<HTMLUListElement>) => {
    const st = spin.current, row = e.currentTarget;
    if (st.on) {
      const now = performance.now(), dx = e.clientX - st.x;
      st.a += dx * 0.9;
      st.v = (dx * 0.9) / Math.max(1, now - st.t) * 1000;
      st.x = e.clientX; st.t = now;
      return;
    }
    if (e.pointerType !== "mouse") return;
    const r = row.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    row.style.setProperty("--ry", `${(x * 10).toFixed(2)}deg`);
    row.style.setProperty("--rx", `${(-y * 7).toFixed(2)}deg`);
    row.style.setProperty("--sheen", `${(x * 70).toFixed(1)}deg`);
  };

  return (
    <section id="beat-store" className={s.store} aria-labelledby="store-title">
      <div className={s.storeBg} aria-hidden="true" />
      <header className={s.storeHead}>
        <p className={s.kicker}>Beat Store <DemoBadge>Catalogo DEMO</DemoBadge></p>
        <h2 id="store-title">Ascolta, scegli la licenza, simula l’ordine.</h2>
        <p className={s.storeLead}>Anteprime originali generate nel browser. Prezzi e licenze di esempio, nessun pagamento reale.</p>
      </header>

      <div className={s.toolsWrap}>
      <div className={s.storeTools}>
        <label className={s.search}>
          <Search size={18} aria-hidden="true" />
          <span className={s.srOnly}>Cerca beat</span>
          <input type="search" placeholder="Cerca titolo, genere, mood, tonalità…" value={f.query} onChange={e => setFilter("query", e.target.value)} />
        </label>
        <button type="button" className={s.btnGhost} aria-expanded={showFilters} aria-controls="beat-filters" onClick={() => setShowFilters(v => !v)}>
          <SlidersHorizontal size={16} /> <span className={s.hideXs}>Filtri</span>
        </button>
        <label className={s.sortSel}>
          <span className={s.hideXs}>Ordina</span>
          <select value={f.sort} onChange={e => setFilter("sort", e.target.value as SortKey)}>
            {SORTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      </div>

      <div id="beat-filters" className={s.filters} data-open={showFilters || undefined}>
        <label>Genere<select value={f.genre} onChange={e => setFilter("genre", e.target.value)}><option value="">Tutti</option>{opts.genres.map(g => <option key={g}>{g}</option>)}</select></label>
        <label>Mood<select value={f.mood} onChange={e => setFilter("mood", e.target.value)}><option value="">Tutti</option>{opts.moods.map(g => <option key={g}>{g}</option>)}</select></label>
        <label>Tonalità<select value={f.key} onChange={e => setFilter("key", e.target.value)}><option value="">Tutte</option>{opts.keys.map(g => <option key={g}>{g}</option>)}</select></label>
        <label>BPM min<input type="number" inputMode="numeric" min={40} max={220} value={f.bpmMin ?? ""} onChange={e => setFilter("bpmMin", num(e.target.value))} /></label>
        <label>BPM max<input type="number" inputMode="numeric" min={40} max={220} value={f.bpmMax ?? ""} onChange={e => setFilter("bpmMax", num(e.target.value))} /></label>
        <label>Prezzo fino a
          <select value={f.priceMax ?? ""} onChange={e => setFilter("priceMax", num(e.target.value))}>
            <option value="">Qualsiasi</option>
            {[3000, 5000, 10000].map(v => <option key={v} value={v}>{formatEuro(v)}</option>)}
          </select>
        </label>
        <button type="button" className={s.btnText} onClick={() => { setSel(0); setF(emptyFilters); }} disabled={!active}><RotateCcw size={14} /> Azzera filtri</button>
      </div>
      </div>

      <div className={s.storeBar}>
        <p className={s.resultCount} role="status" aria-live="polite">{list.length === 1 ? "1 beat" : `${list.length} beat`}{list.length > 0 && <span> · disco {sel + 1} di {list.length}</span>}</p>
        {list.length > 1 && (
          <nav className={s.pager} aria-label="Scorri i dischi">
            <button type="button" className={s.iconBtn} onClick={() => go(sel - 1)} aria-label="Disco precedente"><ChevronLeft size={20} /></button>
            <button type="button" className={s.iconBtn} onClick={() => go(sel + 1)} aria-label="Disco successivo"><ChevronRight size={20} /></button>
          </nav>
        )}
      </div>

      <div className={s.crate}>
        {list.length === 0 || !selBeat ? (
          <div className={s.empty}>
            <p>Nessun beat corrisponde ai filtri scelti.</p>
            <button type="button" className={s.btnPrimary} onClick={() => setF(emptyFilters)}>Mostra tutto il catalogo</button>
          </div>
        ) : (
          <>
            <ul ref={rowRef} className={s.vinylRow} aria-label="Dischi del catalogo" tabIndex={0} onWheel={onWheel} onPointerMove={onRowMove}
              onPointerLeave={e => { const r = e.currentTarget; r.style.setProperty("--rx", "0deg"); r.style.setProperty("--ry", "0deg"); }}
              onKeyDown={e => { if (e.key === "ArrowRight") { e.preventDefault(); go(sel + 1); } else if (e.key === "ArrowLeft") { e.preventDefault(); go(sel - 1); } }}
              onPointerDown={e => {
                // on the chosen record: scratch it; anywhere else: swipe through the crate
                if ((e.target as Element).closest("[data-on] [data-disc]")) {
                  const st = spin.current; st.on = true; st.x = e.clientX; st.t = performance.now(); st.v = 0;
                  e.currentTarget.setPointerCapture(e.pointerId); spinLoop(); dragged.current = false; drag.current = null;
                  return;
                }
                drag.current = { x: e.clientX };
              }}
              onPointerUp={e => {
                const st = spin.current;
                if (st.on) { st.on = false; dragged.current = Math.abs(st.v) > 30; spinLoop(); return; }
                const d = drag.current; drag.current = null; dragged.current = Boolean(d && Math.abs(e.clientX - d.x) > 40); if (d && dragged.current) go(sel + (e.clientX < d.x ? 1 : -1));
              }}>
              {list.map((b, i) => {
                const o = i - sel, ao = Math.abs(o);
                if (ao > 4) return null;
                const on = o === 0;
                const playing = player.currentId === b.id && player.playing;
                // coverflow: the chosen record in front, the others turned towards it on each side
                const sg = Math.sign(o);
                const tx = on ? -0.24 : sg * (0.5 + ao * 0.46), sc = on ? 1 : Math.max(0.46, 0.7 - (ao - 1) * 0.08);
                const style = {
                  ["--h" as string]: 222 + b.hue * 0.4, zIndex: 10 - ao, opacity: ao > 3 ? 0 : 1 - ao * 0.16,
                  transform: `translate(-50%, -50%) translateX(calc(${tx.toFixed(3)} * var(--size))) rotateY(${(-sg * 42).toFixed(0)}deg) scale(${sc.toFixed(3)})`,
                } as React.CSSProperties;
                return (
                  <li key={b.id} className={s.vinylItem} data-on={on || undefined} data-playing={playing || undefined} style={style}>
                    <button type="button" className={s.vinylHit} aria-label={on ? `${b.title}: ${playing ? "metti in pausa" : "ascolta"}` : `Scegli il disco ${b.title}`} aria-current={on || undefined} tabIndex={on ? 0 : -1}
                      onClick={() => { if (dragged.current) { dragged.current = false; return; } if (on) player.toggle(b, queue); else setSel(i); }}>
                      <span className={s.vinylDisc} data-disc aria-hidden="true">
                        <span className={s.vinylScratch} data-scratch>
                        <span className={s.vinylSpin}>
                          <span className={s.vinylGrooves} />
                          <span className={s.vinylLabel}><b>{b.title}</b><i>{b.genre} · {b.bpm} BPM</i><em>GENKS · 33⅓</em></span>
                        </span>
                        </span>
                        <span className={s.vinylSheen} />
                      </span>
                      <span className={s.vinylSleeve} aria-hidden="true"><BeatCover beat={b} /></span>
                    </button>
                    <span className={s.vinylCaption} data-title>{b.title}</span>
                  </li>
                );
              })}
              <span className={s.tonearm} data-down={playingSel || undefined} aria-hidden="true"><i /></span>
            </ul>
            <article className={s.vinylInfo} key={selBeat.id}>
              <div>
                <h3>{selBeat.title}</h3>
                <p className={s.beatMeta}>{selBeat.genre} · {selBeat.bpm} BPM · {selBeat.key}</p>
                <p className={s.tags}>{selBeat.mood.map(m => <span key={m}>{m}</span>)}</p>
                <p className={s.licBadges} aria-label="Licenze disponibili">{selBeat.licenses.map(id => <span key={id}>{licName(id)}</span>)}</p>
              </div>
              <div className={s.vinylBuy}>
                <span className={s.price}>{priceFrom(selBeat, content.licenses) != null ? <>da <strong>{formatEuro(priceFrom(selBeat, content.licenses)!)}</strong></> : "Su richiesta"}</span>
                <PlayButton beat={selBeat} queue={queue} size={20} className={s.vinylPlay} />
                <button type="button" className={s.btnPrimary} onClick={() => open({ type: "beat", id: selBeat.id })}>Licenze<span className={s.srOnly}> per {selBeat.title}</span></button>
                <DemoBadge />
              </div>
            </article>
          </>
        )}
      </div>
    </section>
  );
}
