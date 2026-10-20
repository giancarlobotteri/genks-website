import Link from "next/link";
import { beatRepository } from "@/lib/repositories/beats";
import { site } from "@/config/site";
import { StudioPaymentNotice } from "@/components/services/studio-payment-notice";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Richiedi un beat in studio", robots: { index: false, follow: true } };
export default async function StudioBeatPage({ searchParams }: { searchParams: Promise<{ beat?: string }> }) {
  const query = await searchParams;
  const beat = query.beat ? await beatRepository.getBySlug(query.beat) : null;
  const message = `Ciao GENKS, vorrei informazioni ${beat ? `sul beat ${beat.title}` : "sui beat disponibili"} e concordare licenza, prezzo e un appuntamento in studio con pagamento in contanti.`;
  const phone = site.whatsapp.replace(/\D/g, "");
  return <div className="portal-shell narrow-shell service-portal"><span className="eyebrow">GENKS · BEAT IN STUDIO</span><h1>{beat ? `Parliamo di ${beat.title}.` : "Troviamo il beat per il tuo brano."}</h1><p>Concordiamo la produzione, i file e i diritti della licenza prima dell’acquisto. Puoi anche richiedere un ascolto insieme in studio.</p><StudioPaymentNotice/><div className="custom-contact-actions">{phone && <a className="button button-primary" href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">Richiedi informazioni su WhatsApp</a>}<a className="button button-secondary" href={`mailto:assistenza@prodbygenks.com?${new URLSearchParams({ subject: "Richiesta beat GENKS", body: message })}`}>Scrivi a GENKS</a><Link className="text-link" href="/services/recording">Richiedi un appuntamento in studio →</Link></div><Link className="text-link" href="/beats">← Torna al catalogo</Link></div>;
}
