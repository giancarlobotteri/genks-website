"use client";
import {useId,useSyncExternalStore} from 'react';
import {createPortal} from 'react-dom';
import {serviceAmount} from '@/lib/service-rates';
import styles from './live-order-summary.module.css';
const subscribe=()=>()=>{};
export function LiveOrderSummary({total,dueNow,balance,lines=[]}:{total?:number;dueNow?:number;balance?:number;lines?:{name:string;amount:number}[]}){
 const mounted=useSyncExternalStore(subscribe,()=>true,()=>false),id=useId();
 if(!mounted)return null;
 return createPortal(<aside className={styles.bar} data-genks-live-summary aria-label="Riepilogo sempre visibile">
 <div className={styles.amounts} aria-live="polite" aria-atomic="true"><div><span>Totale</span><strong>{total===undefined?'Da configurare':serviceAmount(total)}</strong></div><div><span>Da versare ora</span><strong>{dueNow===undefined?'—':serviceAmount(dueNow)}</strong></div><div><span>Saldo ancora da pagare</span><strong>{balance===undefined?'—':serviceAmount(balance)}</strong></div></div>
 <details className={styles.details}><summary aria-controls={id}>Riepilogo <span aria-hidden="true">⌃</span></summary><div className={styles.breakdown} id={id}><h2>Il tuo riepilogo</h2>{total===undefined?<p>Completa i dettagli per calcolare il totale.</p>:lines.map((line,i)=><p key={i}><span>{line.name}</span><strong>{serviceAmount(line.amount)}</strong></p>)}<small>Il totale viene ricalcolato sul server prima del pagamento.</small></div></details>
 </aside>,document.body);
}
