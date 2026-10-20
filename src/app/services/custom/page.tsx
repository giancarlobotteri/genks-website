import { CustomBeatContact } from "@/components/services/custom-beat-contact";
import { StudioPaymentNotice } from "@/components/services/studio-payment-notice";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Richiedi un beat su misura", description: "Una produzione GENKS costruita intorno al tuo brano. Contatta GENKS per un preventivo dedicato al lavoro che cerchi.", alternates: { canonical: "/services/custom" } };
export default function CustomBeatPage() {
  return <div className="portal-shell narrow-shell service-portal"><CustomBeatContact /><StudioPaymentNotice/></div>;
}
