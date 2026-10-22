import Link from "next/link";
import { ArrowRight, Check, Home, Mail, FolderOpen, CalendarDays, AudioLines } from "lucide-react";
import styles from "./reservation-success.module.css";

export function ReservationSuccess({ reference, project = false, paid = false }: { reference: string; project?: boolean; paid?: boolean }) {
  const destination=project?"/account/projects":"/account/bookings";
  return <div className={`portal-shell ${styles.shell}`}>
    <section className={styles.card} aria-labelledby="reservation-success-title">
      <div className={styles.glow} aria-hidden="true"/><div className={styles.brand}>GENKS<span>STUDIO ONLINE</span></div>
      <div className={styles.header}>
        <div className={styles.seal} aria-hidden="true"><span/><Check size={42} strokeWidth={2.3}/></div>
        <p className={styles.badge}>{paid?"PAGAMENTO CONFERMATO":"PRENOTAZIONE CONFERMATA"}</p>
        <h1 id="reservation-success-title">{paid?<>È tutto pronto.<br/><em>Il tuo suono continua qui.</em></>:<>Ci siamo.<br/><em>La tua sessione ti aspetta.</em></>}</h1>
        <p className={styles.intro}>{paid?"Pagamento ricevuto. Grazie per aver scelto GENKS.":"Prenotazione confermata. Grazie per aver scelto GENKS."}</p>
      </div>
      <div className={styles.reference}><span>IL TUO RIFERIMENTO</span><strong>{reference}</strong><small>Conservalo per ritrovare subito la richiesta.</small></div>
      <div className={styles.steps}>
        <article><Mail size={22}/><div><h2>Controlla la tua email</h2><p>Trovi il riepilogo e {project?"le condizioni accettate.":"i collegamenti per aggiungere la sessione al calendario."}</p></div></article>
        <article>{project?<AudioLines size={22}/>:<CalendarDays size={22}/>}<div><h2>{project?"Il prossimo passo":"Il tuo appuntamento"}</h2><p>{project?"Segui le indicazioni ricevute per inviare i file. Tempi e revisioni sono nel riepilogo del tuo ordine.":"Ritrovi giorno, orario e dettagli nella tua area cliente. Gli orari sono indicati nel fuso italiano."}</p></div></article>
      </div>
      {!paid&&<div className={styles.payment}><Check size={18}/><p><strong>Paghi in contanti presso lo studio.</strong><span>Nessun addebito online è stato effettuato.</span></p></div>}
      <div className={styles.actions}><Link className={styles.primary} href={destination}><FolderOpen size={19}/> Apri le mie richieste <ArrowRight size={18}/></Link><Link className={styles.secondary} href="/"><Home size={18}/> Torna alla home</Link></div>
      <p className={styles.footer}>Accedi con la stessa email usata per la richiesta. Hai bisogno di una mano? <a href="mailto:assistenza@prodbygenks.com">Scrivi a GENKS</a>.</p>
    </section>
  </div>;
}
