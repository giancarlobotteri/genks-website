import {quoteOrder,type OrderSelection} from "./service-order-v8.ts";
import {packageByCode} from "./service-catalog.ts";
import {projectRateVersion} from "./service-rates.ts";
import {priceProjectSongs,type ProjectSong} from "./project-songs.ts";
import type {PublicDiscount} from "./public-discounts.ts";
export type QuoteLine={code:string;name:string;quantity:number;unitAmount:number;songIndex?:number;listAmount:number};
// Compatibility for the existing guided assistant. Checkout uses quoteOrder directly.
export function buildServiceQuote(input:{songs:unknown;packageCode?:unknown;rush?:unknown;extraHours?:number;earlyStart?:boolean},discounts:PublicDiscount[]=[],now=new Date()){
 const pack=packageByCode(input.packageCode);if(input.packageCode&&!pack)throw Error("invalid_package");
 if(input.rush!==undefined&&typeof input.rush!=="boolean")throw Error("invalid_rush");
 const list=pack?.service==="recording"?[]:priceProjectSongs("",input.songs,discounts);if(!list)throw Error("invalid_songs");
 if(pack?.service==="recording"&&(!Array.isArray(input.songs)||input.songs.length||input.rush))throw Error("invalid_package_songs");
 const selected=(Array.isArray(input.songs)?input.songs:[]) as ProjectSong[];
 if(pack&&(list.length!==pack.songs||list.some(s=>s.service!==pack.service)))throw Error("invalid_package_songs");
 const groups:OrderSelection[]=pack?[{kind:"package",packageCode:String(input.packageCode),songs:[],hours:0,extraHours:input.extraHours??0,date:pack.studio?"2030-01-01":"",time:pack.studio?"19:30":"",payment:"card",notes:"",rights:input.packageCode==="turnkey"?"split50":"own"}]:list.map(s=>({kind:s.service as "mix"|"master"|"mix_master",songs:[],hours:0,extraHours:0,date:"",time:"",payment:"card",notes:"",rights:"own"}));
 const songs=list.map((s,i)=>({trackTitle:s.trackTitle,trackCount:s.trackCount,artists:selected[i]?.vocalTracks??0,revisions:selected[i]?.extraRevision?1:0,rush:input.rush===true,fileUrl:s.fileUrl??""}));
 if(pack)groups[0].songs=songs;else groups.forEach((g,i)=>g.songs=[songs[i]]);
 const q=quoteOrder(groups,input.earlyStart===true,now,discounts);const total=q.total;
 const normalized=list.map((s,i)=>({...s,vocalTracks:songs[i].artists,versions:false,extraRevision:songs[i].revisions>0,listPriceCents:s.amountCents,baseAmountCents:pack?Math.floor(pack.price/pack.songs):s.amountCents,discountCents:0,guaranteeCents:q.parts[pack?0:i].guarantees[pack?i:0].amount,amountCents:pack?Math.floor(total/pack.songs)+(i===pack.songs-1?total%pack.songs:0):q.parts[i].total}));
 return {version:projectRateVersion,packageCode:pack?String(input.packageCode):null,packageName:pack?.name??null,packageListCents:pack?.separate??null,packagePriceCents:pack?.price??null,studioMinutes:pack?.studio?(input.packageCode==="hours"?300:120):0,validityDays:input.packageCode==="hours"?90:null,hasProduction:normalized.length>0,rush:input.rush===true,lines:q.parts.flatMap(p=>p.lines.map(l=>({code:"service",name:l.name,quantity:1,unitAmount:l.amount,listAmount:l.amount}))),songs:normalized,totalCents:total,estimatedFirstVersionAt:q.parts[0].firstVersion??now.toISOString(),estimateBasis:"Stima se pagamento, file completi e avvio consentito sono disponibili oggi."};
}
export type ServiceQuote=ReturnType<typeof buildServiceQuote>;
