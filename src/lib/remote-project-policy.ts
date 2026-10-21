export function remoteProjectCardAllowed(input: { enabled: boolean; type: string; mode: string; service: string }) {
  return input.enabled && input.type === "project" && input.mode === "remote" && ["mix", "master", "mix_master"].includes(input.service);
}
