"use client";
import { useState } from "react";
import { serviceAmount } from "@/lib/service-rates";
import type { PricedProjectSong } from "@/lib/project-songs";

export function ProjectSongs({songs}:{songs:unknown}) {
 const [page,setPage]=useState(1);
 const all=Array.isArray(songs)?songs.filter((s):s is PricedProjectSong=>Boolean(s&&typeof s.trackTitle==="string"&&typeof s.description==="string"&&Number.isInteger(s.trackCount)&&Number.isInteger(s.amountCents))):[];
 if(!all.length)return null;
 const current=Math.min(page,Math.ceil(all.length/5));
 return <section className="payment-request" aria-label="Brani della richiesta"><strong>{all.length} {all.length===1?"brano":"brani"} nella richiesta</strong>
  {all.slice((current-1)*5,current*5).map((song,index)=><details key={index} style={{borderBottom:"1px solid #295080",padding:"14px 0"}}><summary style={{color:"#d9edff",cursor:"pointer"}}>{(current-1)*5+index+1}. {song.trackTitle} · {song.service?.replaceAll("_"," + ")??""} · {song.trackCount} tracce · {serviceAmount(song.amountCents)}</summary><p style={{whiteSpace:"pre-wrap",color:"#d9edff"}}>{song.description}</p>{song.desiredDeadline&&<p>Scadenza desiderata: {song.desiredDeadline} · da concordare</p>}{song.notes&&<p style={{whiteSpace:"pre-wrap"}}>Note: {song.notes}</p>}{String(song.referenceLinks??"").split(/\s+/).filter(link=>{try{return ["http:","https:"].includes(new URL(link).protocol);}catch{return false;}}).map((link,i)=><p key={i}><a href={link} target="_blank" rel="noopener noreferrer">Riferimento {i+1}</a></p>)}<small>2 revisioni incluse per questo brano.</small>{song.vocalTracks ? <p>Tuning ed editing voce: {song.vocalTracks} tracce vocali.</p> : null}{song.versions&&<p>Versioni strumentale e a cappella incluse.</p>}{song.extraRevision&&<p>1 revisione extra inclusa nel riepilogo.</p>}</details>)}
  {all.length>5&&<nav aria-label="Pagine dei brani" style={{display:"flex",gap:15,alignItems:"center",marginTop:15}}><button type="button" className="button button-secondary" disabled={current===1} onClick={()=>setPage(current-1)}>Precedenti</button><span>{current} / {Math.ceil(all.length/5)}</span><button type="button" className="button button-secondary" disabled={current*5>=all.length} onClick={()=>setPage(current+1)}>Successivi</button></nav>}
 </section>;
}
