export const site = {
  name: "GENKS",
  description:
    "Mix, master e registrazione per rap, trap e R&B. In studio a Perugia o a distanza, da ovunque.",
  instagram:
    process.env.NEXT_PUBLIC_GENKS_INSTAGRAM ||
    "https://www.instagram.com/prodbygenks/",
  tiktok:
    process.env.NEXT_PUBLIC_GENKS_TIKTOK ||
    "https://www.tiktok.com/@prodbygenks",
  youtube:
    process.env.NEXT_PUBLIC_GENKS_YOUTUBE ||
    "https://www.youtube.com/@prodbygenks",
  whatsapp: process.env.NEXT_PUBLIC_GENKS_WHATSAPP || "+393450236299",
  navigation: [
    { label: "Inizio", href: "/#home" },
    { label: "Negozio di beat", href: "/beats" },
    { label: "Prenotazioni e servizi", href: "/services" },
    { label: "Raccolta", href: "/account/library" },
    { label: "Chi sono", href: "/#about" },
  ],
} as const;

export function getSiteOrigin(): URL | undefined {
  const value = process.env.NEXT_PUBLIC_SITE_URL;
  if (!value) return new URL("http://localhost:3000");
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url : undefined;
  } catch {
    return undefined;
  }
}
