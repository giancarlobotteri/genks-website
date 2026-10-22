import Link from "next/link";
import Image from "next/image";
import { ServiceCards } from "@/components/services/service-cards";
import { genksBiography, studioPortrait } from "@/data/home-content";
import { CinematicHero } from "./cinematic-hero";
import { HomeProof } from "./home-proof";
import styles from "./service-home.module.css";
export function ServiceHome() {
 return <div className={`${styles.home} ${styles.cinematicHome}`}>
  <CinematicHero serviceLanding />
  <div id="collection">
  <section className={styles.section}><h2>COME FUNZIONA</h2><div className={styles.steps}>
   <article><span>01</span><h3>Scegli e paga</h3><p>Scegli il servizio e paga online in 2 minuti.</p></article>
   <article><span>02</span><h3>Invia le tracce</h3><p>Mandami il link alle tracce seguendo la guida.</p></article>
   <article><span>03</span><h3>Ricevi il brano</h3><p>Prima versione entro 7 giorni lavorativi, poi 2 revisioni.</p></article>
  </div></section>
  <section className={styles.section}><h2>SERVIZI</h2><ServiceCards /><Link className={styles.more} href="/services">Vedi tutti i prezzi e i pacchetti</Link></section>
  <HomeProof />
  <section id="about" className={`${styles.section} ${studioPortrait ? styles.about : ""}`}>{studioPortrait && <Image src={studioPortrait} width={640} height={720} alt="Gianca, GENKS, nel suo studio a Perugia" className={styles.portrait} />}<div><h2>CHI È GENKS</h2><p className={styles.biography}>{genksBiography}</p><Link className={styles.more} href="/chi-sono">La mia storia</Link></div></section>
  <section className={`${styles.section} ${styles.faq}`}><h2>DOMANDE FREQUENTI</h2>
   <details><summary>Lavori anche a distanza?</summary><p>Sì. Paghi online, mi mandi le tracce e ricevi il brano via email, da qualsiasi paese.</p></details>
   <details><summary>Quanto tempo ci vuole?</summary><p>Prima versione entro 7 giorni lavorativi, oppure 48 ore con la consegna veloce.</p></details>
   <details><summary>E se il risultato non mi piace?</summary><p>Hai 2 revisioni incluse. Se ancora non ti convince, ti rimborso il 50%.</p></details>
   <details><summary>Come preparo le tracce?</summary><p><Link href="/guida/tracce">Segui la guida in 5 minuti</Link></p></details>
   <details><summary>Come pago?</summary><p>Mix e master online con carta o Apple Pay. La registrazione si paga in studio.</p></details>
  </section>
  <section className={`${styles.section} ${styles.closing}`}><h2>Il tuo prossimo brano merita di suonare così.</h2><Link className="button button-primary" href="/services/project">Scegli il tuo mix</Link></section>
  </div>
 </div>;
}
