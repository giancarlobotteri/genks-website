import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { beatRepository, getLicenses } from "@/lib/repositories/beats";
import { site } from "@/config/site";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Richiedi un beat in studio", robots: { index: false, follow: true } };
export default async function StudioBeatPage({ searchParams }: { searchParams: Promise<{ beat?: string; license?: string }> }) {
  const query = await searchParams;
  const beat = query.beat ? await beatRepository.getBySlug(query.beat) : null;
  const licenses = await getLicenses();
  const license = beat && query.license ? licenses.find(item=>item.id===query.license && beat.licenseIds.includes(item.id)) : null;
  const message = `Ciao GENKS, vorrei informazioni ${beat ? `sul beat ${beat.title}` : "sui beat disponibili"} ${license ? `con licenza ${license.name} (${formatPrice(beat?.licensePrices?.[license.id] ?? license.priceCents)}) ` : ""}e concordare licenza, prezzo e un appuntamento in studio con pagamento in contanti.`;
  const phone = site.whatsapp.replace(/\D/g, "");
  return <div className="portal-shell narrow-shell service-portal"><span className="eyebrow">GENKS · BEAT IN STUDIO</span><h1>{beat ? `Parliamo di ${beat.title}.` : "Troviamo il beat per il tuo brano."}</h1>{license && <aside className="notice"><strong>{license.name} · {formatPrice(beat?.licensePrices?.[license.id] ?? license.priceCents)}</strong><p>{license.format}</p></aside>}<p>La tua scelta è pronta: scrivi a GENKS per concordare consegna e acquisto in studio. Pagamento in contanti.</p><div className="custom-contact-actions">{phone && <a className="button button-primary" href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">Continua su WhatsApp</a>}<a className="button button-secondary" href={`mailto:assistenza@prodbygenks.com?${new URLSearchParams({ subject: "Richiesta beat GENKS", body: message })}`}>Scrivi a GENKS</a></div><Link className="text-link" href="/beats">← Torna al catalogo</Link></div>;
}
