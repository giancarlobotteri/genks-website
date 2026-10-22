import Link from "next/link";
import { serviceAmount, recordingHourlyCents, projectRates } from "@/lib/service-rates";
import styles from "./service-list.module.css";
export function ServiceCards() {
 const cards=[{name:"Master",price:serviceAmount(projectRates.master),text:"Hai già il mix? Lo rendo forte e pulito su ogni piattaforma.",href:"/services/project?service=master",button:"Scegli il master"},{name:"Mix + master",price:`da ${serviceAmount(projectRates.mix_master)}`,text:"Il tuo brano pronto per Spotify, Apple Music e YouTube e qualsiasi altra piattaforma di streaming musicale",href:"/services/project?service=mix_master",button:"Scegli mix + master"},{name:"Registrazione",price:`${serviceAmount(recordingHourlyCents)}/ora`,text:"Studio a Ponte San Giovanni, Perugia. Scegli l'orario e confermi subito.",href:"/services/recording",button:"Prenota lo studio"}];
 return (<section className={styles.cards} aria-label="Servizi">{cards.map((c,i)=><article key={c.name} className={i===1?styles.featured:""}>{i===1&&<span className={styles.badge}>Più scelto</span>}<h2>{c.name}</h2><strong className={styles.price}>{c.price}</strong><p>{c.text}</p><p>{i===2?"Paghi in studio.":"Paghi online con carta o Apple Pay."}</p><Link className="button button-primary" href={c.href}>{c.button}</Link></article>)}</section>);
}
