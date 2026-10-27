"use client";
import {useState} from 'react';
import type {OrderPart} from '@/lib/service-order-v8';
import {productionRates} from '@/lib/production-calculator';
import {serviceAmount} from '@/lib/service-rates';
export function ProductionChoices({part}:{part:OrderPart}){
 const [page,setPage]=useState(0);const choices=part.selection.production?.brani;
 if(!choices)return null;
 return <details><summary>Scelte dei {choices.length} brani</summary>{choices.slice(page*5,page*5+5).map((s,n)=>{const i=page*5+n;return <p key={i}><strong>{part.selection.songs[i].trackTitle}</strong><br/>{s.produzione==='genks'?`Produzione GENKS ${serviceAmount(productionRates.beat)}`:'Base già disponibile · produzione 0 €'} · {s.servizio==='none'?'Nessun mix/master':s.servizio.replaceAll('_',' + ')}{s.servizio==='mix'||s.servizio==='mix_master'?` · ${s.tracce} tracce audio separate`:''}</p>;})}{choices.length>5&&<div className="quote-part-navigation"><button type="button" disabled={page===0} onClick={()=>setPage(p=>p-1)}>←</button><span>{page+1} / {Math.ceil(choices.length/5)}</span><button type="button" disabled={(page+1)*5>=choices.length} onClick={()=>setPage(p=>p+1)}>→</button></div>}</details>;
}
export function OrderGuarantees({guarantees}:{guarantees:OrderPart['guarantees']}){
 const [page,setPage]=useState(0);if(!guarantees.length)return null;
 return <details><summary>Garanzia commerciale · importi per brano</summary>{guarantees.slice(page*5,page*5+5).map((g,i)=><p key={i}>{g.title} · 30% della lavorazione: {serviceAmount(g.amount)}</p>)}{guarantees.length>5&&<div className="quote-part-navigation"><button type="button" disabled={page===0} onClick={()=>setPage(p=>p-1)}>←</button><span>{page+1} / {Math.ceil(guarantees.length/5)}</span><button type="button" disabled={(page+1)*5>=guarantees.length} onClick={()=>setPage(p=>p+1)}>→</button></div>}</details>;
}
