const premiumKinds = new Set(["mp3", "wav", "stems"]);

export function offerReadiness(input: {
  contract: string | null; includedAssets: unknown; availableKinds: string[]; hasPreview: boolean;
}) {
  const reasons: string[] = [];
  if (!input.contract?.trim() || /bozza da completare/i.test(input.contract)) reasons.push("Contratto della licenza da completare");
  if (!input.hasPreview) reasons.push("Anteprima audio mancante");
  const required = Array.isArray(input.includedAssets) ? input.includedAssets.filter((value): value is string => typeof value === "string") : [];
  if (!required.length || required.some(kind => !premiumKinds.has(kind))) reasons.push("Formati della licenza da configurare");
  for (const kind of required) if (!input.availableKinds.includes(kind)) reasons.push(`File ${kind.toUpperCase()} mancante`);
  return { ready: reasons.length === 0, reasons };
}
