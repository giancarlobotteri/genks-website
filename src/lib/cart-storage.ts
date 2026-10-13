import type { Beat, LicenseTier } from "../types/domain.ts";
export type StoredCartItem = { beat: Beat; selectedLicenseId: LicenseTier | null };
export function cartStorageKey(device: string, owner: string) { return `genks:cart:v2:${device}:${owner}`; }
export function restoreCart(raw: string | null, catalog: Beat[]): StoredCartItem[] {
  try {
    const saved: unknown = JSON.parse(raw || "[]");
    if (!Array.isArray(saved)) return [];
    const seen = new Set<string>();
    return saved.flatMap(value => {
      if (!value || typeof value !== "object" || typeof value.beatId !== "string" || seen.has(value.beatId)) return [];
      const beat = catalog.find(entry => entry.id === value.beatId);
      if (!beat) return [];
      seen.add(beat.id);
      return [{ beat, selectedLicenseId: beat.licenseIds.includes(value.selectedLicenseId) ? value.selectedLicenseId as LicenseTier : null }];
    });
  } catch { return []; }
}
