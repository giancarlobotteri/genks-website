// Keep this version aligned with the database reservation function. Stale prices are rejected.
export const serviceRateVersion = "2026-10-20-v2";
export const recordingHourlyCents = 2000;
export const projectRates = { mix: 10000, master: 4000, mix_master: 12000 } as const;
export const serviceAmount = (cents: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(cents / 100);
