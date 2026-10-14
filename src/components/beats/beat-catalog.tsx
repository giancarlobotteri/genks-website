"use client";
import { italianLabel } from "@/lib/italian";

import Image from "next/image";
import { useId, useState, type CSSProperties } from "react";
import { ArrowDownUp, Heart, Search, ShoppingBag, SlidersHorizontal, X } from "lucide-react";
import { useCart } from "@/features/cart/cart-provider";
import { usePlayer } from "@/features/player/player-provider";
import { useWishlist } from "@/features/wishlist/use-wishlist";
import {
  defaultFilters,
  filterBeats,
  recommendBeat,
  type CatalogFilters,
} from "@/lib/catalog";
import { PlayButton } from "./play-button";
import { FavoriteButton } from "./favorite-button";
import { LicenseButton } from "./license-button";
import type { Beat } from "@/types/domain";

export function BeatCatalog({ beats }: { beats: Beat[] }) {
  const [filters, setFilters] = useState<CatalogFilters>(defaultFilters);
  const [expanded, setExpanded] = useState(false);
  const [sort, setSort] = useState("curated");
  const { favorites } = useWishlist();
  const { add } = useCart();
  const { currentBeat, isPlaying } = usePlayer();
  const filtersId = useId();
  const filtered = filterBeats(beats, filters, favorites);
  const recommendations = new Map(filtered.map((beat) => [beat.id, recommendBeat(beat, filters.query)]));
  const smartSearchActive = filters.query.trim().length > 1 && [...recommendations.values()].some((match) => match.meaningful);
  const visible =
    sort === "bpm"
      ? [...filtered].sort((a, b) => a.bpm - b.bpm)
      : sort === "title"
        ? [...filtered].sort((a, b) => a.title.localeCompare(b.title))
        : smartSearchActive
          ? [...filtered].sort((a, b) => (recommendations.get(b.id)?.score ?? 0) - (recommendations.get(a.id)?.score ?? 0))
          : filtered;
  const activeCount = [filters.genre, filters.mood, filters.bpm, filters.key].filter(
    (value) => value !== "All",
  ).length;
  const setFilter = <K extends keyof CatalogFilters>(
    key: K,
    value: CatalogFilters[K],
  ) => setFilters((current) => ({ ...current, [key]: value }));

  return (
    <div className="beat-catalog">
      <div className="catalog-discovery">
        <div><span className="catalog-kicker">SCEGLI LA TUA FREQUENZA</span><p>Un beat. Infinite direzioni.</p><span>Acquista un singolo beat oppure crea la tua selezione nel carrello.</span></div>
        <div className="catalog-spectrum" aria-hidden="true">{[22,40,30,66,48,84,58,100,74,46,68,34,52,26].map((height,index)=><i key={index} style={{height:`${height}%`}} />)}</div>
      </div>
      <div className="catalog-toolbar">
        <label className="search-box">
          <Search size={20} aria-hidden="true" />
          <span className="sr-only">Cerca beat</span>
          <input
            type="search"
            aria-label="Cerca beat"
            placeholder={'Descrivi il tuo suono… “R&B scuro e melodico”'}
            value={filters.query}
            onChange={(event) => setFilter("query", event.target.value)}
          />
          {filters.query && (
            <button
              type="button"
              className="icon-button"
              aria-label="Cancella la ricerca"
              onClick={() => setFilter("query", "")}
            >
              <X size={16} />
            </button>
          )}
        </label>
        {smartSearchActive ? <span className="smart-search-status" role="status">RICERCA INTELLIGENTE</span> : null}
        <button
          type="button"
          className={`filter-toggle ${expanded || activeCount ? "selected" : ""}`}
          aria-expanded={expanded}
          aria-controls={filtersId}
          onClick={() => setExpanded(!expanded)}
        >
          <SlidersHorizontal size={17} />
          Filtri{activeCount > 0 && <span>{activeCount}</span>}
        </button>
        <button
          type="button"
          className={`filter-toggle favorites-filter ${filters.favoritesOnly ? "selected" : ""}`}
          aria-pressed={filters.favoritesOnly}
          onClick={() => setFilter("favoritesOnly", !filters.favoritesOnly)}
        >
          <Heart
            size={17}
            fill={filters.favoritesOnly ? "currentColor" : "none"}
          />
          <span>Preferiti</span>
          <span className="mono">{favorites.length}</span>
        </button>
      </div>
      <div id={filtersId} className="advanced-filters" hidden={!expanded}>
        <label>
          Genere
          <select value={filters.genre} onChange={event => setFilter("genre", event.target.value)}>
            <option value="All">Tutti i generi</option>
            {[...new Set(beats.map(beat => beat.genre))].sort().map(genre => <option key={genre} value={genre}>{italianLabel(genre)}</option>)}
          </select>
        </label>
        <label>
          Atmosfera
          <select
            value={filters.mood}
            onChange={(event) => setFilter("mood", event.target.value)}
          >
            <option value="All">Tutte le atmosfere</option>
            {[...new Set(beats.map((beat) => beat.mood))].map((mood) => (
              <option key={mood} value={mood}>{italianLabel(mood)}</option>
            ))}
          </select>
        </label>
        <label>
          BPM
          <select
            value={filters.bpm}
            onChange={(event) => setFilter("bpm", event.target.value)}
          >
            <option value="All">Qualsiasi velocità</option>
            <option value="under120">Meno di 120 BPM</option>
            <option value="120to139">120–139 BPM</option>
            <option value="140plus">140+ BPM</option>
          </select>
        </label>
        <label>
          Tonalità
          <select
            value={filters.key}
            onChange={(event) => setFilter("key", event.target.value)}
          >
            <option value="All">Qualsiasi tonalità</option>
            {[...new Set(beats.map((beat) => beat.key))].map((key) => (
              <option key={key}>{key}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="text-link"
          onClick={() => setFilters(defaultFilters)}
        >
          Azzera i filtri <X size={15} />
        </button>
      </div>
      <div className="catalog-subtoolbar">
        <label className="sort-select">
          <ArrowDownUp size={14} />
          <span className="sr-only">Ordina i beat</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="curated">{smartSearchActive ? "Più pertinenti" : "Selezione GENKS"}</option>
            <option value="bpm">BPM: dal più lento</option>
            <option value="title">Titolo: A–Z</option>
          </select>
        </label>
      </div>
      <div className="catalog-table" role="table" aria-label="Catalogo dei beat">
        <div className="beat-table-header" role="row">
          <span role="columnheader">#</span>
          <span role="columnheader">BRANO</span>
          <span role="columnheader">BPM / TONALITÀ</span>
          <span role="columnheader">ATMOSFERA</span>
          <span role="columnheader">LICENZA DA</span>
        </div>
        {visible.map((beat, index) => (
          <div
            className={`beat-row ${currentBeat?.id === beat.id ? "active" : ""}`}
            style={{ "--beat-accent": ["#70a9ff", "#5591ec", "#92c6ff", "#497ad1"][index % 4] } as CSSProperties}
            key={beat.id}
            role="row"
          >
            <div className="row-number" role="cell">
              {currentBeat?.id === beat.id && isPlaying ? (
                <span className="equalizer" aria-label="In riproduzione">
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
              ) : (
                <span className="mono">
                  {String(index + 1).padStart(2, "0")}
                </span>
              )}
            </div>
            <div className="row-track" role="cell">
              <div className="row-art">
                <Image src={beat.cover} alt="" width={64} height={64} />
                <PlayButton beat={beat} queue={visible} />
              </div>
              <div>
                <h3>{beat.title}</h3>
                <span className="row-subtitle">
                  GENKS <span>·</span> {italianLabel(beat.genre)}
                  <span className="mobile-metadata">
                    {" "}
                    · {beat.bpm} BPM · {beat.key}
                  </span>
                </span>
                {smartSearchActive && (recommendations.get(beat.id)?.score ?? 0) > 0 ? <span className="smart-match-badge" title={`Affinità per ${recommendations.get(beat.id)?.reasons.join(", ") || "profilo sonoro"}`}>
                  {recommendations.get(beat.id)?.percent}% AFFINITÀ
                </span> : null}
              </div>
            </div>
            <div className="row-tempo" role="cell">
              <span>
                {beat.bpm} <small>BPM</small>
              </span>
              <span>{beat.key}</span>
            </div>
            <div className="row-vibe" role="cell">
              <span className="mood-tag">{italianLabel(beat.mood)}</span>
            </div>
            <div className="row-actions" role="cell">
              <FavoriteButton beat={beat} />
              <button type="button" className="cart-add-button" aria-label={`Aggiungi ${beat.title} al carrello`} onClick={(event) => add(beat, event.currentTarget.getBoundingClientRect())}>
                <ShoppingBag size={17} /><span>Aggiungi</span>
              </button>
              <LicenseButton beat={beat} compact />
            </div>
          </div>
        ))}
      </div>
      {!visible.length && (
        <div className="empty-state">
          <Search size={28} />
          <h3>
            {filters.favoritesOnly
              ? "Nessun preferito corrisponde alla ricerca."
              : "Cerchiamo un’altra frequenza."}
          </h3>
          <p>
            {filters.favoritesOnly
              ? "Salva un beat con il cuore oppure modifica i filtri."
              : "Prova un’altra ricerca oppure modifica i filtri."}
          </p>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => setFilters(defaultFilters)}
          >
            Mostra tutti i beat
          </button>
        </div>
      )}
      <div className="catalog-footnote">
        <span role="status" aria-live="polite">
          {visible.length} {visible.length === 1 ? "beat" : "beat"}
          {filters.favoritesOnly
            ? " · Salvati su questo dispositivo"
            : " nel catalogo"}
        </span>
        <span>Dettagli della licenza e prezzo finale sono mostrati prima del pagamento</span>
      </div>
    </div>
  );
}
