'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {Wallet, Sparkles, ArrowUpRight,Check} from 'lucide-react';
import {withinBudget} from '@/lib/home-discovery';
import {homeStorefront,type StoreCard} from '@/lib/home-storefront';
import {serviceAmount} from '@/lib/service-rates';
import type {PublicDiscount} from '@/lib/public-discounts';
import styles from './home-discovery.module.css';

type SuggestionState={status:string;ids:string[]};
export function HomeDiscovery({discounts=[],preview=false}:{discounts?:PublicDiscount[];preview?:boolean}){
 const cards=homeStorefront(discounts);
 const [budget,setBudget]=useState('100');
 const [goal,setGoal]=useState('all');
 const [suggestions,setSuggestions]=useState<SuggestionState>({status:preview?'demo':'loading',ids:preview?['mix_master','production']:[]});
 useEffect(()=>{
  if(preview)return;
  let controller=new AbortController();
  const refresh=()=>{
   controller.abort();controller=new AbortController();const request=controller;
   setSuggestions({status:'loading',ids:[]});
   fetch('/api/home-recommendations',{cache:'no-store',signal:request.signal}).then(r=>r.ok?r.json():null).then(data=>{
    if(!request.signal.aborted)setSuggestions(data&&Array.isArray(data.ids)?data:{status:'unavailable',ids:[]});
   }).catch(()=>{if(!request.signal.aborted)setSuggestions({status:'unavailable',ids:[]});});
  };
  refresh();window.addEventListener('focus',refresh);
  return()=>{controller.abort();window.removeEventListener('focus',refresh);};
 },[preview]);
 const cents=Math.round(Number(budget.replace(',','.'))*100);
 const matches=withinBudget(cards,cents,goal);
 const recommended=suggestions.ids.flatMap(id=>{const c=cards.find(x=>x.id===id);return c?[c]:[];});
 return <section className={styles.discovery} aria-label="Trova il tuo prossimo progetto" data-home-discovery>
  <article className={styles.panel}>
   <div className={styles.eyebrow}><Wallet size={18}/> IL TUO BUDGET, IL TUO SUONO</div>
   <h2>Ho un budget di…</h2><p>Scopri cosa puoi fare con GENKS, senza superare la cifra che hai in mente.</p>
   <div className={styles.fields}><label>Il tuo budget in euro<div className={styles.money}><input inputMode="decimal" type="number" min="0" step="0.01" value={budget} onChange={e=>setBudget(e.target.value)}/><span>€</span></div></label><label>Cosa ti serve?<select value={goal} onChange={e=>setGoal(e.target.value)}><option value="all">Tutti i servizi</option><option value="audio">Mix e master</option><option value="studio">Registrare in studio</option><option value="production">Una produzione GENKS</option></select></label></div>
   <div className={styles.presets} aria-label="Budget rapidi">{[50,100,200,400].map(n=><button type="button" key={n} aria-pressed={Number(budget)===n} onClick={()=>setBudget(String(n))}>{n} €</button>)}</div>
   <div className={styles.results} aria-live="polite">{matches.map(c=><DiscoveryCard key={c.id} card={c} budget={cents}/>)}{!matches.length&&<p>Nessuna proposta con questi criteri. Puoi cambiare budget o servizio e consultare <Link href="/services">tutto il listino</Link>.</p>}</div>
   <small className={styles.note}>Confrontiamo il prezzo totale di partenza, non l’acconto. Tracce, ore ed extra possono modificare il totale: lo vedrai nel modulo prima di pagare.</small>
  </article>
  <article className={`${styles.panel} ${styles.personal}`}>
   <div className={styles.eyebrow}><Sparkles size={18}/> SCELTO PER TE {preview&&<span className={styles.demo}>ESEMPIO DIMOSTRATIVO</span>}</div>
   <h2>Pensiamo che potrebbe interessarti</h2>
   <p>{recommended.length?'Riparti da un servizio che conosci o scopri un pacchetto collegato ai tuoi acquisti precedenti.':'Qui trovi proposte legate ai servizi che hai già acquistato da GENKS.'}</p>
   {preview&&<p className={styles.demoNote}>Esempio: un cliente che ha già acquistato mix + master. Nessun dato reale viene usato in questa anteprima.</p>}
   <div className={styles.results}>{recommended.map(c=><DiscoveryCard key={c.id} card={c}/>)}
    {suggestions.status==='loading'&&<p role="status">Cerco i tuoi suggerimenti…</p>}
    {suggestions.status==='guest'&&<div className={styles.empty}><Sparkles size={28}/><strong>Il tuo prossimo progetto parte da qui.</strong><p>Accedi per trovare consigli basati sui tuoi acquisti. Puoi continuare a scegliere e acquistare anche senza account.</p><Link className={styles.action} href="/login?next=%2F%23home-discovery">Accedi ai tuoi suggerimenti <ArrowUpRight size={16}/></Link></div>}
    {suggestions.status==='ready'&&!recommended.length&&<div className={styles.empty}><strong>Costruiamo il tuo primo progetto.</strong><p>Dopo i tuoi primi acquisti troverai qui i suggerimenti. Intanto scopri le proposte con il budget accanto.</p><Link className={styles.action} href="/services">Esplora i servizi <ArrowUpRight size={16}/></Link></div>}
    {suggestions.status==='unavailable'&&<div className={styles.empty}><strong>Scegli il tuo prossimo servizio</strong><p>I suggerimenti personali non sono disponibili in questo momento.</p><Link className={styles.action} href="/services">Vai ai servizi <ArrowUpRight size={16}/></Link></div>}
   </div><small className={styles.note}>Suggerimenti riservati al tuo account verificato. Non avviamo ordini o prenotazioni automaticamente.</small>
  </article>
 </section>;
}
function DiscoveryCard({card:c,budget}:{card:StoreCard;budget?:number}){
 const variable=['mix','mix_master','voice','turnkey','production'].includes(c.id);
 return <Link className={styles.result} href={c.href}><div><span className={styles.tag}>{c.tag}</span><h3>{c.name}</h3><p>{c.detail}</p>{c.saving>0&&<span className={styles.saving}><Check size={13}/> Risparmi {serviceAmount(c.saving)}</span>}</div><div className={styles.price}><strong>{variable?'Da ':''}{serviceAmount(c.price)}{c.unit==='/ora'&&<small>/ora</small>}</strong>{budget!==undefined&&<small>Restano {serviceAmount(budget-c.price)} nel budget</small>}<span>Configura <ArrowUpRight size={15}/></span></div></Link>;
}
