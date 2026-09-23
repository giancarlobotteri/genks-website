import type { Beat } from "../types/domain.ts";

export interface CatalogFilters {
  query: string;
  genre: string;
  mood: string;
  bpm: string;
  key: string;
  favoritesOnly: boolean;
}
export const defaultFilters: CatalogFilters = {
  query: "",
  genre: "All",
  mood: "All",
  bpm: "All",
  key: "All",
  favoritesOnly: false,
};

export function filterBeats(
  beats: Beat[],
  filters: CatalogFilters,
  favorites: string[] = [],
): Beat[] {
  const query = filters.query.trim().toLocaleLowerCase();
  return beats.filter((beat) => {
    if (beat.status !== "published") return false;
    if (
      query &&
      !`${beat.title} ${beat.genre} ${beat.mood} ${beat.key}`
        .toLocaleLowerCase()
        .includes(query)
    )
      return false;
    if (filters.genre !== "All" && filters.genre !== beat.genre) return false;
    if (filters.mood !== "All" && filters.mood !== beat.mood) return false;
    if (filters.key !== "All" && filters.key !== beat.key) return false;
    if (filters.bpm === "under120" && beat.bpm >= 120) return false;
    if (filters.bpm === "120to139" && (beat.bpm < 120 || beat.bpm >= 140))
      return false;
    if (filters.bpm === "140plus" && beat.bpm < 140) return false;
    return !filters.favoritesOnly || favorites.includes(beat.id);
  });
}
