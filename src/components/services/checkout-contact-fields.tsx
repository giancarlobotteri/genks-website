"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {createSupabaseBrowserClient} from "@/lib/supabase/browser";
import {contactOwner,type ContactContext} from "@/lib/customer-contact";
import styles from "./checkout-contact-fields.module.css";
export function CheckoutContactFields({context,phoneRequired=false,accountMode=false,next="/services/project"}:{context:ContactContext|null;phoneRequired?:boolean;accountMode?:boolean;next?:string}){
 const [stale,setStale]=useState(false);
 useEffect(()=>{
  let client;try{client=createSupabaseBrowserClient();}catch{return;}
  const {data}=client.auth.onAuthStateChange((_event,session)=>{
   const active=contactOwner(session?.user??null);
   if((active?.userId??"")!==(context?.userId??"")||(active?.email??"").toLowerCase()!==(context?.email??"").toLowerCase()){setStale(true);window.location.reload();}
  });
  const onPageShow=(event:PageTransitionEvent)=>{if(event.persisted){setStale(true);window.location.reload();}};
  window.addEventListener("pageshow",onPageShow);
  return()=>{data.subscription.unsubscribe();window.removeEventListener("pageshow",onPageShow);};
 },[context?.userId,context?.email]);
 if(stale)return <p role="status">Aggiorno i dati del tuo account…</p>;
 return <div className={styles.fields}>
 <input type="hidden" name="contactOwner" value={context?.userId??""}/>
 {!context&&<p className={styles.info}><Link href={"/login?next="+encodeURIComponent(next)}>Hai già acquistato? Accedi per ritrovare i tuoi dati.</Link> Puoi anche continuare senza account.</p>}
 <label>Nome<input name="name" required minLength={2} maxLength={120} autoComplete="name" defaultValue={context?.saved?.name??""}/></label>
 <label>Nome d’arte <small>facoltativo</small><input name="artistName" maxLength={120} defaultValue={context?.saved?.artistName??""}/></label>
 <label>{accountMode?"Email verificata":"Email"}<input name="email" type="email" required readOnly={accountMode} autoComplete="email" defaultValue={context?.email??""}/></label>
 <label>Telefono{!phoneRequired&&<small>facoltativo</small>}<input name="phone" type="tel" required={phoneRequired} minLength={phoneRequired?6:undefined} maxLength={40} autoComplete="tel" defaultValue={context?.saved?.phone??""}/></label>
 {context?.available===false&&<p className={styles.info}>I dati salvati non sono disponibili al momento. Puoi comunque compilare i contatti e acquistare.</p>}
 {context&&!accountMode&&context.available!==false&&<div className={styles.choice}><label><input type="checkbox" name="saveContact" defaultChecked={Boolean(context.saved)}/><span>Salva i miei dati per i prossimi acquisti</span></label><small>Si salvano nel tuo account verificato. Se cambi l’email, togli la spunta oppure accedi con la nuova email. Puoi modificarli o rimuoverli in <Link href="/account/details">I miei dati</Link>. Togliere la spunta non elimina i dati già salvati.</small></div>}
 </div>;
}
