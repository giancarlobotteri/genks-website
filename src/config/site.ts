export const site = {
  name: "GENKS",
  description:
    "Il suono di GENKS. Esplora i beat, trova il suono per il tuo prossimo brano e richiedi una produzione musicale su misura.",
  instagram:
    process.env.NEXT_PUBLIC_GENKS_INSTAGRAM ||
    "https://www.instagram.com/prodbygenks/",
  tiktok:
    process.env.NEXT_PUBLIC_GENKS_TIKTOK ||
    "https://www.tiktok.com/@prodbygenks",
  youtube:
    process.env.NEXT_PUBLIC_GENKS_YOUTUBE ||
    "https://www.youtube.com/@prodbygenks",
  whatsapp: process.env.NEXT_PUBLIC_GENKS_WHATSAPP || "",
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
