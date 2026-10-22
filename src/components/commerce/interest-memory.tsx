"use client";
import {useEffect,useSyncExternalStore} from "react";
import Link from "next/link";
import Image from "next/image";
import {rankInterests,type InterestBeat} from "@/lib/interest-ranking";
const key="genks:interests:v1",signal="genks:interests-change";
type Memory={enabled:boolean;events:string[];expires:number};
const empty:Memory={enabled:false,events:[],expires:0};
let cachedRaw:string|null|undefined,cached:Memory=empty;
function read(){try{const raw=localStorage.getItem(key);if(raw===cachedRaw&&(!cached.enabled||cached.expires>Date.now()))return cached;cachedRaw=raw;const v=JSON.parse(raw??"null");cached=v?.enabled===true&&v.expires>Date.now()&&Array.isArray(v.events)?{enabled:true,events:v.events.filter((x:unknown)=>typeof x==="string").slice(0,20),expires:v.expires}:empty;return cached;}catch{return empty;}}
function subscribe(callback:()=>void){window.addEventListener(signal,callback);window.addEventListener("storage",callback);return()=>{window.removeEventListener(signal,callback);window.removeEventListener("storage",callback);};}
function write(events:string[]|null){try{if(events===null)localStorage.removeItem(key);else localStorage.setItem(key,JSON.stringify({enabled:true,events:events.slice(0,20),expires:Date.now()+30*86400000}));cachedRaw=undefined;window.dispatchEvent(new Event(signal));}catch{/* The feature remains optional if browser storage is unavailable. */}}
export function InterestMemory(){
 const memory=useSyncExternalStore(subscribe,read,()=>empty);
 useEffect(()=>{if(!memory.enabled)return;
  const remember=(event:Event)=>{const target=event.target instanceof Element?event.target:null;if(!target)return;let id=target.closest<HTMLElement>("[data-beat-id]")?.dataset.beatId;const link=target.closest<HTMLAnchorElement>("a[href]");if(link?.pathname.startsWith("/services/"))id=`service:${new URL(link.href).searchParams.get("service")??link.pathname.split("/").pop()}`;if(event.type==="change"&&target instanceof HTMLInputElement&&target.name==="serviceChoice")id=`service:${target.value}`;if(id){const current=read();if(current.enabled)write([id,...current.events.filter(x=>x!==id)]);}};
  document.addEventListener("click",remember);document.addEventListener("change",remember);return()=>{document.removeEventListener("click",remember);document.removeEventListener("change",remember);};
 },[memory.enabled]);return null;
}
export function ReturnSuggestions({beats}:{beats:InterestBeat[]}){
 const memory=useSyncExternalStore(subscribe,read,()=>empty);
 if(!memory.enabled)return <div className="return-suggestions"><header><div><strong>Ritrova il tuo suono al prossimo accesso.</strong><p>Suggerimenti facoltativi, salvati solo su questo dispositivo per 30 giorni.</p></div><button type="button" onClick={()=>write([])}>Attiva i suggerimenti</button></header></div>;
 const recommendations=rankInterests(beats,memory.events),service=memory.events.find(x=>x.startsWith("service:"))?.slice(8);
 const href=service==="recording"?"/services/recording":service==="custom"?"/services/custom":`/services/project${["mix","master","mix_master"].includes(service??"")?`?service=${service}`:""}`;
 return <section className="return-suggestions" aria-label="Suggerimenti sul tuo dispositivo"><header><div><h2>{memory.events.length?"Riparti dal tuo suono.":"Inizia da qui."}</h2>{service&&<Link className="text-link" href={href}>Riprendi il servizio che ti interessa ↗</Link>}</div><button type="button" onClick={()=>write(null)}>Disattiva e cancella</button></header><div className="return-suggestions-grid">{recommendations.map(beat=><Link key={beat.id} href={`/beats/${beat.slug}`} data-beat-id={beat.id}><Image src={beat.cover} alt="" width={160} height={160}/><strong>{beat.title}</strong><small>{beat.genre} · {beat.bpm} BPM</small></Link>)}</div><p>In base ai beat esplorati su questo dispositivo. Nessun dato inviato a servizi pubblicitari.</p></section>;
}
