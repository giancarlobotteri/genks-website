import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { Navigation } from "@/components/layout/navigation";
import { CartRail } from "@/components/commerce/cart-rail";
import { Footer } from "@/components/layout/footer";
import { PersistentPlayer } from "@/components/player/persistent-player";
import { MotionObserver } from "@/components/ui/motion-observer";
import { AssetGuard } from "@/components/ui/asset-guard";
import { PlayerProvider } from "@/features/player/player-provider";
import { LicenseProvider } from "@/features/licenses/license-provider";
import { CartProvider } from "@/features/cart/cart-provider";
import { beatRepository, getLicenses } from "@/lib/repositories/beats";
import { getSiteOrigin, site } from "@/config/site";
import { privatePreview } from "@/lib/preview-mode";
import "./globals.css";
import "@fontsource/manrope/latin-400.css";
import "@fontsource/manrope/latin-600.css";
import "@fontsource/manrope/latin-700.css";

export const metadata: Metadata = {
  metadataBase: getSiteOrigin(),
  title: { default: "GENKS", template: "%s | GENKS" },
  description: site.description,
  applicationName: site.name,
  openGraph: {
    title: "GENKS",
    description: site.description,
    type: "website",
    locale: "it_IT",
    siteName: site.name,
  },
  twitter: {
    card: "summary_large_image",
    title: "GENKS — Produttore musicale",
    description: site.description,
  },
  icons: { icon: "/icon.svg" },
  robots: privatePreview ? { index: false, follow: false, noarchive: true } : undefined,
};
export const viewport: Viewport = {
  themeColor: "#050506",
  colorScheme: "dark",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await connection();
  const [beats, licenses] = await Promise.all([
    beatRepository.listPublished(),
    getLicenses(),
  ]);
  return (
    <html lang="it">
      <body>
        <a className="skip-link" href="#main-content">
          Vai al contenuto
        </a>
        <PlayerProvider catalog={beats}>
          <LicenseProvider licenses={licenses}>
            <CartProvider catalog={beats}>
              <Navigation />
              <CartRail />
              <main id="main-content" tabIndex={-1}>
                {children}
              </main>
              <Footer />
              <PersistentPlayer />
              <MotionObserver />
              <AssetGuard />
            </CartProvider>
          </LicenseProvider>
        </PlayerProvider>
      </body>
    </html>
  );
}
