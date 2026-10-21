export function remoteProjectCardAllowed(input: { enabled: boolean; type: string; mode: string; service: string }) {
  return input.enabled && input.type === "project" && ["remote", "studio"].includes(input.mode) && ["mix", "master", "mix_master"].includes(input.service);
}

export function projectPaymentMethod(mode: string, payment?: string): "card" | "cash" | null {
  if (!["remote", "studio"].includes(mode)) return null;
  const chosen = payment ?? (mode === "remote" ? "card" : "cash");
  if (chosen === "card") return "card";
  return chosen === "cash" && mode === "studio" ? "cash" : null;
}
