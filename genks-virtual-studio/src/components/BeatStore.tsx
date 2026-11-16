import { Pause, Play, Search, SlidersHorizontal, RotateCcw, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { emptyFilters, filterBeats, filterOptions, formatEuro, priceFrom, type BeatFilters, type SortKey } from "../lib/catalog.ts";
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
  const [f, setF] = useState<BeatFilters>(emptyFilters);
  const [showFilters, setShowFilters] = useState(false);
  const opts = useMemo(() => filterOptions(content.beats), [content.beats]);
  const list = useMemo(() => filterBeats(content.beats, content.licenses, f), [content, f]);
  const queue = list.map(b => b.id);
  const set = <K extends keyof BeatFilters>(k: K, v: BeatFilters[K]) => setF(prev => ({ ...prev, [k]: v }));
  const num = (v: string) => (v === "" ? null : Number(v));
  const active = JSON.stringify({ ...f, sort: "recommended" }) !== JSON.stringify({ ...emptyFilters });
  const licName = (id: string) => content.licenses.find(l => l.id === id)?.name ?? id;

  return (
    <section id="beat-store" className={s.store} aria-labelledby="store-title">
      <header className={s.sectionHead}>
        <p className={s.kicker}>Beat Store <DemoBadge>Catalogo DEMO</DemoBadge></p>
        <h2 id="store-title">Ascolta, scegli la licenza, simula l’ordine.</h2>
        <p>Beat dimostrativi con anteprime originali generate nel browser. Prezzi e licenze sono di esempio; nessun pagamento reale.</p>
      </header>

      <div className={s.storeTools}>
        <label className={s.search}>
          <Search size={18} aria-hidden="true" />
          <span className={s.srOnly}>Cerca beat</span>
          <input type="search" placeholder="Cerca titolo, genere, mood, tonalità…" value={f.query} onChange={e => set("query", e.target.value)} />
        </label>
        <button type="button" className={s.btnGhost} aria-expanded={showFilters} aria-controls="beat-filters" onClick={() => setShowFilters(v => !v)}>
          <SlidersHorizontal size={16} /> Filtri
        </button>
        <label className={s.sortSel}>
          <span>Ordina</span>
          <select value={f.sort} onChange={e => set("sort", e.target.value as SortKey)}>
            {SORTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      </div>

      <div id="beat-filters" className={s.filters} data-open={showFilters || undefined}>
        <label>Genere<select value={f.genre} onChange={e => set("genre", e.target.value)}><option value="">Tutti</option>{opts.genres.map(g => <option key={g}>{g}</option>)}</select></label>
        <label>Mood<select value={f.mood} onChange={e => set("mood", e.target.value)}><option value="">Tutti</option>{opts.moods.map(g => <option key={g}>{g}</option>)}</select></label>
        <label>Tonalità<select value={f.key} onChange={e => set("key", e.target.value)}><option value="">Tutte</option>{opts.keys.map(g => <option key={g}>{g}</option>)}</select></label>
        <label>BPM min<input type="number" inputMode="numeric" min={40} max={220} value={f.bpmMin ?? ""} onChange={e => set("bpmMin", num(e.target.value))} /></label>
        <label>BPM max<input type="number" inputMode="numeric" min={40} max={220} value={f.bpmMax ?? ""} onChange={e => set("bpmMax", num(e.target.value))} /></label>
        <label>Prezzo fino a
          <select value={f.priceMax ?? ""} onChange={e => set("priceMax", num(e.target.value))}>
            <option value="">Qualsiasi</option>
            {[3000, 5000, 10000].map(v => <option key={v} value={v}>{formatEuro(v)}</option>)}
          </select>
        </label>
        <button type="button" className={s.btnText} onClick={() => setF(emptyFilters)} disabled={!active}><RotateCcw size={14} /> Azzera filtri</button>
      </div>

      <p className={s.resultCount} role="status" aria-live="polite">{list.length === 1 ? "1 beat" : `${list.length} beat`}</p>

      {list.length === 0 ? (
        <div className={s.empty}>
          <p>Nessun beat corrisponde ai filtri scelti.</p>
          <button type="button" className={s.btnPrimary} onClick={() => setF(emptyFilters)}>Mostra tutto il catalogo</button>
        </div>
      ) : (
        <ul className={s.beatGrid}>
          {list.map(b => {
            const from = priceFrom(b, content.licenses);
            return (
              <li key={b.id} className={s.beatCard}>
                <div className={s.beatCoverWrap}>
                  <BeatCover beat={b} />
                  <PlayButton beat={b} queue={queue} size={22} className={s.coverPlay} />
                  <span className={s.coverBadge}><DemoBadge /></span>
                </div>
                <div className={s.beatInfo}>
                  <h3>{b.title}</h3>
                  <p className={s.beatMeta}>{b.genre} · {b.bpm} BPM · {b.key}</p>
                  <p className={s.tags}>{b.mood.map(m => <span key={m}>{m}</span>)}</p>
                  <p className={s.licBadges} aria-label="Licenze disponibili">{b.licenses.map(id => <span key={id}>{licName(id)}</span>)}</p>
                  <div className={s.beatFoot}>
                    <span className={s.price}>{from != null ? <>da <strong>{formatEuro(from)}</strong></> : "Su richiesta"}</span>
                    <button type="button" className={s.btnSmall} onClick={() => open({ type: "beat", id: b.id })}>Licenze<span className={s.srOnly}> per {b.title}</span></button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
