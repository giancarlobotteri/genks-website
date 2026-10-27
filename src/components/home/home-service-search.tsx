"use client";
import {useState} from 'react';
import Link from 'next/link';
import {Search,X,ArrowUpRight} from 'lucide-react';
import type {StoreCard} from '@/lib/home-storefront';
import {serviceAmount} from '@/lib/service-rates';
import styles from './home-service-search.module.css';
export function HomeServiceSearch({cards}:{cards:StoreCard[]}){
 const [query,setQuery]=useState(''),[focused,setFocused]=useState(false);
 const words=query.toLocaleLowerCase('it').trim().split(/\s+/).filter(Boolean);
 const results=cards.filter(c=>words.every(w=>`${c.name} ${c.detail} ${c.group==='studio'?'rec studio registrare':''}`.toLocaleLowerCase('it').includes(w)));
 return <div className={styles.search} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setFocused(false);}} onKeyDown={e=>{if(e.key==='Escape')setFocused(false);}}>
  <label><Search size={19} aria-hidden="true"/><span className="sr-only">Cerca il tuo servizio</span><input type="search" placeholder="Cerca un servizio…" value={query} onChange={e=>{setQuery(e.target.value);setFocused(true);}} onFocus={()=>setFocused(true)} aria-controls="home-service-results"/>{query&&<button type="button" aria-label="Cancella ricerca" onClick={()=>{setQuery('');setFocused(false);}}><X size={17}/></button>}</label>
  {focused&&query.trim()&&<div id="home-service-results" className={styles.results}><p role="status">{results.length?`${results.length} servizi e pacchetti trovati`:'Nessun risultato. Prova “mix”, “master” o “studio”.'}</p>{results.map(c=><Link key={c.id} href={c.href} onClick={()=>setFocused(false)}><span>{c.name}<small>{c.unit==='da'?'da ':''}{serviceAmount(c.price)}{c.unit==='/ora'?' /ora':''}</small></span><ArrowUpRight size={18}/></Link>)}</div>}
 </div>;
}
