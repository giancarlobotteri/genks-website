export const extraTimePolicy = "Dopo mezzanotte, ogni 30 minuti comportano 10 € in più rispetto alla tariffa ordinaria di 20 €/ora (totale 40 €/ora). Il tempo viene calcolato in proporzione ai minuti effettivi.";
export function extraTimeCents(dayMinutes: number, nightMinutes: number) {
  return Math.round((dayMinutes * 2000 + nightMinutes * 4000) / 60);
}
