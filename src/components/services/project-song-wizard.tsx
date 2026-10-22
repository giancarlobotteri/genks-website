"use client";
import { useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, CreditCard } from "lucide-react";
import { createProject } from "@/app/services/actions";
import { ServiceSubmit } from "./service-submit";
import { projectPrice, projectDelivery, serviceAmount, projectRateVersion } from "@/lib/service-rates";
import { emptyProjectSong, maxProjectSongs, priceProjectSongs, type ProjectSong } from "@/lib/project-songs";
import styles from "./project-payment-options.module.css";
import {buildServiceQuote} from "@/lib/service-quote";
import {packageByCode} from "@/lib/service-catalog";
import {deliveryDateLabel} from "@/lib/service-delivery";
import {discountPrice,type PublicDiscount} from "@/lib/public-discounts";
const services=[{code:"mix",title:"Mix"},{code:"master",title:"Master"},{code:"mix_master",title:"Mix & Master"}];

export function ProjectRequestForm({initialService,remoteCardReady,discounts=[],packageCode=""}:{packageCode?:string;initialService:string;remoteCardReady:boolean;discounts?:PublicDiscount[]}) {
 const pack=packageByCode(packageCode);
 const [mode,setMode]=useState(""),[payment]=useState("card");
 const [rush,setRush]=useState(false);
 const [songs,setSongs]=useState<ProjectSong[]>(Array.from({length:pack?.songs??1},()=>({...emptyProjectSong(),service:pack?.service??initialService})));
 const [step,setStep]=useState(-1),[early,setEarly]=useState(false),[error,setError]=useState("");
 const form=useRef<HTMLFormElement>(null),title=useRef<HTMLHeadingElement>(null);
 const count=songs.length,review=count+1,song=step>=0&&step<count?songs[step]:null;
 const service=song?.service??songs[0].service??initialService;
 let quote:ReturnType<typeof buildServiceQuote>|null=null;
 try{quote=buildServiceQuote({songs,packageCode,rush,earlyStart:early},discounts);}catch{}
 const total=quote?.totalCents??null;
 const songPrice=(tracks:number,selected=service)=>{const base=projectPrice(selected,tracks);return base===null?null:discountPrice(base,[selected,"projects","services"],discounts);};
 const go=(next:number)=>{setError("");setStep(next);requestAnimationFrame(()=>{title.current?.focus({preventScroll:true});title.current?.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth",block:"start"});});};
 const update=(patch:Partial<ProjectSong>)=>setSongs(all=>all.map((s,i)=>i===step?{...s,...patch}:s));
 const next=()=>{
  for(const input of form.current?.querySelectorAll<HTMLInputElement|HTMLTextAreaElement>(`[data-step="${step}"] input,[data-step="${step}"] textarea`)??[])if(!input.reportValidity())return;
  if(song&&!priceProjectSongs(service,[song])){setError("Controlla i dettagli del brano. Oltre 48 tracce serve un preventivo.");return;}
  if(step===count&&(!mode||!payment)){setError("Scegli modalità di lavoro e pagamento.");return;}
  go(step+1);
 };
 const submit=(event:FormEvent<HTMLFormElement>)=>{if(step!==review){event.preventDefault();next();}};
 return <form ref={form} action={createProject} onSubmit={submit} className="premium-form form-grid service-request-form">
  <input type="hidden" name="rateVersion" value={projectRateVersion}/><input type="hidden" name="service" value={songs[0].service??initialService}/><input type="hidden" name="songs" value={JSON.stringify(songs)}/>
  <input type="hidden" name="packageCode" value={packageCode}/><input type="hidden" name="rush" value={String(rush)}/><input type="hidden" name="payment" value="card"/><input type="hidden" name="expectedTotal" value={total??""}/>
  <label className="form-honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off"/></label>
  <div className={`${styles.progress} full`} aria-label="Avanzamento richiesta"><span>{step<0?"Il tuo progetto":step<count?`Brano ${step+1} di ${count}`:step===count?"Modalità e pagamento":"Riepilogo finale"}</span><span>{Math.round((step+2)/(count+3)*100)}%</span><progress max={count+3} value={step+2}/></div>
  {packageCode&&!pack&&<p role="alert" className="notice error full">Pacchetto non valido. Torna al listino servizi.</p>}<h2 ref={title} tabIndex={-1} className={`${styles.stepTitle} full`}>{step<0?"Da quanti brani partiamo?":step<count?`Prepariamo il brano ${step+1}.`:step===count?"Come lavoriamo insieme?":"Controlla il tuo progetto."}</h2>
  <fieldset hidden={step!==-1} disabled={step!==-1} data-step="-1" className={`${styles.step} full`}><legend className="sr-only">Servizio e numero di brani</legend>

   <label>Quanti brani vuoi lavorare?<select disabled={Boolean(pack)} value={count} onChange={event=>{const n=Number(event.target.value);setSongs(all=>Array.from({length:n},(_,i)=>all[i]??{...emptyProjectSong(),service:""}));}}>{Array.from({length:maxProjectSongs},(_,i)=><option key={i} value={i+1}>{i+1} {i?"brani":"brano"}</option>)}</select></label>
   <p>Un brano alla volta, con dettagli e prezzo separati. Alla fine trovi un unico totale. Per più di {maxProjectSongs} brani <a href="mailto:assistenza@prodbygenks.com">contatta GENKS</a>.</p>

  </fieldset>
  <fieldset hidden={step!==0} disabled={step<0} data-step="0" className={`${styles.step} full`}><legend>I tuoi contatti · una sola volta</legend><p className="fine-print">Valgono per tutti i brani della richiesta.</p>
   <label>Nome<input name="name" required minLength={2} maxLength={120} autoComplete="name"/></label><label>Nome d’arte <small>facoltativo</small><input name="artistName" maxLength={120}/></label><label>Email<input name="email" type="email" required autoComplete="email"/></label><label>Telefono <small>facoltativo</small><input name="phone" type="tel" maxLength={40} autoComplete="tel"/></label>
  </fieldset>
  {song&&<fieldset className={`${styles.step} full`} key={step} data-step={step}><legend className="sr-only">Dettagli brano {step+1}</legend>
   {pack&&<p className="notice">{pack.name} · {pack.songs} brani · {pack.description}</p>}<div className="project-service-options">{services.map(s=><label key={s.code} className={service===s.code?"selected":""}><input type="radio" name="serviceChoice" checked={service===s.code} value={s.code} disabled={Boolean(pack)} required onChange={()=>{update({service:s.code,...(s.code==="master"?{trackCount:1}:{})});}}/><strong>{s.title}</strong></label>)}</div>
   {service&&<div className="service-rate-list" aria-label="Prezzi del servizio">{(service==="master"?[{tracks:1,label:"1 mix stereo"}]:[{tracks:8,label:"Fino a 8 tracce"},{tracks:24,label:"9–24 tracce"},{tracks:48,label:"25–48 tracce"}]).map(t=><div key={t.tracks}><span>{t.label}</span><strong>{songPrice(t.tracks)!==projectPrice(service,t.tracks)&&<del>{serviceAmount(projectPrice(service,t.tracks)!)}</del>}{serviceAmount(songPrice(t.tracks)!)}</strong></div>)}<small>Prezzo per brano · 2 revisioni · prima versione in 7 giorni lavorativi dall’avvio consentito.</small></div>}
   <label>Titolo del brano {step+1}<input required maxLength={160} value={song.trackTitle} onChange={e=>update({trackTitle:e.target.value})} placeholder="Titolo, anche provvisorio"/></label>
   <label>{service==="master"?"Mix stereo per questo brano":"Numero di tracce audio separate"}<input type="number" required min="1" max={service==="master"?1:48} readOnly={service==="master"} value={song.trackCount||""} onChange={e=>update({trackCount:Number(e.target.value)})}/><small>Conta i file audio mono o stereo di questo brano. Per il master si usa un solo mix stereo.</small></label>
   <label>Descrizione del brano<textarea required minLength={10} maxLength={4000} rows={4} value={song.description} onChange={e=>update({description:e.target.value})} placeholder="Descrivi il risultato che cerchi per questo brano."/></label>
   <label>Scadenza desiderata <small>facoltativa</small><input type="date" value={song.desiredDeadline} onChange={e=>update({desiredDeadline:e.target.value})}/></label>
   <details className="service-optional"><summary>Riferimenti e note <span>facoltativi</span></summary><div><label>Collegamenti di riferimento<textarea rows={2} maxLength={2000} value={song.referenceLinks} onChange={e=>update({referenceLinks:e.target.value})}/></label><label>Note<textarea rows={3} maxLength={2000} value={song.notes} onChange={e=>update({notes:e.target.value})}/></label></div></details>
   <fieldset><legend>Extra per questo brano</legend>
   <label><input type="checkbox" checked={Boolean(song.vocalTracks)} onChange={e=>update({vocalTracks:e.target.checked?1:0})}/>Tuning ed editing voce · 15 € a traccia vocale</label>{Boolean(song.vocalTracks)&&<label>Tracce vocali<input type="number" min="1" max={Math.min(48,song.trackCount)} value={song.vocalTracks} onChange={e=>update({vocalTracks:Number(e.target.value)})}/></label>}
   <label><input type="checkbox" checked={packageCode==="single"||song.versions===true} disabled={packageCode==="single"} onChange={e=>update({versions:e.target.checked})}/>Versioni strumentale e a cappella · {packageCode==="single"?"incluse nel pacchetto":"19,99 €"}</label>
   <label><input type="checkbox" checked={packageCode==="single"||song.extraRevision===true} disabled={packageCode==="single"} onChange={e=>update({extraRevision:e.target.checked})}/>Revisione extra (oltre le 2 incluse) · {packageCode==="single"?"inclusa nel pacchetto":"15 €"}</label>
   </fieldset>
   <aside className="notice" aria-live="polite"><strong>Servizio base per questo brano: {songPrice(song.trackCount)===null?"Controlla le tracce":serviceAmount(songPrice(song.trackCount)!)}</strong><p>Extra e pacchetto sono conteggiati nel riepilogo finale. I dettagli restano salvati mentre passi al prossimo brano o torni indietro.</p></aside>
  </fieldset>}
  <fieldset hidden={step!==count} disabled={step<count} data-step={count} className={`${styles.step} full`}><legend className="sr-only">Contatti e pagamento</legend>
   <div className="project-mode-options"><strong>Come vuoi lavorare?</strong><label><input type="radio" name="mode" value="remote" checked={mode==="remote"} required onChange={()=>{setMode("remote");}}/><span><strong>A distanza</strong><small>Invio dei file online.</small></span></label><label><input type="radio" name="mode" value="studio" checked={mode==="studio"} required onChange={()=>setMode("studio")}/><span><strong>Fisicamente in studio</strong><small>Incontro da organizzare; nessuno slot di registrazione prenotato automaticamente.</small></span></label></div>
   <div className={`project-mode-options ${styles.options}`}><CreditCard size={24}/><strong>Paghi online con carta o Apple Pay.</strong><p>Disponibile a distanza e lavorando fisicamente in studio.</p></div>
   {!remoteCardReady&&<p className="notice">Carta temporaneamente non disponibile. <a href="mailto:assistenza@prodbygenks.com">Contatta GENKS</a>.</p>}

  </fieldset>
  {step===review&&<section className={`${styles.review} full`} aria-label="Riepilogo dei brani"><p>{count} {count===1?"brano":"brani"} · Servizi scelti per ciascun brano · {mode==="studio"?"Fisicamente in studio":"A distanza"} · {payment==="card"?"Carta":"Contanti in studio"}</p>
   {(quote?.songs??songs).map((s,i)=><article key={i}><div><span>BRANO {i+1}</span><strong>{s.trackTitle}</strong><small>{services.find(v=>v.code===s.service)?.title} · {s.trackCount} tracce · {s.extraRevision?"2 revisioni incluse + 1 revisione extra":"2 revisioni incluse"}</small>{s.versions&&<small>Versioni strumentale e a cappella{packageCode==="single"?" incluse nel pacchetto":""}</small>}{Boolean(s.vocalTracks)&&<small>Tuning ed editing: {s.vocalTracks} tracce vocali</small>}</div><button type="button" onClick={()=>go(i)}>Modifica</button></article>)}
   {quote?.lines.map((line,i)=><p key={i}>{line.name} · {line.quantity} × {serviceAmount(line.unitAmount)} = <strong>{serviceAmount(line.quantity*line.unitAmount)}</strong></p>)}
   {quote&&<p>Data prevista della prima versione: <strong>{deliveryDateLabel(quote.estimatedFirstVersionAt)}</strong><br/>{quote.estimateBasis}</p>}
   <div className={styles.total}><span>Totale · {count} {count===1?"brano":"brani"}</span><strong>{total===null?"Controlla i brani":serviceAmount(total)}</strong></div>
   <label className="consent-label"><input name="accepted" type="checkbox" required/>Accetto il totale di {total===null?"—":serviceAmount(total)} e il pagamento {payment==="card"?"con carta tramite Stripe":"in contanti presso lo studio"}. Ho letto le <a href="/legal/terms" target="_blank" rel="noreferrer">condizioni del servizio e dei rimborsi</a> e l’<a href="/legal/privacy" target="_blank" rel="noreferrer">informativa privacy</a>. Due revisioni per ciascun brano. {rush?"Prima versione entro 48 ore da pagamento, file completi e avvio consentito.":projectDelivery}</label>
   <label className="consent-label"><input name="earlyStart" type="checkbox" checked={early} onChange={e=>setEarly(e.target.checked)}/>Chiedo espressamente l’avvio prima dei 14 giorni del recesso. Facoltativo: altrimenti il lavoro inizia dopo tale termine.</label>
   {early&&<label className="consent-label"><input type="checkbox" name="withdrawalAcknowledged" required/>Riconosco che perderò il diritto di recesso solo a servizio interamente eseguito. Prima può essere dovuto solo l’importo proporzionale al lavoro svolto, nei casi previsti dalla legge.</label>}
   <p className="fine-print">Le scadenze desiderate non sono promesse di consegna. Le revisioni riguardano il materiale iniziale di ciascun brano; nuovi file o lavorazioni oltre gli extra scelti richiedono un preventivo separato.</p><label className="notice"><input type="checkbox" checked={rush} onChange={e=>setRush(e.target.checked)}/>Consegna in 48 ore: +30 €<br/>Ti serve prima? Ricevi la prima versione entro 48 ore.</label><ServiceSubmit label={payment==="card"?"Continua al pagamento":"Conferma la prenotazione"} disabled={total===null||payment==="card"&&!remoteCardReady}/>
  </section>}
  {error&&<p className="notice error full" role="alert">{error}</p>}
  <div className={`${styles.navigation} full`}>{step>=0&&<button className="button button-secondary" type="button" onClick={()=>go(step-1)}><ArrowLeft size={16} aria-hidden="true"/>Indietro</button>}{step<review&&<button className="button button-primary" type="button" onClick={next}>{step<0?"Inizia con il primo brano":step<count-1?"Salva e passa al prossimo brano":step===count-1?"Scegli come lavorare e pagare":"Controlla il riepilogo"}<ArrowRight size={16} aria-hidden="true"/></button>}</div>
 </form>;
}
