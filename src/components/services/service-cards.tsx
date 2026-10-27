import {discountPrice,type PublicDiscount} from "@/lib/public-discounts";
import Link from "next/link";
import {AudioLines,ArrowUpRight,Disc3,Mic2,SlidersHorizontal} from "lucide-react";
import { serviceAmount, recordingHourlyCents, projectRates } from "@/lib/service-rates";
import styles from "./service-list.module.css";
export function ServiceCards({discounts=[]}:{discounts?:PublicDiscount[]}) {
 const price=(base:number,target:string)=>serviceAmount(discountPrice(base,[target,target==="recording"?"services":"projects","services"],discounts));
 const cards=[{name:"Master",price:price(projectRates.master,"master"),text:"Hai già il mix? Lo rendo forte e pulito su ogni piattaforma.",href:"/services/project?service=master",button:"Scegli il master"},{name:"Mix + master",price:`da ${price(projectRates.mix_master,"mix_master")}`,text:"Dalle tracce al brano finito, pronto per le piattaforme di streaming.",href:"/services/project?service=mix_master",button:"Scegli mix + master"},{name:"Registrazione",price:`${price(recordingHourlyCents,"recording")}/ora`,text:"Studio a Ponte San Giovanni, Perugia. Scegli l’orario. Conferma dopo pagamento dell’anticipo.",href:"/services/recording",button:"Prenota lo studio"}];
 cards.splice(0,0,{name:"Mix",price:`da ${price(projectRates.mix,"mix")}`,text:"Voce e strumenti, equilibrati per il tuo suono.",href:"/services/project?service=mix",button:"Scegli il mix"});
 const icons=[SlidersHorizontal,Disc3,AudioLines,Mic2];
 return (<section className={styles.cards} aria-label="Servizi">{cards.map((c,i)=>{const Icon=icons[i];return <article data-reveal key={c.name} className={c.name==="Mix + master"?styles.featured:""}><div className={styles.cardIcon}><Icon size={25}/></div><h2>{c.name}</h2><strong className={styles.price}>{c.price}</strong><p>{c.text}</p><p className={styles.paymentNote}>{c.name==="Registrazione"?"Acconto 20 €, oppure 10 € per una sessione da 19,99 €. Conferma dopo incasso.":"Carta o Apple Pay online; contanti per il lavoro in studio."}</p><Link className="button button-primary" href={c.href}>{c.button}<ArrowUpRight size={16}/></Link></article>;})}</section>);
}
