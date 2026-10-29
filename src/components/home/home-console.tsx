"use client";
import Link from 'next/link';
import {ArrowUpRight,Headphones,Layers3,Clock3,ShieldCheck} from 'lucide-react';
import {homeStorefront} from '@/lib/home-storefront';
import {serviceAmount} from '@/lib/service-rates';
import type {PublicDiscount} from '@/lib/public-discounts';
import styles from './home-console.module.css';
export function HomeConsole({discounts}:{discounts:PublicDiscount[]}){
 const offers=homeStorefront(discounts).filter(c=>c.group==='bundle').slice(0,3);
 return <div className={styles.console} data-home-console>
  <div className={styles.top}><span><Layers3 size={16}/> Scegli da dove iniziare</span><Link href="/services#pacchetti">Tutti i pacchetti <ArrowUpRight size={15}/></Link></div>
  <div className={styles.grid}><div className={styles.offers}>{offers.map(c=><Link key={c.id} href={c.href} className={styles.offer}><span className={styles.name}>{c.name}</span><div><strong>{serviceAmount(c.price)}</strong><ArrowUpRight size={17}/></div><small>Risparmi {serviceAmount(c.saving)}</small></Link>)}</div><button className={styles.assistant} type="button" onClick={()=>window.dispatchEvent(new Event('genks:open-chat'))}><Headphones size={24}/><span><strong>Non sai cosa scegliere?</strong><small>Parlane con l’assistente GENKS</small></span><ArrowUpRight size={17}/></button></div>
  <div className={styles.trust}><span><Clock3 size={13}/> In studio o a distanza</span><span><ShieldCheck size={13}/> Carta e Apple Pay</span><Link href="/guida/tracce">Prepara le tracce <ArrowUpRight size={12}/></Link></div>
 </div>;
}

