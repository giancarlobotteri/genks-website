import Link from "next/link";
import { ArrowUpRight, AudioLines, Disc3, Mic2 } from "lucide-react";
import { GenksEmblem } from "@/components/brand/genks-emblem";
const items = [
  { href: "/services/recording", n: "01", title: "Sessione in studio", copy: "La tua voce, il tuo spazio. Scegli durata, giorno e orario.", icon: Mic2 },
  { href: "/services/project", n: "02", title: "Mix e master", copy: "Seleziona il tipo di servizio di cui hai bisogno: mix, master oppure mix e master.", icon: AudioLines },
  { href: "/services/custom", n: "03", title: "Beat su misura", copy: "Una produzione costruita per te. Contattami per un preventivo dedicato.", icon: Disc3 },
];
export default function ServicesPage() {
  return <div className="portal-shell service-portal">
    <div className="service-page-heading"><div><span className="eyebrow">LAVORA CON GENKS</span><h1>Il prossimo passo del tuo suono.</h1><p className="muted">Scegli il servizio, invia la tua richiesta e definiamo insieme i dettagli. Il pagamento arriva dopo la conferma o il preventivo.</p></div><GenksEmblem /></div>
    <div className="service-choice-grid">{items.map(item => <Link href={item.href} key={item.href} className="service-choice-card"><span className="service-choice-top"><span>{item.n}</span><item.icon size={30} strokeWidth={1.4} aria-hidden="true" /></span><h2>{item.title}</h2><p>{item.copy}</p><span className="service-choice-link">Inizia la richiesta <ArrowUpRight size={18} aria-hidden="true" /></span></Link>)}</div>
    <Link className="text-link service-return" href="/beats">Cerchi un beat pronto? Vai al catalogo <ArrowUpRight size={17} /></Link>
  </div>;
}
