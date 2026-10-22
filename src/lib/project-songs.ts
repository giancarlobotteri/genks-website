import { projectPrice } from "./service-rates.ts";

export const maxProjectSongs = 20;
export type ProjectSong = { trackTitle: string; trackCount: number; description: string; referenceLinks: string; notes: string; desiredDeadline: string };
export type PricedProjectSong = ProjectSong & { amountCents: number };
export function emptyProjectSong(): ProjectSong {
  return { trackTitle: "", trackCount: 1, description: "", referenceLinks: "", notes: "", desiredDeadline: "" };
}
export function priceProjectSongs(service: string, input: unknown): PricedProjectSong[] | null {
  if (!Array.isArray(input) || input.length < 1 || input.length > maxProjectSongs) return null;
  const result: PricedProjectSong[] = [];
  for (const value of input) {
    if (!value || typeof value !== "object") return null;
    const song = value as Record<string, unknown>;
    if (["trackTitle", "description", "referenceLinks", "notes", "desiredDeadline"].some(key => typeof song[key] !== "string")) return null;
    const title = (song.trackTitle as string).trim();
    const description = (song.description as string).trim();
    const deadline = song.desiredDeadline as string;
    if (title.length < 1 || title.length > 160 || description.length < 10 || description.length > 4000 || (song.referenceLinks as string).length > 2000 || (song.notes as string).length > 2000) return null;
    if (deadline && (!/^\d{4}-\d{2}-\d{2}$/.test(deadline) || !Number.isFinite(Date.parse(deadline)) || new Date(deadline).toISOString().slice(0, 10) !== deadline)) return null;
    const price = typeof song.trackCount === "number" ? projectPrice(service, song.trackCount) : null;
    if (price === null) return null;
    result.push({ trackTitle: title, trackCount: song.trackCount as number, description, referenceLinks: song.referenceLinks as string, notes: song.notes as string, desiredDeadline: deadline, amountCents: price });
  }
  return result;
}
