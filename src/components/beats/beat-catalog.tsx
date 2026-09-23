"use client";

import Image from "next/image";
import { useId, useState } from "react";
import { ArrowDownUp, Heart, Search, SlidersHorizontal, X } from "lucide-react";
import { usePlayer } from "@/features/player/player-provider";
import { useWishlist } from "@/features/wishlist/use-wishlist";
import {
  defaultFilters,
  filterBeats,
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
  const { currentBeat, isPlaying } = usePlayer();
  const filtersId = useId();
  const filtered = filterBeats(beats, filters, favorites);
  const visible =
    sort === "bpm"
      ? [...filtered].sort((a, b) => a.bpm - b.bpm)
      : sort === "title"
        ? [...filtered].sort((a, b) => a.title.localeCompare(b.title))
        : filtered;
  const activeCount = [filters.mood, filters.bpm, filters.key].filter(
    (value) => value !== "All",
  ).length;
  const setFilter = <K extends keyof CatalogFilters>(
    key: K,
    value: CatalogFilters[K],
  ) => setFilters((current) => ({ ...current, [key]: value }));

  return (
    <div className="beat-catalog">
      <div className="catalog-toolbar">
        <label className="search-box">
          <Search size={20} aria-hidden="true" />
          <span className="sr-only">Search beats</span>
          <input
            type="search"
            aria-label="Search beats"
            placeholder="Find your sound…"
            value={filters.query}
            onChange={(event) => setFilter("query", event.target.value)}
          />
          {filters.query && (
            <button
              type="button"
              className="icon-button"
              aria-label="Clear search"
              onClick={() => setFilter("query", "")}
            >
              <X size={16} />
            </button>
          )}
        </label>
        <button
          type="button"
          className={`filter-toggle ${expanded || activeCount ? "selected" : ""}`}
          aria-expanded={expanded}
          aria-controls={filtersId}
          onClick={() => setExpanded(!expanded)}
        >
          <SlidersHorizontal size={17} />
          Filters{activeCount > 0 && <span>{activeCount}</span>}
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
          <span>Saved</span>
          <span className="mono">{favorites.length}</span>
        </button>
      </div>
      <div id={filtersId} className="advanced-filters" hidden={!expanded}>
        <label>
          Mood
          <select
            value={filters.mood}
            onChange={(event) => setFilter("mood", event.target.value)}
          >
            <option value="All">All moods</option>
            {[...new Set(beats.map((beat) => beat.mood))].map((mood) => (
              <option key={mood}>{mood}</option>
            ))}
          </select>
        </label>
        <label>
          BPM
          <select
            value={filters.bpm}
            onChange={(event) => setFilter("bpm", event.target.value)}
          >
            <option value="All">Any tempo</option>
            <option value="under120">Below 120 BPM</option>
            <option value="120to139">120–139 BPM</option>
            <option value="140plus">140+ BPM</option>
          </select>
        </label>
        <label>
          Key
          <select
            value={filters.key}
            onChange={(event) => setFilter("key", event.target.value)}
          >
            <option value="All">Any key</option>
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
          Reset filters <X size={15} />
        </button>
      </div>
      <div className="catalog-subtoolbar">
        <div
          className="genre-filters"
          role="group"
          aria-label="Filter by genre"
        >
          {["All", "Trap", "R&B", "Drill", "Afro"].map((genre) => (
            <button
              key={genre}
              type="button"
              className={
                filters.genre === genre ? "genre-pill active" : "genre-pill"
              }
              aria-pressed={filters.genre === genre}
              onClick={() => setFilter("genre", genre)}
            >
              {genre === "All" ? "All sounds" : genre}
            </button>
          ))}
        </div>
        <label className="sort-select">
          <ArrowDownUp size={14} />
          <span className="sr-only">Sort beats</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="curated">Curated</option>
            <option value="bpm">BPM: low to high</option>
            <option value="title">Title: A–Z</option>
          </select>
        </label>
      </div>
      <div className="catalog-table" role="table" aria-label="Beat catalog">
        <div className="beat-table-header" role="row">
          <span role="columnheader">#</span>
          <span role="columnheader">TRACK</span>
          <span role="columnheader">BPM / KEY</span>
          <span role="columnheader">VIBE</span>
          <span role="columnheader">LICENSE FROM</span>
        </div>
        {visible.map((beat, index) => (
          <div
            className={`beat-row ${currentBeat?.id === beat.id ? "active" : ""}`}
            key={beat.id}
            role="row"
          >
            <div className="row-number" role="cell">
              {currentBeat?.id === beat.id && isPlaying ? (
                <span className="equalizer" aria-label="Now playing">
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
                  GENKS <span>·</span> {beat.genre}
                  <span className="mobile-metadata">
                    {" "}
                    · {beat.bpm} BPM · {beat.key}
                  </span>
                </span>
              </div>
            </div>
            <div className="row-tempo" role="cell">
              <span>
                {beat.bpm} <small>BPM</small>
              </span>
              <span>{beat.key}</span>
            </div>
            <div className="row-vibe" role="cell">
              <span className="mood-tag">{beat.mood}</span>
            </div>
            <div className="row-actions" role="cell">
              <FavoriteButton beat={beat} />
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
              ? "No saved beats match."
              : "A different frequency."}
          </h3>
          <p>
            {filters.favoritesOnly
              ? "Save a beat with the heart button, or adjust your filters."
              : "Try a different search or open up your filters."}
          </p>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => setFilters(defaultFilters)}
          >
            Show all beats
          </button>
        </div>
      )}
      <div className="catalog-footnote">
        <span role="status" aria-live="polite">
          {visible.length} {visible.length === 1 ? "beat" : "beats"}
          {filters.favoritesOnly
            ? " · Saved on this device"
            : " in the collection"}
        </span>
        <span>License details and final price are shown before checkout</span>
      </div>
    </div>
  );
}
