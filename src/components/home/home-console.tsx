"use client";
import Link from 'next/link';
import {ArrowUpRight,Headphones,Layers3,Clock3,ShieldCheck,ChevronLeft,ChevronRight,Bot} from 'lucide-react';
import {useRef} from 'react';
import {homeStorefront} from '@/lib/home-storefront';
import {serviceAmount} from '@/lib/service-rates';
import type {PublicDiscount} from '@/lib/public-discounts';
import styles from './home-console.module.css';
export function HomeConsole({discounts}:{discounts:PublicDiscount[]}){
 const offers=homeStorefront(discounts).filter(c=>c.group==='bundle');
 const rail=useRef<HTMLDivElement>(null);
 const scrollOffers=(direction:number)=>{
  const node=rail.current;
  if(node)node.scrollBy({left:direction*node.clientWidth*.8,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
 };
 return <div className={styles.console} data-home-console>
  <div className={styles.top}><span><Layers3 size={16}/> Scegli da dove iniziare</span><Link href="/services#pacchetti">Tutti i pacchetti <ArrowUpRight size={15}/></Link></div>
  <div className={styles.grid}><div className={styles.railArea}><div className={styles.rail} ref={rail} id="home-offers-rail" role="region" aria-label="Tutte le offerte GENKS" tabIndex={0}>{offers.map(c=><Link key={c.id} href={c.href} className={styles.offer}><span className={styles.name}>{c.name}</span><div><strong>{serviceAmount(c.price)}</strong><ArrowUpRight size={17}/></div><small>Risparmi {serviceAmount(c.saving)}</small></Link>)}</div><div className={styles.railControls}><span>{offers.length} offerte · Scorri per scoprirle tutte</span><button type="button" aria-label="Offerte precedenti" aria-controls="home-offers-rail" onClick={()=>scrollOffers(-1)}><ChevronLeft size={18}/></button><button type="button" aria-label="Offerte successive" aria-controls="home-offers-rail" onClick={()=>scrollOffers(1)}><ChevronRight size={18}/></button></div></div><button className={styles.assistant} type="button" onClick={()=>window.dispatchEvent(new Event('genks:open-chat'))}><span className={styles.aiAvatar}><Headphones size={32}/><Bot size={16}/></span><span><small className={styles.aiLabel}>ASSISTENTE AI · GENKS</small><strong>Hai domande? Chiedi all’assistente!</strong><small>Prezzi, servizi e disponibilità con l’intelligenza artificiale.</small></span><ArrowUpRight size={17}/></button></div>
  <div className={styles.trust}><span><Clock3 size={13}/> In studio o a distanza</span><span><ShieldCheck size={13}/> Carta e Apple Pay</span><Link href="/guida/tracce">Prepara le tracce <ArrowUpRight size={12}/></Link></div>
 </div>;
}

