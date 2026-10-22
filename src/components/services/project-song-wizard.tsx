"use client";
import { useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, CreditCard, Banknote } from "lucide-react";
import { createProject } from "@/app/services/actions";
import { ServiceSubmit } from "./service-submit";
import { projectPrice, projectDelivery, serviceAmount, projectRateVersion } from "@/lib/service-rates";
import { emptyProjectSong, maxProjectSongs, priceProjectSongs, type ProjectSong } from "@/lib/project-songs";
import styles from "./project-payment-options.module.css";
const services=[{code:"mix",title:"Mix"},{code:"master",title:"Master"},{code:"mix_master",title:"Mix & Master"}];

export function ProjectRequestForm({initialService,remoteCardReady}:{initialService:string;remoteCardReady:boolean}) {
 const [service,setService]=useState(initialService),[mode,setMode]=useState(""),[payment,setPayment]=useState("");
 const [songs,setSongs]=useState<ProjectSong[]>([emptyProjectSong()]);
 const [step,setStep]=useState(-1),[early,setEarly]=useState(false),[error,setError]=useState("");
 const form=useRef<HTMLFormElement>(null),title=useRef<HTMLHeadingElement>(null);
 const count=songs.length,review=count+1,song=step>=0&&step<count?songs[step]:null;
 const priced=priceProjectSongs(service,songs),total=priced?.reduce((sum,s)=>sum+s.amountCents,0)??null;
 const go=(next:number)=>{setError("");setStep(next);requestAnimationFrame(()=>{title.current?.focus({preventScroll:true});title.current?.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth",block:"start"});});};
 const update=(patch:Partial<ProjectSong>)=>setSongs(all=>all.map((s,i)=>i===step?{...s,...patch}:s));
 const next=()=>{
  for(const input of form.current?.querySelectorAll<HTMLInputElement|HTMLTextAreaElement>(`[data-step="${step}"] input,[data-step="${step}"] textarea`)??[])if(!input.reportValidity())return;
  if(step===-1&&!service){setError("Scegli il servizio.");return;}
  if(song&&!priceProjectSongs(service,[song])){setError("Controlla i dettagli del brano. Oltre 48 tracce serve un preventivo.");return;}
  if(step===count&&(!mode||!payment||payment==="cash"&&mode!=="studio")){setError("Scegli modalità di lavoro e pagamento.");return;}
  go(step+1);
 };
 const submit=(event:FormEvent<HTMLFormElement>)=>{if(step!==review){event.preventDefault();next();}};
 return <form ref={form} action={createProject} onSubmit={submit} className="premium-form form-grid service-request-form">
  <input type="hidden" name="rateVersion" value={projectRateVersion}/><input type="hidden" name="service" value={service}/><input type="hidden" name="songs" value={JSON.stringify(songs)}/>
  <label className="form-honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off"/></label>
  <div className={`${styles.progress} full`} aria-label="Avanzamento richiesta"><span>{step<0?"Il tuo progetto":step<count?`Brano ${step+1} di ${count}`:step===count?"Contatti e pagamento":"Riepilogo finale"}</span><span>{Math.round((step+2)/(count+3)*100)}%</span><progress max={count+3} value={step+2}/></div>
  <h2 ref={title} tabIndex={-1} className={`${styles.stepTitle} full`}>{step<0?"Da quanti brani partiamo?":step<count?`Prepariamo il brano ${step+1}.`:step===count?"Come lavoriamo insieme?":"Controlla il tuo progetto."}</h2>
  <fieldset hidden={step!==-1} disabled={step!==-1} data-step="-1" className={`${styles.step} full`}><legend className="sr-only">Servizio e numero di brani</legend>
   <div className="project-service-options">{services.map(s=><label key={s.code} className={service===s.code?"selected":""}><input type="radio" name="serviceChoice" checked={service===s.code} value={s.code} required onChange={()=>{setService(s.code);if(s.code==="master")setSongs(all=>all.map(x=>({...x,trackCount:1})));}}/><strong>{s.title}</strong></label>)}</div>
   <label>Quanti brani vuoi lavorare?<select value={count} onChange={event=>{const n=Number(event.target.value);setSongs(all=>Array.from({length:n},(_,i)=>all[i]??emptyProjectSong()));}}>{Array.from({length:maxProjectSongs},(_,i)=><option key={i} value={i+1}>{i+1} {i?"brani":"brano"}</option>)}</select></label>
   <p>Un brano alla volta, con dettagli e prezzo separati. Alla fine trovi un unico totale. Per più di {maxProjectSongs} brani <a href="mailto:assistenza@prodbygenks.com">contatta GENKS</a>.</p>
   <p className="fine-print">Mix: 89,99 / 139,99 / 199,99 €. Mix + master: 119,99 / 179,99 / 239,99 €, nelle fasce 1–8 / 9–24 / 25–48 tracce per brano. Master stereo: 39,99 € per brano. Due revisioni per ogni brano. {projectDelivery}</p>
  </fieldset>
  {song&&<fieldset className={`${styles.step} full`} key={step} data-step={step}><legend className="sr-only">Dettagli brano {step+1}</legend>
   <label>Titolo del brano {step+1}<input required maxLength={160} value={song.trackTitle} onChange={e=>update({trackTitle:e.target.value})} placeholder="Titolo, anche provvisorio"/></label>
   <label>{service==="master"?"Mix stereo per questo brano":"Numero di tracce audio separate"}<input type="number" required min="1" max={service==="master"?1:48} readOnly={service==="master"} value={song.trackCount||""} onChange={e=>update({trackCount:Number(e.target.value)})}/><small>Conta i file audio mono o stereo di questo brano. Per il master si usa un solo mix stereo.</small></label>
   <label>Descrizione del brano<textarea required minLength={10} maxLength={4000} rows={4} value={song.description} onChange={e=>update({description:e.target.value})} placeholder="Descrivi il risultato che cerchi per questo brano."/></label>
   <label>Scadenza desiderata <small>facoltativa</small><input type="date" value={song.desiredDeadline} onChange={e=>update({desiredDeadline:e.target.value})}/></label>
   <details className="service-optional"><summary>Riferimenti e note <span>facoltativi</span></summary><div><label>Collegamenti di riferimento<textarea rows={2} maxLength={2000} value={song.referenceLinks} onChange={e=>update({referenceLinks:e.target.value})}/></label><label>Note<textarea rows={3} maxLength={2000} value={song.notes} onChange={e=>update({notes:e.target.value})}/></label></div></details>
   <aside className="notice" aria-live="polite"><strong>Questo brano: {projectPrice(service,song.trackCount)===null?"Controlla le tracce":serviceAmount(projectPrice(service,song.trackCount)!)}</strong><p>I dettagli restano salvati mentre passi al prossimo brano o torni indietro.</p></aside>
  </fieldset>}
  <fieldset hidden={step!==count} disabled={step<count} data-step={count} className={`${styles.step} full`}><legend className="sr-only">Contatti e pagamento</legend>
   <div className="project-mode-options"><strong>Come vuoi lavorare?</strong><label><input type="radio" name="mode" value="remote" checked={mode==="remote"} required onChange={()=>{setMode("remote");if(payment==="cash")setPayment("");}}/><span><strong>A distanza</strong><small>Invio dei file online.</small></span></label><label><input type="radio" name="mode" value="studio" checked={mode==="studio"} required onChange={()=>setMode("studio")}/><span><strong>Fisicamente in studio</strong><small>Incontro da organizzare; nessuno slot di registrazione prenotato automaticamente.</small></span></label></div>
   <div className={`project-mode-options ${styles.options}`}><strong>Scegli come pagare</strong><label className={payment==="card"?styles.selected:""}><input type="radio" name="payment" value="card" checked={payment==="card"} required disabled={!remoteCardReady} onChange={()=>setPayment("card")}/><CreditCard size={24} aria-hidden="true"/><span><strong>Carta · pagamento online</strong><small>Un unico pagamento Stripe, in studio o a distanza. Apple Pay sui dispositivi compatibili.</small></span></label><label className={payment==="cash"?styles.selected:""}><input type="radio" name="payment" value="cash" checked={payment==="cash"} required disabled={mode!=="studio"} onChange={()=>setPayment("cash")}/><Banknote size={24} aria-hidden="true"/><span><strong>Contanti · presso lo studio</strong><small>Disponibili per il lavoro fisicamente in studio.</small></span></label></div>
   {!remoteCardReady&&<p className="notice">Carta temporaneamente non disponibile. <a href="mailto:assistenza@prodbygenks.com">Contatta GENKS</a>.</p>}
   <label>Nome<input name="name" required minLength={2} maxLength={120} autoComplete="name"/></label><label>Nome d’arte <small>facoltativo</small><input name="artistName" maxLength={120}/></label><label>Email<input name="email" type="email" required autoComplete="email"/></label><label>Telefono <small>facoltativo</small><input name="phone" type="tel" maxLength={40} autoComplete="tel"/></label>
  </fieldset>
  {step===review&&<section className={`${styles.review} full`} aria-label="Riepilogo dei brani"><p>{count} {count===1?"brano":"brani"} · {services.find(s=>s.code===service)?.title} · {mode==="studio"?"Fisicamente in studio":"A distanza"} · {payment==="card"?"Carta":"Contanti in studio"}</p>
   {songs.map((s,i)=><article key={i}><div><span>BRANO {i+1}</span><strong>{s.trackTitle}</strong><small>{s.trackCount} {s.trackCount===1?"traccia":"tracce"} · 2 revisioni incluse</small></div><strong>{serviceAmount(projectPrice(service,s.trackCount)??0)}</strong><button type="button" onClick={()=>go(i)}>Modifica</button></article>)}
   <div className={styles.total}><span>Totale · {count} {count===1?"brano":"brani"}</span><strong>{total===null?"Controlla i brani":serviceAmount(total)}</strong></div>
   <label className="consent-label"><input name="accepted" type="checkbox" required/>Accetto il totale di {total===null?"—":serviceAmount(total)} e il pagamento {payment==="card"?"con carta tramite Stripe":"in contanti presso lo studio"}. Ho letto le <a href="/legal/terms" target="_blank" rel="noreferrer">condizioni del servizio e dei rimborsi</a> e l’<a href="/legal/privacy" target="_blank" rel="noreferrer">informativa privacy</a>. Due revisioni per ciascun brano. {projectDelivery}</label>
   <label className="consent-label"><input name="earlyStart" type="checkbox" checked={early} onChange={e=>setEarly(e.target.checked)}/>Chiedo espressamente l’avvio prima dei 14 giorni del recesso. Facoltativo: altrimenti il lavoro inizia dopo tale termine.</label>
   {early&&<label className="consent-label"><input type="checkbox" name="withdrawalAcknowledged" required/>Riconosco che perderò il diritto di recesso solo a servizio interamente eseguito. Prima può essere dovuto solo l’importo proporzionale al lavoro svolto, nei casi previsti dalla legge.</label>}
   <p className="fine-print">Le scadenze desiderate non sono promesse di consegna. Le revisioni riguardano il materiale iniziale di ciascun brano; nuovi file o lavorazioni extra richiedono un preventivo separato.</p><ServiceSubmit label={payment==="card"?"Continua al pagamento":"Conferma la prenotazione"} disabled={total===null||payment==="card"&&!remoteCardReady}/>
  </section>}
  {error&&<p className="notice error full" role="alert">{error}</p>}
  <div className={`${styles.navigation} full`}>{step>=0&&<button className="button button-secondary" type="button" onClick={()=>go(step-1)}><ArrowLeft size={16} aria-hidden="true"/>Indietro</button>}{step<review&&<button className="button button-primary" type="button" onClick={next}>{step<0?"Inizia con il primo brano":step<count-1?"Salva e passa al prossimo brano":step===count-1?"Continua con i tuoi dati":"Controlla il riepilogo"}<ArrowRight size={16} aria-hidden="true"/></button>}</div>
 </form>;
}
