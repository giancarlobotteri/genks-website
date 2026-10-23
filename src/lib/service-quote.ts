import {priceProjectSongs,type ProjectSong} from "./project-songs.ts";
import {extraRates,packageByCode,packageUpgrade,guaranteeRefund} from "./service-catalog.ts";
import {projectPrice,projectRateVersion} from "./service-rates.ts";
import type {PublicDiscount} from "./public-discounts.ts";
import {firstVersionEstimate} from "./service-delivery.ts";
export type QuoteLine={code:string;name:string;quantity:number;unitAmount:number;songIndex?:number;listAmount:number};
export function buildServiceQuote(input:{songs:unknown;packageCode?:unknown;rush?:unknown;earlyStart?:boolean},discounts:PublicDiscount[]=[],now=new Date()){
 const pack=packageByCode(input.packageCode);
 if(input.packageCode&&!pack)throw new Error("invalid_package");
 if(input.rush!==undefined&&typeof input.rush!=="boolean")throw new Error("invalid_rush");
 if(pack?.service==="recording"&&(!Array.isArray(input.songs)||input.songs.length!==0))throw new Error("invalid_package_songs");
 const songs=pack?.service==="recording"?[]:priceProjectSongs("",input.songs,pack?[]:discounts);if(!songs)throw new Error("invalid_songs");
 if(pack&&(songs.length!==pack.songs||songs.some(s=>s.service!==pack.service)))throw new Error("invalid_package_songs");
 const lines:QuoteLine[]=[];
 if(pack)lines.push({code:"package",name:pack.name,quantity:1,unitAmount:pack.price,listAmount:pack.separate});
 const normalized=songs.map((s,i)=>{
  const raw=(input.songs as ProjectSong[])[i];
  if(raw.vocalTracks!==undefined&&(!Number.isInteger(raw.vocalTracks)||raw.vocalTracks<0||raw.vocalTracks>48||raw.vocalTracks>s.trackCount))throw new Error("invalid_vocals");
  if(raw.versions!==undefined&&typeof raw.versions!=="boolean"||raw.extraRevision!==undefined&&typeof raw.extraRevision!=="boolean")throw new Error("invalid_extras");
  const list=projectPrice(s.service!,s.trackCount)!;
  const upgrade=pack&&s.service!=="master"?packageUpgrade(s.trackCount)!:0;
  if(!pack)lines.push({code:"service",name:`${s.trackTitle} · ${s.service!.replaceAll("_"," + ")} · ${s.trackCount} ${s.trackCount===1?"traccia":"tracce"}`,songIndex:i,quantity:1,unitAmount:s.amountCents,listAmount:list});
  else if(upgrade)lines.push({code:"tier",name:`${s.trackTitle} · differenza fascia ${s.trackCount} ${s.trackCount===1?"traccia":"tracce"}`,songIndex:i,quantity:1,unitAmount:upgrade,listAmount:upgrade});
  const included=input.packageCode==="single";
  const extraLines:QuoteLine[]=[];
  if(raw.vocalTracks)extraLines.push({code:"vocal",name:`${s.trackTitle} · Tuning ed editing voce`,songIndex:i,quantity:raw.vocalTracks,unitAmount:extraRates.vocal,listAmount:raw.vocalTracks*extraRates.vocal});
  if(raw.versions&&!included)extraLines.push({code:"versions",name:`${s.trackTitle} · Versioni strumentale e a cappella`,songIndex:i,quantity:1,unitAmount:extraRates.versions,listAmount:extraRates.versions});
  if(raw.extraRevision&&!included)extraLines.push({code:"revision",name:`${s.trackTitle} · Revisione extra`,songIndex:i,quantity:1,unitAmount:extraRates.revision,listAmount:extraRates.revision});
  lines.push(...extraLines);
  const base=pack?Math.floor(pack.price/pack.songs)+(i===pack.songs-1?pack.price%pack.songs:0)+upgrade:s.amountCents;
  return {...s,vocalTracks:raw.vocalTracks??0,versions:included||raw.versions===true,extraRevision:included||raw.extraRevision===true,
   listPriceCents:list,baseAmountCents:base,discountCents:pack?Math.round(list*(1-pack.price/pack.separate)):list-s.amountCents,
   guaranteeCents:pack?guaranteeRefund(list,pack.price,pack.separate):guaranteeRefund(s.amountCents),
   amountCents:base+extraLines.reduce((n,l)=>n+l.quantity*l.unitAmount,0)};
 });
 if(input.rush&&pack?.service==="recording")throw new Error("invalid_rush");
 if(input.rush)lines.push({code:"rush",name:"Consegna in 48 ore",quantity:1,unitAmount:extraRates.rush,listAmount:extraRates.rush});
 const total=lines.reduce((n,l)=>n+l.quantity*l.unitAmount,0);
 return {version:projectRateVersion,packageCode:pack?String(input.packageCode):null,packageName:pack?.name??null,packageListCents:pack?.separate??null,packagePriceCents:pack?.price??null,
  studioMinutes:pack?.studio?(input.packageCode==="hours"?300:180):0,validityDays:input.packageCode==="hours"?90:null,hasProduction:normalized.length>0,
  rush:input.rush===true,lines,songs:normalized,totalCents:total,estimatedFirstVersionAt:firstVersionEstimate(now,input.rush===true,input.earlyStart===true),
  estimateBasis:"Data prevista se pagamento e file completi sono disponibili oggi; si aggiorna se i file arrivano dopo. Senza avvio anticipato si attende il termine di recesso."};
}
export type ServiceQuote=ReturnType<typeof buildServiceQuote>;
