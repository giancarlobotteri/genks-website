// Supabase SDK versions may return either SVG markup or an already encoded data URL.
export function mfaQrImage(source: string): string {
  const value = source.trim();
  if (/^data:image\/svg\+xml[;,]/i.test(value)) return value;
  if (/^<svg[\s>]|^<\?xml\s/i.test(value)) return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(value)}`;
  throw new Error("Formato QR non valido.");
}
