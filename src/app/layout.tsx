import {homeStorefront} from '@/lib/home-storefront';
import ChatWidget from '@/components/ChatWidget';
import {UtilityDock} from "@/components/layout/utility-dock";
import { BEATS_ENABLED, CART_ENABLED } from "@/config/features";
import { InterestMemory } from "@/components/commerce/interest-memory";
import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { Navigation } from "@/components/layout/navigation";
import {getPublicDiscounts} from "@/lib/public-discounts-server";
import { CartRail } from "@/components/commerce/cart-rail";
import { Footer } from "@/components/layout/footer";
import { PersistentPlayer } from "@/components/player/persistent-player";
import { SiteAtmosphere } from "@/components/ui/site-atmosphere";
import { MotionObserver } from "@/components/ui/motion-observer";
import { AssetGuard } from "@/components/ui/asset-guard";
import { PlayerProvider } from "@/features/player/player-provider";
import { LicenseProvider } from "@/features/licenses/license-provider";
import { CartProvider } from "@/features/cart/cart-provider";
import { beatRepository, getLicenses } from "@/lib/repositories/beats";
import { getSiteOrigin, site } from "@/config/site";
import { privatePreview } from "@/lib/preview-mode";
import "./globals.css";
import "./service-commerce.css";
import "./storefront-motion.css";
import "./responsive-layout.css";
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
  const [beats, licenses] = BEATS_ENABLED ? await Promise.all([
    beatRepository.listPublished(),
    getLicenses(),
  ]) : [[], []];
  return (
    <html lang="it">
      <body><SiteAtmosphere/>{BEATS_ENABLED && <InterestMemory/>}
        <a className="skip-link" href="#main-content">
          Vai al contenuto
        </a>
        <PlayerProvider catalog={beats}>
          <LicenseProvider licenses={licenses}>
            <CartProvider catalog={beats}>
              <Navigation cards={homeStorefront(await getPublicDiscounts())} />
              <main id="main-content" tabIndex={-1}>
                {children}
              </main>
              <UtilityDock><ChatWidget enabled={Boolean(process.env.CLOUDFLARE_ACCOUNT_ID&&process.env.CLOUDFLARE_API_TOKEN)&&(process.env.AI_PROVIDER||'cloudflare')==='cloudflare'}/>{CART_ENABLED && <CartRail discounts={await getPublicDiscounts()} />}</UtilityDock>
              <Footer />
              {BEATS_ENABLED && <PersistentPlayer />}
              <MotionObserver />
              <AssetGuard />
            </CartProvider>
          </LicenseProvider>
        </PlayerProvider>
      </body>
    </html>
  );
}
