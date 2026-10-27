"use client";
import {useState} from 'react';
import Link from 'next/link';
import {formatPrice} from '@/lib/format';
import styles from './sales-depth-chart.module.css';
type Day={day:string;gross:number;refunded:number;count:number};
export function SalesDepthChart({days,mode,archive}:{days:Day[];mode:string;archive:boolean}){
 const [tilt,setTilt]=useState(16),[selected,setSelected]=useState<Day|null>(null),[metric,setMetric]=useState<'gross'|'refunded'>('gross');
 const max=Math.max(1,...days.map(d=>d[metric]));
 return <section className="admin-form-card" aria-label="Grafico interattivo degli incassi"><header><span className="eyebrow">IL TUO STUDIO IN NUMERI</span><h2>Ultimi 30 giorni</h2><p>Passa su una colonna o selezionala con la tastiera. Premi per aprire i pagamenti di quel giorno.</p></header><div className={styles.tools}><label>Visualizza<select value={metric} onChange={e=>setMetric(e.target.value as 'gross'|'refunded')}><option value="gross">Incassi</option><option value="refunded">Rimborsi</option></select></label><label>Prospettiva 3D<input type="range" min={0} max={28} value={tilt} onChange={e=>setTilt(Number(e.target.value))}/></label><output aria-live="polite">{selected?`${selected.day} · ${formatPrice(selected[metric])} · ${selected.count} pagamenti`:'Seleziona un giorno'}</output></div><div className={styles.viewport}><div className={styles.chart} style={{transform:`perspective(1000px) rotateX(${tilt}deg)`}}>{days.map(d=><Link key={d.day} href={`/admin/analytics?${new URLSearchParams({mode,period:'day',anchor:d.day,day:d.day,archive:archive?'1':'0'})}`} onMouseEnter={()=>setSelected(d)} onFocus={()=>setSelected(d)} aria-label={`${d.day}: ${formatPrice(d[metric])}, ${d.count} pagamenti`}><span style={{height:`${Math.max(d[metric]?3:0,d[metric]/max*100)}%`}}/><small>{d.day.slice(8)}</small></Link>)}</div></div><p className="fine-print">Altezza delle colonne proporzionale agli importi. Scala massima: {formatPrice(max===1?0:max)}. I giorni senza incassi restano a zero.</p></section>;
}
