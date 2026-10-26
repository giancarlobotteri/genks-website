// Existing agreements retain their saved price; this version applies to new bookings.
export const serviceRateVersion = "2026-10-26-recording-v8";
export const projectRateVersion = "2026-10-26-project-v8";
export const recordingHourlyCents = 1999;
export const projectRates = { mix: 5999, master: 2999, mix_master: 7999 } as const;
export type ProjectService = keyof typeof projectRates;
export const projectTiers = [
  { min: 1, max: 8, mix: 5999, mix_master: 7999 },
  { min: 9, max: 24, mix: 8999, mix_master: 10499 },
  { min: 25, max: 48, mix: 13999, mix_master: 14999 },
] as const;
export function projectPrice(service: string, tracks: number): number | null {
  if (!Number.isInteger(tracks) || tracks < 1) return null;
  if (service === "master") return tracks === 1 ? projectRates.master : null;
  if (service !== "mix" && service !== "mix_master") return null;
  const tier = projectTiers.find(t => tracks >= t.min && tracks <= t.max);
  return tier ? tier[service] : null;
}
export const projectDelivery = "Prima versione entro 7 giorni lavorativi dal giorno successivo a pagamento, ricezione di tutti i file e avvio consentito del servizio. Sono escluse festività italiane e fine settimana. Una revisione inclusa per lavorazione e per brano.";
export const serviceAmount = (cents: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(cents / 100);
