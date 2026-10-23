"use client";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import {Sparkles,X,ArrowUpRight} from "lucide-react";
export type Offer={name:string;price:string;description:string;href:string};
export function OffersRail({offers}:{offers:Offer[]}){
 const [open,setOpen]=useState(false),[collapsed,setCollapsed]=useState(false);const panel=useRef<HTMLElement>(null),toggle=useRef<HTMLButtonElement>(null);
 useEffect(()=>{const update=()=>{const c=document.getElementById("collection");setCollapsed(Boolean(c&&c.getBoundingClientRect().top<innerHeight*.85));};addEventListener("scroll",update,{passive:true});addEventListener("resize",update);update();return()=>{removeEventListener("scroll",update);removeEventListener("resize",update);};},[]);
 useEffect(()=>{if(!open)return;panel.current?.querySelector<HTMLElement>("button,a")?.focus();const key=(e:KeyboardEvent)=>{if(e.key==="Escape"){setOpen(false);toggle.current?.focus();}};addEventListener("keydown",key);return()=>removeEventListener("keydown",key);},[open]);
 return <><button ref={toggle} className={`offers-toggle ${collapsed?"is-collapsed":""}`} type="button" aria-expanded={open} aria-controls="home-offers" onClick={()=>setOpen(!open)}><Sparkles size={17}/>Offerte e bundle</button><aside ref={panel} id="home-offers" className={`offers-rail ${open?"is-open":""} ${collapsed?"is-collapsed":""}`} aria-label="Offerte e bundle"><header><strong><Sparkles size={18}/>Offerte e bundle</strong><button type="button" aria-label="Chiudi le offerte" onClick={()=>{setOpen(false);toggle.current?.focus();}}><X size={18}/></button></header><div className="offers-scroll">{offers.map(o=><Link key={o.href} href={o.href} onClick={()=>setOpen(false)}><span>{o.name}<ArrowUpRight size={15}/></span><strong>{o.price}</strong><small>{o.description}</small></Link>)}</div><Link className="offers-all" href="/services">Tutti i servizi e i prezzi →</Link></aside></>;
}
