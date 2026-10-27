import {discountPrice,type PublicDiscount} from "@/lib/public-discounts";
import Link from "next/link";
import { serviceAmount, recordingHourlyCents, projectRates } from "@/lib/service-rates";
import styles from "./service-list.module.css";
export function ServiceCards({discounts=[]}:{discounts?:PublicDiscount[]}) {
 const price=(base:number,target:string)=>serviceAmount(discountPrice(base,[target,target==="recording"?"services":"projects","services"],discounts));
 const cards=[{name:"Master",price:price(projectRates.master,"master"),text:"Hai già il mix? Lo rendo forte e pulito su ogni piattaforma.",href:"/services/project?service=master",button:"Scegli il master"},{name:"Mix + master",price:`da ${price(projectRates.mix_master,"mix_master")}`,text:"Il tuo brano pronto per Spotify, Apple Music e YouTube e qualsiasi altra piattaforma di streaming musicale",href:"/services/project?service=mix_master",button:"Scegli mix + master"},{name:"Registrazione",price:`${price(recordingHourlyCents,"recording")}/ora`,text:"Studio a Ponte San Giovanni, Perugia. Scegli l’orario. Conferma dopo pagamento dell’anticipo.",href:"/services/recording",button:"Prenota lo studio"}];
 cards.splice(0,0,{name:"Mix",price:`da ${price(projectRates.mix,"mix")}`,text:"Voce e strumenti, equilibrati per il tuo suono.",href:"/services/project?service=mix",button:"Scegli il mix"});
 return (<section className={styles.cards} aria-label="Servizi">{cards.map(c=><article data-reveal key={c.name} className={c.name==="Mix + master"?styles.featured:""}><h2>{c.name}</h2><strong className={styles.price}>{c.price}</strong><p>{c.text}</p><p>{c.name==="Registrazione"?"Anticipo 50% con carta o contanti; conferma dopo incasso.":"Carta o Apple Pay online; contanti per il lavoro in studio."}</p><Link className="button button-primary" href={c.href}>{c.button}</Link></article>)}</section>);
}
