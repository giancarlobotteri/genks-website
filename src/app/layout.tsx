import type { Metadata, Viewport } from "next";
import { Navigation } from "@/components/layout/navigation";
import { Footer } from "@/components/layout/footer";
import { PersistentPlayer } from "@/components/player/persistent-player";
import { MotionObserver } from "@/components/ui/motion-observer";
import { PlayerProvider } from "@/features/player/player-provider";
import { LicenseProvider } from "@/features/licenses/license-provider";
import { CartProvider } from "@/features/cart/cart-provider";
import { beatRepository, getLicenses } from "@/lib/repositories/beats";
import { getSiteOrigin, site } from "@/config/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: getSiteOrigin(),
  title: { default: "GENKS — The sound starts here", template: "%s | GENKS" },
  description: site.description,
  applicationName: site.name,
  openGraph: {
    title: "GENKS — The sound starts here",
    description: site.description,
    type: "website",
    locale: "en_US",
    siteName: site.name,
  },
  twitter: {
    card: "summary",
    title: "GENKS — Music producer",
    description: site.description,
  },
  icons: { icon: "/icon.svg" },
};
export const viewport: Viewport = {
  themeColor: "#050506",
  colorScheme: "dark",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [beats, licenses] = await Promise.all([
    beatRepository.listPublished(),
    getLicenses(),
  ]);
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <PlayerProvider catalog={beats}>
          <LicenseProvider licenses={licenses}>
            <CartProvider catalog={beats}>
              <Navigation />
              <main id="main-content" tabIndex={-1}>
                {children}
              </main>
              <Footer />
              <PersistentPlayer />
              <MotionObserver />
            </CartProvider>
          </LicenseProvider>
        </PlayerProvider>
      </body>
    </html>
  );
}
