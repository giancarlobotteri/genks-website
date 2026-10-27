"use client";
import Link from 'next/link';
import {useRef} from 'react';
import {ArrowUpRight,ArrowDown,Layers3} from 'lucide-react';
import type {StoreCard} from '@/lib/home-storefront';
import {serviceAmount} from '@/lib/service-rates';
import styles from './home-service-desk.module.css';
export function HomeServiceDesk({services,offers}:{services:{name:string;price:string;detail:string;href:string}[];offers:StoreCard[]}){
 const list=useRef<HTMLDivElement>(null);
 return <aside className={styles.desk} aria-label="Offerte e bundle GENKS"><header className={styles.label}><span><Layers3 size={16}/>BUNDLE E OFFERTE</span><span>{offers.length} pacchetti</span></header><div ref={list} className={styles.offers} tabIndex={0} aria-label="Elenco scorrevole dei pacchetti">{offers.map(o=><Link href={o.href} key={o.id}><span className={styles.title}>{o.name}<ArrowUpRight size={15}/></span><span className={styles.amount}>{o.saving>0&&<del>{serviceAmount(o.separate)}</del>}<strong>{serviceAmount(o.price)}</strong></span>{o.saving>0&&<span className={styles.saving}>Risparmi {serviceAmount(o.saving)}</span>}<small>{o.detail}</small></Link>)}</div><button className={styles.scroll} type="button" onClick={()=>list.current?.scrollBy({top:list.current.clientHeight*.7,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}>Scorri i pacchetti <ArrowDown size={14}/></button><div className={styles.singles}>{services.map(s=><Link key={s.href} href={s.href}><span>{s.name}</span><strong>{s.price}</strong></Link>)}</div><Link className={styles.all} href="/services">Confronta tutti i prezzi <ArrowUpRight size={16}/></Link></aside>;
}
