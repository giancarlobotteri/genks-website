export const site = {
  name: "GENKS",
  description:
    "The sound of GENKS. Explore underground beats, find your next sound, and connect for custom music production.",
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
    { label: "Home", href: "/" },
    { label: "Beat store", href: "/beats" },
    { label: "Book / services", href: "/services" },
    { label: "Library", href: "/account/library" },
    { label: "About", href: "/#about" },
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
