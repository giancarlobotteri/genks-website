import {totalEnding99} from '@/lib/order-rounding';
import {homeStorefront} from "@/lib/home-storefront";
import {HomeMarketplace} from "./home-marketplace";
import {discountPrice} from "@/lib/public-discounts";
import Link from "next/link";
import { HomeServiceDesk } from "./home-service-desk";
import {projectRates,recordingHourlyCents,serviceAmount} from "@/lib/service-rates";
import {getPublicDiscounts} from "@/lib/public-discounts-server";
import Image from "next/image";
import { ServiceCards } from "@/components/services/service-cards";
import { genksBiography, studioPortrait } from "@/data/home-content";
import { CinematicHero } from "./cinematic-hero";
import { HomeProof } from "./home-proof";
import styles from "./service-home.module.css";
export async function ServiceHome() {
 const discounts=await getPublicDiscounts();const cards=homeStorefront(discounts);
 return <div className={`${styles.home} ${styles.cinematicHome}`}>
  <CinematicHero serviceLanding discounts={discounts} sideContent={<HomeServiceDesk offers={cards.filter(c=>c.group==="bundle")} services={[
   {name:"Mix + master",price:`da ${serviceAmount(totalEnding99(discountPrice(projectRates.mix_master,["mix_master","projects","services"],discounts)))}`,detail:"Un brano pronto a uscire",href:"/services/project?service=mix_master"},
   {name:"Master",price:serviceAmount(discountPrice(projectRates.master,["master","projects","services"],discounts)),detail:"Il tocco finale al tuo mix",href:"/services/project?service=master"},
   {name:"Registrazione",price:`${serviceAmount(discountPrice(recordingHourlyCents,["recording","services"],discounts))}/ora`,detail:"Il tuo spazio in studio",href:"/services/recording"}
  ]}/>} />
  <div id="collection"><HomeMarketplace cards={cards}/>
  <section className={styles.section}><h2>COME FUNZIONA</h2><div className={styles.steps}>
   <article><span>01</span><h3>Scegli e paga</h3><p>Scegli il servizio e paga online in 2 minuti.</p></article>
   <article><span>02</span><h3>Invia le tracce</h3><p>Mandami il link alle tracce seguendo la guida.</p></article>
   <article><span>03</span><h3>Ricevi il brano</h3><p>Prima versione entro 7 giorni lavorativi, una revisione inclusa.</p></article>
  </div></section>
  <section className={styles.section}><h2>SERVIZI</h2><ServiceCards discounts={discounts}/><Link className={styles.more} href="/services">Vedi tutti i prezzi e i pacchetti</Link></section>
  <HomeProof />
  <section id="about" className={`${styles.section} ${studioPortrait ? styles.about : ""}`}>{studioPortrait && <Image src={studioPortrait} width={640} height={720} alt="Gianca, GENKS, nel suo studio a Perugia" className={styles.portrait} />}<div><h2>CHI È GENKS</h2><p className={styles.biography}>{genksBiography}</p><Link className={styles.more} href="/chi-sono">La mia storia</Link></div></section>
  <section className={`${styles.section} ${styles.faq}`}><h2>DOMANDE FREQUENTI</h2>
   <details><summary>Lavori anche a distanza?</summary><p>Sì. Paghi online, mi mandi le tracce e ricevi il brano via email, da qualsiasi paese.</p></details>
   <details><summary>Quanto tempo ci vuole?</summary><p>Prima versione entro 7 giorni lavorativi, oppure 48 ore con la consegna veloce.</p></details>
   <details><summary>E se il risultato non mi piace?</summary><p>Hai una revisione inclusa. Se ancora non ti convince, puoi chiedere il rimborso del 30% della lavorazione entro 14 giorni dalla versione revisionata. Extra esclusi; condizioni della garanzia.</p></details>
   <details><summary>Come preparo le tracce?</summary><p><Link href="/guida/tracce">Segui la guida in 5 minuti</Link></p></details>
   <details><summary>Come pago?</summary><p>Mix, master, registrazione e pacchetti con carta o Apple Pay online; contanti disponibili per il lavoro in studio.</p></details>
  </section>
  <section className={`${styles.section} ${styles.closing}`}><h2>Il tuo prossimo brano merita di suonare così.</h2><Link className="button button-primary" href="/services/project">Scegli il tuo mix</Link></section>
  </div>
 </div>;
}
