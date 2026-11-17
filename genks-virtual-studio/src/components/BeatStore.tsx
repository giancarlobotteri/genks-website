import { ChevronLeft, ChevronRight, Pause, Play, Search, SlidersHorizontal, RotateCcw, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
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

const phoneMq = "(max-width: 560px)";
const subscribeMq = (cb: () => void) => { const m = window.matchMedia(phoneMq); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); };
const usePhone = () => useSyncExternalStore(subscribeMq, () => window.matchMedia(phoneMq).matches, () => false);

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

  // Paged catalogue: a compact "crate" of beats instead of an endless list.
  const phone = usePhone();
  const per = phone ? 4 : 6;
  const pages = Math.max(1, Math.ceil(list.length / per));
  const [pageWanted, setPage] = useState(0);
  const [dir, setDir] = useState(1);
  const page = Math.min(pageWanted, pages - 1);
  const shown = list.slice(page * per, page * per + per);
  const goPage = (n: number) => {
    const next = (n + pages) % pages;
    if (next === page) return;
    setDir(next > page || (page === pages - 1 && next === 0) ? 1 : -1);
    setPage(next);
  };
  const setFilter: typeof set = (k, v) => { setPage(0); set(k, v); };
  const touch = useRef<number | null>(null);
  // cards appear with a staggered wave the first time the catalogue scrolls into view
  const gridWrap = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = gridWrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section id="beat-store" className={s.store} aria-labelledby="store-title">
      <div className={s.storeBg} aria-hidden="true" />
      <header className={s.sectionHead}>
        <p className={s.kicker}>Beat Store <DemoBadge>Catalogo DEMO</DemoBadge></p>
        <h2 id="store-title">Ascolta, scegli la licenza, simula l’ordine.</h2>
        <p>Beat dimostrativi con anteprime originali generate nel browser. Prezzi e licenze sono di esempio; nessun pagamento reale.</p>
      </header>

      <div className={s.storeTools}>
        <label className={s.search}>
          <Search size={18} aria-hidden="true" />
          <span className={s.srOnly}>Cerca beat</span>
          <input type="search" placeholder="Cerca titolo, genere, mood, tonalità…" value={f.query} onChange={e => setFilter("query", e.target.value)} />
        </label>
        <button type="button" className={s.btnGhost} aria-expanded={showFilters} aria-controls="beat-filters" onClick={() => setShowFilters(v => !v)}>
          <SlidersHorizontal size={16} /> Filtri
        </button>
        <label className={s.sortSel}>
          <span>Ordina</span>
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
        <button type="button" className={s.btnText} onClick={() => { setPage(0); setF(emptyFilters); }} disabled={!active}><RotateCcw size={14} /> Azzera filtri</button>
      </div>

      <p className={s.resultCount} role="status" aria-live="polite">{list.length === 1 ? "1 beat" : `${list.length} beat`}{pages > 1 ? ` · pagina ${page + 1} di ${pages}` : ""}</p>

      {list.length === 0 ? (
        <div className={s.empty}>
          <p>Nessun beat corrisponde ai filtri scelti.</p>
          <button type="button" className={s.btnPrimary} onClick={() => setF(emptyFilters)}>Mostra tutto il catalogo</button>
        </div>
      ) : (
        <div ref={gridWrap} className={s.crate} data-seen={seen || undefined}
          onTouchStart={e => { touch.current = e.touches[0].clientX; }}
          onTouchEnd={e => { if (touch.current == null) return; const dx = e.changedTouches[0].clientX - touch.current; touch.current = null; if (Math.abs(dx) > 50) goPage(page + (dx < 0 ? 1 : -1)); }}>
        <ul key={`${page}-${per}-${list.length}`} className={s.beatGrid} data-dir={dir} aria-label={`Beat, pagina ${page + 1} di ${pages}`}>
          {shown.map((b, i) => {
            const from = priceFrom(b, content.licenses);
            return (
              <li key={b.id} className={s.beatCard} style={{ ["--i" as string]: i }}>
                <div className={s.beatCoverWrap}>
                  <BeatCover beat={b} />
                  <PlayButton beat={b} queue={queue} size={22} className={s.coverPlay} />
                  {player.currentId === b.id && player.playing && <span className={s.coverEq} aria-hidden="true">{[0, 1, 2, 3].map(k => <i key={k} style={{ ["--i" as string]: k }} />)}</span>}
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
        {pages > 1 && (
          <nav className={s.pager} aria-label="Pagine del catalogo">
            <button type="button" className={s.iconBtn} onClick={() => goPage(page - 1)} aria-label="Pagina precedente"><ChevronLeft size={20} /></button>
            <ol>
              {Array.from({ length: pages }, (_, n) => (
                <li key={n}><button type="button" aria-current={n === page ? "page" : undefined} aria-label={`Pagina ${n + 1}`} onClick={() => goPage(n)}><span>{n + 1}</span></button></li>
              ))}
            </ol>
            <button type="button" className={s.iconBtn} onClick={() => goPage(page + 1)} aria-label="Pagina successiva"><ChevronRight size={20} /></button>
          </nav>
        )}
        </div>
      )}
    </section>
  );
}
