import { ServiceCards } from "./service-cards";
import Link from "next/link";
import {projectTiers,serviceAmount} from "@/lib/service-rates";
import {packages,customBeat} from "@/lib/service-catalog";
import {site} from "@/config/site";
import {ServiceSelector} from "./service-selector";
import styles from "./service-list.module.css";
const whatsapp=(text:string)=>`https://wa.me/${site.whatsapp.replace(/\D/g,"")}?text=${encodeURIComponent(text)}`;
export default function DirectServices(){
 return <div className={`portal-shell service-portal ${styles.page}`}><header><h1>Scegli il servizio. Il prezzo lo vedi subito.</h1><p>Prima versione entro 7 giorni lavorativi, 2 revisioni incluse.</p></header>
 <ServiceCards />
 <section><h2>Mix e mix + master</h2><div className={styles.tableWrap}><table><thead><tr><th>Tracce audio separate per brano</th><th>Mix</th><th>Mix + master</th></tr></thead><tbody>{projectTiers.map(t=><tr key={t.min}><th>{t.min===1?"Fino a 8":`${t.min}–${t.max}`} tracce</th><td><Link href="/services/project?service=mix">{serviceAmount(t.mix)}</Link></td><td><Link href="/services/project?service=mix_master">{serviceAmount(t.mix_master)}</Link></td></tr>)}</tbody></table></div><Link href="/guida/tracce">Non sai quante tracce hai? Contale così</Link></section>
 <section><h2>Pacchetti</h2><div className={styles.tableWrap}><table><thead><tr><th>Pacchetto</th><th>Include</th><th>Prezzo</th><th>Separatamente</th><th>Prenota</th></tr></thead><tbody>{Object.entries(packages).map(([code,p])=><tr key={code}><th>{p.name}</th><td>{p.description}<small>{p.studio?"Paghi in studio.":"Paghi online con carta o Apple Pay."}</small></td><td>{serviceAmount(p.price)}</td><td>{serviceAmount(p.separate)}</td><td>{p.studio?<a className="button button-secondary" href={whatsapp(`Ciao GENKS, vorrei prenotare il pacchetto ${p.name}. Quando sei disponibile?`)}>Prenota il pacchetto</a>:<Link className="button button-primary" href={`/services/project?package=${code}`}>Scegli {p.name}</Link>}</td></tr>)}</tbody></table></div><p>I pacchetti con mix + master includono fino a 8 tracce per brano. Da 9 a 24: +60 € per brano; da 25 a 48: +110 € per brano. Oltre 48: preventivo su WhatsApp.</p></section>
 <section className="admin-form-card"><h2>Beat su misura</h2><p>Il tuo beat, da zero – {serviceAmount(customBeat.total)}. Acconto del 50% per iniziare, consegna in 10 giorni lavorativi, 2 revisioni.</p><p>Acconto 125,00 € · saldo 124,99 €.</p><a className="button button-primary" href={whatsapp("Ciao, sono interessato a un beat su misura. Possiamo concordare il prezzo?")}>Parliamone su WhatsApp</a></section>
 <ServiceSelector/>
 <aside className={styles.guarantee}><strong>Garanzia GENKS: se dopo le 2 revisioni il mix non ti convince, ti rimborso il 50%.</strong><Link href="/legal/refunds">Condizioni della garanzia</Link></aside>
 </div>;
}
