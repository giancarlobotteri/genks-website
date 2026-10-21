import Link from "next/link";
import { StudioPaymentNotice } from "@/components/services/studio-payment-notice";
import { ArrowUpRight, AudioLines, Disc3, Mic2 } from "lucide-react";
import { GenksEmblem } from "@/components/brand/genks-emblem";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Studio, mix, master e beat su misura", description: "Richiedi una sessione in studio a Perugia, un mix, un master o una produzione su misura. Scegli il servizio per vedere prezzo, modalità e disponibilità.", alternates: { canonical: "/services" } };
const items = [
  { href: "/services/recording", n: "01", title: "Sessione in studio", copy: "Scegli data e orario, poi personalizza la durata se ti serve.", icon: Mic2 },
  { href: "/services/project", n: "02", title: "Mix e master", copy: "Scegli mix, master o il percorso completo. A distanza oppure fisicamente in studio.", icon: AudioLines },
  { href: "/services/custom", n: "03", title: "Beat su misura", copy: "Una produzione costruita per te. Contattami per un preventivo dedicato.", icon: Disc3 },
];
export default function ServicesPage() {
  return <div className="portal-shell service-portal">
    <div className="service-page-heading"><div><span className="eyebrow">LAVORA CON GENKS</span><h1>Il prossimo passo del tuo suono.</h1><p className="muted">Scegli il servizio, controlla il prezzo e prenota. Per registrare scegli anche giorno e orario disponibili. Per mix e master puoi lavorare a distanza oppure fisicamente in studio.</p></div><GenksEmblem /></div>
    <StudioPaymentNotice />
    <div className="service-choice-grid">{items.map(item => <Link href={item.href} key={item.href} className="service-choice-card"><span className="service-choice-top"><span>{item.n}</span><item.icon size={30} strokeWidth={1.4} aria-hidden="true" /></span><h2>{item.title}</h2><p>{item.copy}</p><span className="service-choice-link">Scopri il servizio <ArrowUpRight size={18} aria-hidden="true" /></span></Link>)}</div>
    <Link className="text-link service-return" href="/beats">Cerchi un beat pronto? Vai al catalogo <ArrowUpRight size={17} /></Link>
  </div>;
}
