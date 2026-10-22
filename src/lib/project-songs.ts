import { projectPrice } from "./service-rates.ts";
import {discountPrice,type PublicDiscount} from "./public-discounts.ts";

export const maxProjectSongs = 20;
export type ProjectSong = { service?:string; trackTitle: string; trackCount: number; description: string; referenceLinks: string; notes: string; desiredDeadline: string };
export type PricedProjectSong = ProjectSong & { amountCents: number };
export function emptyProjectSong(): ProjectSong {
  return { trackTitle: "", trackCount: 1, description: "", referenceLinks: "", notes: "", desiredDeadline: "" };
}
export function priceProjectSongs(service: string, input: unknown, discounts:PublicDiscount[]=[]): PricedProjectSong[] | null {
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
    if (song.service !== undefined && typeof song.service !== "string") return null;
    const selected = typeof song.service === "string" ? song.service : service;
    const price = typeof song.trackCount === "number" ? projectPrice(selected, song.trackCount) : null;
    if (price === null) return null;
    result.push({ service:selected,trackTitle: title, trackCount: song.trackCount as number, description, referenceLinks: song.referenceLinks as string, notes: song.notes as string, desiredDeadline: deadline, amountCents: discountPrice(price,[selected,"projects","services"],discounts) });
  }
  return result;
}
