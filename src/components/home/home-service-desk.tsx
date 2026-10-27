import Link from "next/link";
import {ArrowUpRight, AudioLines} from "lucide-react";
import styles from "./home-service-desk.module.css";
export function HomeServiceDesk({services}:{services:{name:string;price:string;detail:string;href:string}[]}) {
 return <aside className={styles.desk} aria-label="Accesso rapido ai servizi">
  <div className={styles.label}><AudioLines size={16} aria-hidden="true"/>IL TUO SUONO, QUI</div>
  <div className={styles.links}>{services.map(s=><Link href={s.href} key={s.href}><span><strong>{s.name}</strong><small>{s.detail}</small></span><span className={styles.price}>{s.price}<ArrowUpRight size={14} aria-hidden="true"/></span></Link>)}</div>
  <Link className={styles.all} href="/services">Prezzi e pacchetti <ArrowUpRight size={16}/></Link>
 </aside>;
}
