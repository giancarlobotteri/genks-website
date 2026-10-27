"use client";

import {useEffect, useId, useState} from "react";
import {usePathname} from "next/navigation";
import Link from "next/link";
import {ArrowUpRight, ShoppingBag, Trash2} from "lucide-react";
import type {PublicDiscount} from "@/lib/public-discounts";
import {serviceCartKey} from "@/lib/service-cart-storage";
import {quoteOrder, type OrderSelection} from "@/lib/service-order-v8";
import {serviceAmount} from "@/lib/service-rates";
import {Modal} from "@/components/ui/modal";
import styles from "./service-cart-rail.module.css";

export function ServiceCartRailV8({discounts=[]}:{discounts?:PublicDiscount[]}) {
 const pathname=usePathname();
 const [items,setItems]=useState<OrderSelection[]>([]);
 const [open,setOpen]=useState(false);
 const [confirmClear,setConfirmClear]=useState(false);
 const [status,setStatus]=useState<"loading"|"ready"|"error">("loading");
 const [message,setMessage]=useState("");
 const titleId=useId();
 const visible=!pathname.startsWith("/admin");
 useEffect(()=>{
  if(!visible)return;
  let active=true,version=0;
  const update=async()=>{
   const current=++version;
   try{
    const key=await serviceCartKey();
    const list=JSON.parse(sessionStorage.getItem(key)??"[]");
    if(!Array.isArray(list))throw Error("invalid cart");
    if(active&&current===version){setItems(list);setStatus("ready");}
   }catch{if(active&&current===version){setItems([]);setStatus("error");}}
  };
  void update();
  window.addEventListener("genks-services-cart",update);
  window.addEventListener("pageshow",update);
  window.addEventListener("focus",update);
  return()=>{active=false;window.removeEventListener("genks-services-cart",update);window.removeEventListener("pageshow",update);window.removeEventListener("focus",update);};
 },[pathname,visible]);
 let quote:ReturnType<typeof quoteOrder>|undefined;
 try{if(items.length)quote=quoteOrder(items,true,new Date(),discounts);}catch{}
 const change=async(next:OrderSelection[])=>{
  try{
   const key=await serviceCartKey();sessionStorage.setItem(key,JSON.stringify(next));sessionStorage.removeItem(key+":request");
   setItems(next);setConfirmClear(false);setMessage("");window.dispatchEvent(new Event("genks-services-cart"));
  }catch{setMessage("Non è stato possibile aggiornare il carrello. Riprova.");}
 };
 if(!visible)return null;
 const empty=status==="ready"&&!items.length;
 return <>
  <button data-genks-cart-launcher className={styles.launcher} type="button" aria-haspopup="dialog" aria-expanded={open} aria-label={`Apri carrello servizi (${items.length})`} onClick={()=>{setOpen(true);setConfirmClear(false);}}>
   <ShoppingBag size={19} aria-hidden="true"/><span>Carrello</span><strong aria-live="polite">{items.length}</strong>{quote&&<span className={styles.launcherTotal}>{serviceAmount(quote.total)}</span>}
  </button>
  <Modal open={open} onClose={()=>setOpen(false)} titleId={titleId}>
   <div className={styles.panel} data-service-cart-panel>
    <div className={styles.eyebrow}><ShoppingBag size={18} aria-hidden="true"/>GENKS · CARRELLO</div>
    <h2 id={titleId}>La tua selezione <span>({items.length})</span></h2>
    {status==="loading"?<p role="status">Caricamento…</p>:status==="error"?<p role="alert">Non riesco a caricare il carrello. <button type="button" onClick={()=>window.location.reload()}>Ricarica la pagina</button></p>:empty?<div className={styles.empty}><ShoppingBag size={36} aria-hidden="true"/><h3>Da dove vuoi iniziare?</h3><p>Scegli un servizio, personalizzalo e aggiungilo qui. Oppure acquistalo subito.</p><Link href="/services" className="button button-primary" onClick={()=>setOpen(false)}>Scegli un servizio <ArrowUpRight size={17}/></Link></div>:<>
     <div className={styles.items}>{items.map((item,index)=><article key={index}><div><small>SERVIZIO {index+1}</small><h3>{quote?.parts[index]?.title??"Servizio da controllare"}</h3><p>{item?.payment==="card"?"Carta / Apple Pay":"Contanti in studio"}</p></div><div className={styles.itemSide}>{quote&&<strong>{serviceAmount(quote.parts[index].total)}</strong>}<button type="button" aria-label={`Rimuovi servizio ${index+1}`} onClick={()=>void change(items.filter((_,i)=>i!==index))}><Trash2 size={16}/>Rimuovi</button></div></article>)}</div>
     {quote?<div className={styles.totals}><div><span>Totale servizi</span><strong>{serviceAmount(quote.total)}</strong></div>{quote.saving>0&&<p>Risparmi {serviceAmount(quote.saving)}</p>}<small>Acconti e saldi sono separati nel riepilogo prima del pagamento.</small><Link href="/services/checkout" className="button button-primary" onClick={()=>setOpen(false)}>Vai al riepilogo <ArrowUpRight size={17}/></Link></div>:<p role="alert">Una selezione non è più valida. Rimuovila e configura nuovamente il servizio.</p>}
     <div className={styles.actions}><Link href="/services" onClick={()=>setOpen(false)}>Aggiungi altri servizi</Link><button type="button" onClick={()=>setConfirmClear(true)}><Trash2 size={16}/>Svuota carrello</button></div>
     {confirmClear&&<div className={styles.confirm}><p>Vuoi rimuovere tutti i servizi selezionati?</p><div><button type="button" onClick={()=>setConfirmClear(false)}>Annulla</button><button type="button" onClick={()=>void change([])}>Sì, svuota</button></div></div>}
    </>}
    {message&&<p role="alert">{message}</p>}
   </div>
  </Modal>
 </>;
}
