import type { Beat, Bundle, CartItem, LicenseTier } from "../types.ts";

export type SortKey = "recommended" | "newest" | "price-asc" | "price-desc" | "bpm-asc" | "bpm-desc" | "title";

export type BeatFilters = {
  query: string;
  genre: string;
  mood: string;
  key: string;
  bpmMin: number | null;
  bpmMax: number | null;
  /** Max "from" price in cents; null = any. */
  priceMax: number | null;
  sort: SortKey;
};

export const emptyFilters: BeatFilters = {
  query: "", genre: "", mood: "", key: "", bpmMin: null, bpmMax: null, priceMax: null, sort: "recommended",
};

export function formatEuro(cents: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(cents / 100);
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Cheapest licence with a fixed price available for the beat (null if only on request). */
export function priceFrom(beat: Beat, licenses: LicenseTier[]): number | null {
  const prices = beat.licenses
    .map(id => licenses.find(l => l.id === id)?.price)
    .filter((p): p is number => typeof p === "number");
  return prices.length ? Math.min(...prices) : null;
}

export function publicBeats(beats: Beat[]) {
  return beats.filter(b => b.status === "published");
}

export function filterOptions(beats: Beat[]) {
  const uniq = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "it"));
  const list = publicBeats(beats);
  return {
    genres: uniq(list.map(b => b.genre)),
    moods: uniq(list.flatMap(b => b.mood)),
    keys: uniq(list.map(b => b.key)),
  };
}

export function filterBeats(beats: Beat[], licenses: LicenseTier[], f: BeatFilters): Beat[] {
  const q = fold(f.query);
  const out = publicBeats(beats).filter(b => {
    if (q && ![b.title, b.genre, b.key, ...b.mood].some(v => fold(v).includes(q))) return false;
    if (f.genre && b.genre !== f.genre) return false;
    if (f.mood && !b.mood.includes(f.mood)) return false;
    if (f.key && b.key !== f.key) return false;
    if (f.bpmMin != null && b.bpm < f.bpmMin) return false;
    if (f.bpmMax != null && b.bpm > f.bpmMax) return false;
    if (f.priceMax != null) {
      const p = priceFrom(b, licenses);
      if (p == null || p > f.priceMax) return false;
    }
    return true;
  });
  const price = (b: Beat) => priceFrom(b, licenses) ?? Number.POSITIVE_INFINITY;
  const sorters: Record<SortKey, (a: Beat, b: Beat) => number> = {
    recommended: () => 0,
    newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
    "price-asc": (a, b) => price(a) - price(b),
    "price-desc": (a, b) => price(b) - price(a),
    "bpm-asc": (a, b) => a.bpm - b.bpm,
    "bpm-desc": (a, b) => b.bpm - a.bpm,
    title: (a, b) => a.title.localeCompare(b.title, "it"),
  };
  return [...out].sort(sorters[f.sort]);
}

export type CartLine = { item: CartItem; beat: Beat; license: LicenseTier; price: number };

/** Resolve cart lines against current content; drops lines that are no longer purchasable. */
export function cartLines(items: CartItem[], beats: Beat[], licenses: LicenseTier[]): CartLine[] {
  return items.flatMap(item => {
    const beat = beats.find(b => b.id === item.beatId && b.status === "published");
    const license = licenses.find(l => l.id === item.licenseId);
    if (!beat || !license || license.price == null || !beat.licenses.includes(license.id)) return [];
    return [{ item, beat, license, price: license.price }];
  });
}

export function cartTotal(lines: CartLine[]) {
  return totalEnding99(lines.reduce((sum, l) => sum + l.price, 0));
}

/** Adds or replaces the licence for a beat (one licence per beat in the cart). */
export function upsertCart(items: CartItem[], next: CartItem): CartItem[] {
  return [...items.filter(i => i.beatId !== next.beatId), next];
}

/** Saving is shown only when price and list value are both configured and the saving is real. */
export function bundleSaving(b: Bundle): number | null {
  if (b.price == null || b.listValue == null) return null;
  const s = b.listValue - b.price;
  return s > 0 ? s : null;
}

export function visibleBundles(bundles: Bundle[]) {
  return bundles.filter(b => b.status !== "hidden");
}

/** Tracks covered by the lower rate: a beat in one stereo file plus the vocals. */
/**
 * Mix / master price list of GENKS (cents, per brano, any number of tracks).
 * Mix 69,99 €. Master 29,99 €. Mix & Master 89,99 € (10 € less than the two separately).
 */
export const AUDIO_PRICES = {
  mix: 6999,
  master: 2999,
  mixmaster: 8999,
} as const;
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- callers pass the track count; the price no longer depends on it
export function audioPrice(service: string, _tracks?: number): number {
  return AUDIO_PRICES[service as keyof typeof AUDIO_PRICES] ?? AUDIO_PRICES.mixmaster;
}
/** Every final total ends in ,99: whole euros lose one cent, other amounts move to the same euro + 99 cents. */
export function totalEnding99(cents: number): number {
  if (!Number.isSafeInteger(cents) || cents <= 0) return Math.max(0, cents);
  return cents % 100 === 0 ? cents - 1 : Math.floor(cents / 100) * 100 + 99;
}
