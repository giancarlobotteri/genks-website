"use client";
import {useState,useEffect} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {ArtistStepper} from './artist-stepper';
import {type ProductionInput,type ProductionSong} from '@/lib/production-calculator';
import {productionSelection} from '@/lib/production-order';
import {quoteOrder,type OrderSelection} from '@/lib/service-order-v8';
import type {PublicDiscount} from '@/lib/public-discounts';
import {serviceAmount} from '@/lib/service-rates';
import {storeService} from '@/lib/service-cart-storage';
import {StudioScheduler} from './studio-scheduler';
import {HomeCartPreview} from './service-cart-rail-v8';
const fresh=():ProductionSong=>({servizio:'mix_master',produzione:'genks',tracce:8,artisti:1,revisioni_extra:0,consegna_veloce:false});
export function ProductionProjectBuilder({initial,discounts=[]}:{initial?:ProductionInput;discounts?:PublicDiscount[]}){
 const router=useRouter();
 const [clock,setClock]=useState(()=>Date.now());useEffect(()=>{const t=setInterval(()=>setClock(Date.now()),15000);return()=>clearInterval(t);},[]);
 const [item,setItem]=useState<OrderSelection>(()=>productionSelection(initial??{format:'ep',brani:Array.from({length:4},fresh),registrazione:true,ore_extra:0}));
 const [step,setStep]=useState(0),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const project=item.production!,song=project.brani[step],appointment=item.appointments![step];
 const patch=(v:Partial<OrderSelection>)=>setItem(old=>({...old,...v}));
 const update=(v:Partial<ProductionSong>,all=false)=>patch({production:{...project,brani:project.brani.map((s,i)=>all||i===step?{...s,...v}:s)}});
 const schedule=(v:Partial<OrderSelection>)=>{const appointments=item.appointments!.map((a,i)=>i===step?{...a,...v.date!==undefined?{date:v.date}:{},...v.time!==undefined?{time:v.time}:{},...v.hours!==undefined?{extraHours:v.hours-2}:{}}:a);patch({appointments,production:{...project,ore_extra:appointments.reduce((n,a)=>n+a.extraHours,0)}});};
 const changeCount=(n:number)=>{const next=productionSelection({...project,brani:Array.from({length:n},(_,i)=>project.brani[i]??fresh()),ore_extra:0});next.payment=item.payment;patch({...next,appointments:next.appointments!.map((a,i)=>item.appointments?.[i]??a),production:{...next.production!,ore_extra:item.appointments!.slice(0,n).reduce((sum,a)=>sum+a.extraHours,0)}});setStep(Math.min(step,n-1));};
 let part:ReturnType<typeof quoteOrder>['parts'][number]|undefined;try{part=quoteOrder([item],true,new Date(),discounts).parts[0];}catch{}
 const buy=async(direct:boolean)=>{setMessage('');try{quoteOrder([item],true,new Date(),discounts,{requireFiles:true});setBusy(true);await storeService(item,direct);if(direct)router.push('/services/checkout?direct=1');else setMessage('Progetto aggiunto al carrello.');}catch(e){setMessage(e instanceof Error?e.message:'Controlla gli appuntamenti.');}finally{setBusy(false);}};
 return <div className="service-v8-layout"><section className="premium-form"><header className="service-form-heading"><span className="eyebrow">GENKS · IL PIÙ SCELTO</span><h1>Il tuo EP o album, completo</h1><p>Per ogni brano: produzione GENKS da 34,99 €, mix della fascia, master 29,99 €, una revisione e 2 ore di registrazione incluse.</p></header>
 <fieldset className="payment-choice"><legend>Che progetto vuoi realizzare?</legend>{(['ep','album'] as const).map(format=><label key={format}><input type="radio" checked={(project.format??'ep')===format} onChange={()=>patch({production:{...project,format}})}/>{format==='ep'?'EP':'Album'}</label>)}</fieldset>
 <div className="studio-duration-control" aria-label="Numero di brani"><button type="button" aria-label="Riduci numero di brani" disabled={project.brani.length<=2} onClick={()=>changeCount(project.brani.length-1)}>−</button><strong>{project.brani.length} brani</strong><button type="button" aria-label="Aumenta numero di brani" disabled={project.brani.length>=20} onClick={()=>changeCount(project.brani.length+1)}>+</button></div>
 {part&&<div className="service-v8-mobile-total" aria-live="polite"><strong>Totale {serviceAmount(part.total)}</strong><span>Risparmi {serviceAmount(part.saving)} · Ora {serviceAmount(part.dueNow)}</span></div>}
 <nav className="service-v8-tabs" aria-label="Brani del progetto">{project.brani.map((_,i)=><button type="button" aria-pressed={i===step} key={i} onClick={()=>setStep(i)}>Brano {i+1}{item.appointments?.[i]?.time?' ✓':''}</button>)}</nav>
 <section className="service-config-card"><h2>Brano {step+1}</h2><label>Tracce audio separate<input type="number" min={1} max={1000} value={song.tracce} onChange={e=>update({tracce:Number(e.target.value)})}/><small>Fino a 8: mix 29,99 €. Oltre 48: 119,99 € + 2,00 € per traccia aggiuntiva. Per una produzione da realizzare, il totale usa la quantità indicata.</small></label>
 <ArtistStepper value={song.artisti} onChange={artisti=>update({artisti})}/><button type="button" className="button button-secondary" onClick={()=>update({tracce:song.tracce,artisti:song.artisti},true)}>Usa queste quantità per tutti i brani</button>
 <h3>Le tue 2 ore incluse</h3><p>Scegli il giorno e l’orario per questo brano. Le sessioni degli altri brani possono essere in giorni diversi.</p>
 <label>Ore aggiuntive da prenotare<select value={appointment.extraHours} onChange={e=>schedule({hours:2+Number(e.target.value),time:''})}>{Array.from({length:7},(_,n)=><option key={n} value={n}>{n===0?'Nessuna · 2 ore incluse':`${n} ore in più · ${serviceAmount(n*1999)}`}</option>)}</select></label>
 <StudioScheduler key={step} value={{...item,date:appointment.date,time:appointment.time,hours:2+appointment.extraHours}} bundle={false} fixedHours={2+appointment.extraHours} clock={clock} onChange={schedule} onValidityChange={()=>{}}/>
 <div className="project-song-navigation">{step>0&&<button className="button button-secondary" type="button" onClick={()=>setStep(step-1)}>← Precedente</button>}{step<project.brani.length-1&&<button className="button button-primary" type="button" onClick={()=>setStep(step+1)}>Prossimo brano →</button>}</div></section>
 <p className="notice">Produzioni GENKS, anche con altri producer in collaborazione. Split e accordi si definiscono prima del lavoro; il 100% dei diritti richiede un preventivo. Non serve un link SwissTransfer per una base che devo ancora produrre.</p>
 <fieldset className="payment-choice"><legend>Come vuoi pagare?</legend><label><input type="radio" checked={item.payment==='card'} onChange={()=>patch({payment:'card'})}/>Carta o Apple Pay</label><label><input type="radio" checked={item.payment==='cash'} onChange={()=>patch({payment:'cash'})}/>Contanti in studio</label></fieldset>{item.payment==='cash'&&<p className="notice">Passa in studio con il codice ordine e versa il totale del progetto. Le sessioni si confermano dopo l’incasso; il termine è a metà del tempo tra ordine e appuntamento.</p>}
 <div className="service-v8-actions"><button className="button button-primary" disabled={busy||!part} onClick={()=>void buy(true)}>Acquista ora</button><button className="button button-secondary" disabled={busy||!part} onClick={()=>void buy(false)}>Aggiungi al carrello</button></div>{message&&<p role="status" className="notice">{message}</p>}
 </section><div className="service-side-stack"><aside className="service-v8-summary" aria-live="polite"><h2>Il tuo progetto</h2>{part?<><div className="service-summary-total"><span>Totale, tutti i brani</span><h3>{serviceAmount(part.total)}</h3></div><p><del>{serviceAmount(part.listTotal)}</del> · Risparmi <strong>{serviceAmount(part.saving)}</strong></p><p>Da versare ora <strong>{serviceAmount(part.dueNow)}</strong> · Saldo {serviceAmount(part.balance)}</p><details><summary>Prezzi per brano</summary><div className="quote-lines">{part.lines.map((l,i)=><div className="quote-line" key={i}><span>{l.name}</span><strong>{serviceAmount(l.amount)}</strong></div>)}</div></details><p>{project.brani.length*2} ore di registrazione incluse, ripartite tra i brani. Il totale configurato si paga subito. Eventuali prolungamenti non previsti si conteggiano e pagano dopo la sessione, secondo disponibilità.</p><Link href="/legal/refunds">Condizioni della garanzia</Link></>:<p>Controlla le quantità.</p>}</aside><HomeCartPreview embedded discounts={discounts}/></div></div>;
}
