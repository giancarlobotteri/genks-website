"use client";
import {useRef,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,ArrowRight,ArrowUpRight,Layers3,Mic2,AudioLines,Search} from 'lucide-react';
import type {StoreCard} from '@/lib/home-storefront';
import {serviceAmount} from '@/lib/service-rates';
import styles from './home-marketplace.module.css';
const filters=[['all','Tutto'],['bundle','Bundle e risparmio'],['audio','Mix e master'],['studio','In studio'],['custom','Beat su misura']] as const;
export function HomeMarketplace({cards}:{cards:StoreCard[]}){
 const [filter,setFilter]=useState('all'),[search,setSearch]=useState('');const rail=useRef<HTMLDivElement>(null);
 const shown=cards.filter(c=>(filter==='all'||c.group===filter)&&`${c.name} ${c.detail}`.toLocaleLowerCase('it').includes(search.trim().toLocaleLowerCase('it')));
 const scroll=(direction:number)=>rail.current?.scrollBy({left:direction*rail.current.clientWidth*.8,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 return <section className={styles.market} aria-labelledby="shop-heading">
  <header><div><span className={styles.kicker}>IL TUO PROSSIMO PROGETTO</span><h2 id="shop-heading">Servizi chiari. Pacchetti che convengono.</h2></div><Link href="/services">Tutto il listino <ArrowUpRight size={17}/></Link></header>
  <div className={styles.toolbar}><nav aria-label="Categorie servizi">{filters.map(([id,label])=><button type="button" key={id} aria-pressed={filter===id} onClick={()=>{setFilter(id);rail.current?.scrollTo({left:0});}}>{label}</button>)}</nav><label className={styles.search}><Search size={17}/><span className="sr-only">Cerca servizi e bundle</span><input type="search" placeholder="Cerca un servizio o bundle" value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
  <div className={styles.rail} ref={rail} tabIndex={0} aria-label="Scorri servizi e pacchetti">{shown.map(c=><article className={styles.card} key={c.id}><div className={styles.cardTop}><span>{c.tag}</span>{c.saving>0&&<strong>Risparmi {serviceAmount(c.saving)}</strong>}</div><div className={styles.art} aria-hidden="true">{c.group==='bundle'?<Layers3/>:c.group==='studio'?<Mic2/>:<AudioLines/>}<i/><i/></div><h3>{c.name}</h3><p>{c.detail}</p><div className={styles.price}>{c.saving>0&&<del aria-label="Prezzo dei servizi separati">{serviceAmount(c.separate)}</del>}<strong>{serviceAmount(c.price)}{c.unit==='da'&&<small> +</small>}{c.unit==='/ora'&&<small> /ora</small>}</strong></div><Link href={c.href}>Personalizza {c.group==='bundle'?'il pacchetto':'il servizio'}<ArrowUpRight size={17}/></Link></article>)}</div>
  <footer><p aria-live="polite">{shown.length?`${shown.length} proposte · Prezzi base, extra sempre visibili prima del pagamento.`:'Nessun risultato. Prova un altro termine o scegli Tutto.'}</p><div><button type="button" aria-label="Offerte precedenti" disabled={!shown.length} onClick={()=>scroll(-1)}><ArrowLeft size={18}/></button><button type="button" aria-label="Offerte successive" disabled={!shown.length} onClick={()=>scroll(1)}><ArrowRight size={18}/></button></div></footer>
 </section>;
}
