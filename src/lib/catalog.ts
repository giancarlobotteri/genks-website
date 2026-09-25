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

const STOP_WORDS = new Set([
  "a", "ad", "al", "alla", "anche", "base", "beat", "beats", "cerco", "che", "con", "da", "dei", "del", "della", "di", "e", "fare", "for", "i", "il", "in", "la", "le", "lo", "mi", "my", "of", "per", "piu", "the", "tipo", "to", "una", "un", "uno", "vorrei", "voglio", "with",
]);

const GENRE_TERMS: Record<string, string[]> = {
  trap: ["trap"],
  "r&b": ["r&b", "rnb", "rhythm blues"],
  afro: ["afro", "afrobeats", "afrobeat", "afropop"],
  reggae: ["reggae", "dancehall", "jamaican"],
  pop: ["pop", "commerciale", "radiofonico"],
  "rap/hiphop": ["rap", "hiphop", "hip hop", "boom bap", "boombap"],
  experimental: ["experimental", "sperimentale", "alternativo", "alternative"],
  drill: ["drill"],
};

const MOOD_TERMS: Record<string, string[]> = {
  dark: ["dark", "scuro", "scura", "cupo", "cupa", "notturno", "notturna", "night", "misterioso", "misteriosa", "sinistro", "sinistra"],
  floating: ["floating", "dreamy", "sognante", "ambient", "spaziale", "spacey", "etereo", "eterea", "chill", "rilassato", "rilassata"],
  melodic: ["melodic", "melodico", "melodica", "emotional", "emozionale", "triste", "sad", "malinconico", "malinconica", "romantico", "romantica", "piano", "guitar", "chitarra"],
  hard: ["hard", "aggressive", "aggressivo", "aggressiva", "pesante", "energetico", "energetica", "banger", "cattivo", "cattiva", "potente"],
};

export interface BeatRecommendation {
  score: number;
  percent: number;
  reasons: string[];
  meaningful: boolean;
}

function normalize(value: string) {
  return value.toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9&]+/g, " ").trim();
}

function includesTerm(query: string, terms: string[]) {
  return terms.some((term) => query.includes(normalize(term)));
}

export function recommendBeat(beat: Beat, rawQuery: string): BeatRecommendation {
  const query = normalize(rawQuery);
  const tokens = query.split(/\s+/).filter((token) => token.length > 1 && !STOP_WORDS.has(token));
  const title = normalize(beat.title);
  const genre = normalize(beat.genre);
  const mood = normalize(beat.mood);
  const description = normalize(beat.description);
  const key = normalize(beat.key);
  const haystack = `${title} ${genre} ${mood} ${description} ${key}`;
  let score = query && haystack.includes(query) ? 28 : 0;
  const reasons = new Set<string>();

  for (const token of tokens) {
    if (title.includes(token)) { score += 12; reasons.add("title"); }
    if (genre.includes(token)) { score += 16; reasons.add(beat.genre); }
    if (mood.includes(token)) { score += 14; reasons.add(beat.mood); }
    if (description.includes(token)) { score += 7; reasons.add("vibe"); }
    if (key === token) { score += 5; reasons.add(beat.key); }
  }

  for (const [targetGenre, terms] of Object.entries(GENRE_TERMS)) {
    if (includesTerm(query, terms) && genre === normalize(targetGenre)) {
      score += 24;
      reasons.add(beat.genre);
    }
  }
  for (const [targetMood, terms] of Object.entries(MOOD_TERMS)) {
    if (includesTerm(query, terms) && mood === targetMood) {
      score += 21;
      reasons.add(beat.mood);
    }
  }

  const requestedBpm = query.match(/\b(\d{2,3})\s*bpm\b/)?.[1];
  if (requestedBpm) {
    const distance = Math.abs(beat.bpm - Number(requestedBpm));
    const tempoScore = Math.max(0, 20 - Math.round(distance / 2));
    score += tempoScore;
    if (tempoScore >= 10) reasons.add(`${beat.bpm} BPM`);
  } else if (includesTerm(query, ["lento", "slow", "calmo", "relaxed"])) {
    const tempoScore = beat.bpm <= 115 ? 17 : beat.bpm <= 130 ? 7 : 0;
    score += tempoScore;
    if (tempoScore) reasons.add(`${beat.bpm} BPM`);
  } else if (includesTerm(query, ["veloce", "fast", "rapido", "uptempo"])) {
    const tempoScore = beat.bpm >= 140 ? 17 : beat.bpm >= 125 ? 7 : 0;
    score += tempoScore;
    if (tempoScore) reasons.add(`${beat.bpm} BPM`);
  }

  const meaningful = tokens.length > 0 || Boolean(requestedBpm);
  return {
    score,
    percent: score > 0 ? Math.min(98, 54 + Math.round(score * .72)) : 0,
    reasons: [...reasons].slice(0, 3),
    meaningful,
  };
}

export function filterBeats(
  beats: Beat[],
  filters: CatalogFilters,
  favorites: string[] = [],
): Beat[] {
  const query = filters.query.trim();
  return beats.filter((beat) => {
    if (beat.status !== "published") return false;
    const recommendation = recommendBeat(beat, query);
    if (query && recommendation.meaningful && recommendation.score <= 0) return false;
    if (
      filters.genre !== "All" &&
      filters.genre.toLocaleLowerCase() !== beat.genre.toLocaleLowerCase()
    ) return false;
    if (filters.mood !== "All" && filters.mood !== beat.mood) return false;
    if (filters.key !== "All" && filters.key !== beat.key) return false;
    if (filters.bpm === "under120" && beat.bpm >= 120) return false;
    if (filters.bpm === "120to139" && (beat.bpm < 120 || beat.bpm >= 140))
      return false;
    if (filters.bpm === "140plus" && beat.bpm < 140) return false;
    return !filters.favoritesOnly || favorites.includes(beat.id);
  });
}
