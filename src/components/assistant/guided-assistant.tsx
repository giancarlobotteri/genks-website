"use client";
import {useEffect,useRef,useState,type FormEvent} from "react";
import {usePathname} from "next/navigation";
import Link from "next/link";
import {MessageCircle,Sparkles,X,ArrowRight,ArrowLeft} from "lucide-react";
import {recommendServices,type AdvisorInput,type AdvisorPlan} from "@/lib/service-advisor";
import {serviceAmount} from "@/lib/service-rates";
import type {PublicDiscount} from "@/lib/public-discounts";
import {site} from "@/config/site";
import styles from "./guided-assistant.module.css";

const goals=[
 {code:"mix",title:"Mix",detail:"Voce e strumenti da bilanciare."},
 {code:"master",title:"Master",detail:"Il mix è già pronto."},
 {code:"mix_master",title:"Mix + master",detail:"Il brano pronto per la pubblicazione."},
 {code:"recording",title:"Registrare in studio",detail:"Scegli quante ore ti servono."},
 {code:"complete",title:"Un progetto completo",detail:"Beat su misura, mix, master e studio se ti serve."},
 {code:"custom",title:"Un beat su misura",detail:"Una produzione da zero."},
] as const;
const initial:AdvisorInput={service:"mix_master",tracks:[8],studioHours:0,beat:false,versions:false,extraRevision:false,vocalTracks:0,mode:"remote"};
export function GuidedAssistant({discounts}:{discounts:PublicDiscount[]|null}){
 const pathname=usePathname(),[open,setOpen]=useState(false),[step,setStep]=useState(0),[goal,setGoal]=useState(""),[input,setInput]=useState<AdvisorInput>(initial),[plan,setPlan]=useState<AdvisorPlan|null>(null),[error,setError]=useState("");
 const panel=useRef<HTMLDivElement>(null),launcher=useRef<HTMLButtonElement>(null),body=useRef<HTMLDivElement>(null);
 const whatsapp=(text:string)=>`https://wa.me/${site.whatsapp.replace(/\D/g,"")}?text=${encodeURIComponent(text)}`;
 useEffect(()=>{
  if(!open)return;
  const previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow,launchButton=launcher.current;
  document.body.style.overflow="hidden";
  const frame=requestAnimationFrame(()=>panel.current?.querySelector<HTMLButtonElement>("button")?.focus());
  const onKey=(e:KeyboardEvent)=>{
   if(e.key==="Escape"){e.preventDefault();setOpen(false);}
   if(e.key==="Tab"){
    const items=[...(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled])')??[])].filter(e=>e.getClientRects().length);
    const first=items[0],last=items.at(-1);
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
   }
  };
  document.addEventListener("keydown",onKey);
  return()=>{cancelAnimationFrame(frame);document.body.style.overflow=overflow;document.removeEventListener("keydown",onKey);(previous?.isConnected?previous:launchButton)?.focus({preventScroll:true});};
 },[open]);
 if(pathname.startsWith("/admin")||pathname.startsWith("/account"))return null;
 const choose=(code:string)=>{
  setGoal(code);setError("");setPlan(null);
  setInput({...initial,service:code==="complete"?"mix_master":code as AdvisorInput["service"],tracks:code==="recording"||code==="custom"?[]:[code==="master"?1:8],studioHours:code==="recording"?1:code==="complete"?3:0,beat:code==="complete",mode:code==="recording"||code==="complete"?"studio":"remote"});
  setStep(1);if(body.current)body.current.scrollTop=0;
 };
 const submit=(event:FormEvent)=>{
  event.preventDefault();setError("");
  try{const result=recommendServices(input,discounts??[]);setPlan(result);setStep(2);if(body.current)body.current.scrollTop=0;}
  catch{setError("Controlla il numero di tracce e le ore di studio.");}
 };
 const setCount=(count:number)=>setInput(p=>({...p,tracks:Array.from({length:count},(_,i)=>p.tracks[i]??(p.service==="master"?1:8))}));
 const minTracks=input.tracks.length?Math.min(...input.tracks):1;
 return <>
  <button ref={launcher} data-genks-assistant-launcher className={styles.launcher} type="button" aria-label="Apri assistente GENKS" aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(!open)}><MessageCircle size={22} aria-hidden="true"/><span>Trova la tua offerta</span></button>
  {open&&<div className={styles.layer}>
   <button className={styles.backdrop} tabIndex={-1} aria-hidden="true" onClick={()=>setOpen(false)}/>
   <div ref={panel} className={styles.panel} role="dialog" aria-modal="true" aria-labelledby="genks-assistant-title">
    <header className={styles.header}><div><span><Sparkles size={15}/>GENKS · ASSISTENTE GUIDATO</span><h2 id="genks-assistant-title">Troviamo il tuo suono.</h2></div><button aria-label="Chiudi assistente" type="button" onClick={()=>setOpen(false)}><X size={23}/></button></header>
    <div ref={body} className={styles.body}>
     {discounts===null?<div className={styles.bubble}><p>Non riesco a verificare il listino in questo momento.</p><Link href="/services" onClick={()=>setOpen(false)}>Apri i servizi e i prezzi</Link></div>:<>
     {step===0&&<><p className={styles.bubble}>Cosa ti serve per il prossimo brano? Confronto il listino e i bundle per trovare la soluzione più conveniente per te.</p><div className={styles.goals}>{goals.map(g=><button key={g.code} type="button" onClick={()=>choose(g.code)}><strong>{g.title}</strong><small>{g.detail}</small><ArrowRight size={17}/></button>)}</div></>}
     {step===1&&<form onSubmit={submit} className={styles.form}>
      <p className={styles.answer}>{goals.find(g=>g.code===goal)?.title}</p>
      <h3>Qualche dettaglio e ti mostro il prezzo.</h3>
      {input.tracks.length>0&&<><label>Quanti brani?<select value={input.tracks.length} onChange={e=>setCount(Number(e.target.value))}>{Array.from({length:20},(_,i)=><option key={i} value={i+1}>{i+1} {i?"brani":"brano"}</option>)}</select></label>
       {input.service!=="master"&&<fieldset><legend>Tracce audio separate per brano</legend><small>Conta i file audio, non il numero di brani.</small>{input.tracks.map((n,i)=><label key={i}>Brano {i+1}<input aria-label={`Tracce brano ${i+1}`} type="number" required min={1} max={99} value={n||""} onChange={e=>setInput(p=>({...p,tracks:p.tracks.map((v,j)=>j===i?Number(e.target.value):v)}))}/></label>)}</fieldset>}
       <label>Come vuoi lavorare?<select value={input.mode} onChange={e=>setInput(p=>({...p,mode:e.target.value as AdvisorInput["mode"]}))}><option value="remote">A distanza</option><option value="studio">In studio</option></select></label>
       <fieldset><legend>Ti servono anche questi extra?</legend><label className={styles.check}><input type="checkbox" checked={input.extraRevision} onChange={e=>setInput(p=>({...p,extraRevision:e.target.checked}))}/>Una revisione in più per brano</label>{input.service!=="master"&&<label>Artisti di cui correggere le voci per ciascun brano<input type="number" required min={0} max={Math.min(48,minTracks)} value={input.vocalTracks} onChange={e=>setInput(p=>({...p,vocalTracks:Number(e.target.value)}))}/><small>0 se non serve correzione e pulizia delle voci. Il configuratore mostra il costo totale.</small></label>}</fieldset>
      </>}
      {input.service!=="custom"&&<label>{input.service==="recording"?"Quante ore vuoi registrare?":"Ore di registrazione da includere"}<select value={input.studioHours} onChange={e=>setInput(p=>({...p,studioHours:Number(e.target.value)}))}>{input.service!=="recording"&&<option value={0}>Non mi servono ore di studio</option>}{Array.from({length:32},(_,i)=><option key={i} value={(i+1)/4}>{(i+1)/4} ore</option>)}</select></label>}
      {input.service==="custom"&&<p className={styles.bubble}>Beat su misura: 100 € totali, una revisione inclusa, consegna in 10 giorni lavorativi dall’avvio consentito. Anticipo 50 €, saldo 50 €. Split 50/50; il 100% richiede preventivo.</p>}
      {input.beat&&<p className={styles.bubble}>Nel confronto includo un beat su misura per ciascun brano.</p>}
      {error&&<p role="alert">{error}</p>}
      <div className={styles.actions}><button type="button" onClick={()=>setStep(0)}><ArrowLeft size={16}/>Indietro</button><button className={styles.primary} type="submit">Calcola la mia offerta<ArrowRight size={17}/></button></div>
     </form>}
     {step===2&&plan&&<div className={styles.result} aria-live="polite"><p className={styles.answer}>{goals.find(g=>g.code===goal)?.title}{input.tracks.length>0?` · ${input.tracks.length} ${input.tracks.length===1?"brano":"brani"}`:""}</p>
      {plan.needsQuote?<><h3>Per oltre 48 tracce serve un preventivo.</h3><p>Ti metto in contatto con GENKS per definire il prezzo del tuo progetto.</p><a className={styles.primary} href={whatsapp("Ciao GENKS, vorrei un preventivo per un progetto con un brano di oltre 48 tracce.")} target="_blank" rel="noopener noreferrer">Chiedi il preventivo su WhatsApp</a></>:<>
       <h3>{plan.savingCents?"La combinazione più conveniente.":"Il servizio giusto per la tua richiesta."}</h3>
       <div className={styles.price}><span>Totale della soluzione</span><strong>{serviceAmount(plan.totalCents)}</strong>{plan.savingCents>0&&<small>Risparmi {serviceAmount(plan.savingCents)} rispetto agli stessi servizi separati ({serviceAmount(plan.separateCents)}).</small>}</div>
       {plan.parts.length>1&&<p>La soluzione comprende {plan.parts.length} richieste separate. Apri i moduli qui sotto: troverai già selezionati servizi, tracce ed extra.</p>}
       {plan.parts.map((part,i)=><article className={styles.part} key={i}><div><strong>{part.title}</strong><strong>{serviceAmount(part.priceCents)}</strong></div>{part.tracks&&<p>{part.tracks.length} {part.tracks.length===1?"brano":"brani"} · {part.tracks.join(", ")} tracce{part.tracks.length>1?" per i rispettivi brani":""}</p>}{part.hours&&<p>{part.hours} ore di studio{part.packageCode==="hours"?" · da utilizzare entro 90 giorni":""}</p>}{(part.packageCode==="voice"||part.packageCode==="turnkey")&&<p>Include 3 ore di studio. Sceglierai gli appuntamenti con GENKS.</p>}{part.kind==="custom"?<a className={styles.primary} href={whatsapp(`Ciao GENKS, vorrei ${part.quantity??1} beat su misura. Possiamo organizzare il lavoro?`)} target="_blank" rel="noopener noreferrer">Parliamone su WhatsApp</a>:<Link prefetch={false} className={styles.primary} href={part.href} onClick={()=>setOpen(false)}>Apri il modulo già compilato<ArrowRight size={17}/></Link>}</article>)}
       {input.studioHours>0&&<p className={styles.note}>L’eventuale supplemento dopo mezzanotte viene aggiunto quando scegli l’orario. Acquistare un pacchetto non prenota automaticamente una data.</p>}
       <p className={styles.note}>Controlli e confermi tutto nel modulo, con il listino aggiornato. La consegna veloce si può aggiungere lì.</p>
      </>}
      <div className={styles.actions}><button type="button" onClick={()=>setStep(1)}><ArrowLeft size={16}/>Modifica la richiesta</button><button type="button" onClick={()=>setStep(0)}>Ricomincia</button></div>
     </div>}
     <a className={styles.contact} href={whatsapp("Ciao GENKS, ho una domanda sul mio progetto musicale.")} target="_blank" rel="noopener noreferrer">Hai una richiesta particolare? Scrivi a GENKS su WhatsApp.</a>
     </>}
    </div>
   </div>
  </div>}
 </>;
}
