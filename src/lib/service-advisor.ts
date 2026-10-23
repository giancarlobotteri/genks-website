import {buildServiceQuote} from "./service-quote.ts";
import {packages,customBeat,packageUpgrade} from "./service-catalog.ts";
import {buildRecordingQuote} from "./recording-quote.ts";
import {projectAssistantUrl,type AssistantPrefill} from "./assistant-prefill.ts";
import type {PublicDiscount} from "./public-discounts.ts";

export type AdvisorInput={service:"mix"|"master"|"mix_master"|"recording"|"custom";tracks:number[];studioHours:number;beat:boolean;versions:boolean;extraRevision:boolean;vocalTracks:number;mode:"remote"|"studio"};
export type AdvisorPart={kind:"project"|"recording"|"custom";title:string;priceCents:number;packageCode?:string;tracks?:number[];hours?:number;quantity?:number;href:string};
export type AdvisorPlan={parts:AdvisorPart[];totalCents:number;separateCents:number;savingCents:number;needsQuote:boolean};
const referenceDate=new Date("2026-01-05T12:00:00Z");

export function recommendServices(input:AdvisorInput,discounts:PublicDiscount[]=[]):AdvisorPlan{
 if([input.beat,input.versions,input.extraRevision].some(value=>typeof value!=="boolean"))throw new Error("invalid_options");
 if(input.service==="recording"&&input.studioHours<=0)throw new Error("invalid_hours");
 if(!["mix","master","mix_master","recording","custom"].includes(input.service)||!["studio","remote"].includes(input.mode))throw new Error("invalid_request");
 if(!Number.isFinite(input.studioHours)||input.studioHours<0||input.studioHours>8||!Number.isInteger(input.studioHours*4))throw new Error("invalid_hours");
 if(!Array.isArray(input.tracks)||input.tracks.length>20||input.tracks.some(n=>!Number.isInteger(n)||n<1||n>99))throw new Error("invalid_tracks");
 if(["mix","master","mix_master"].includes(input.service)&&input.tracks.length<1)throw new Error("invalid_tracks");
 if(!Number.isInteger(input.vocalTracks)||input.vocalTracks<0||input.vocalTracks>48||input.tracks.some(n=>input.vocalTracks>n))throw new Error("invalid_vocals");
 if(input.service==="master"&&input.tracks.some(n=>n!==1))throw new Error("invalid_master");
 if(input.tracks.some(n=>n>48))return {parts:[],totalCents:0,separateCents:0,savingCents:0,needsQuote:true};
 if(input.service==="custom")return {parts:[{kind:"custom",title:"Beat su misura",priceCents:customBeat.total,quantity:1,href:"/services/custom"}],totalCents:customBeat.total,separateCents:customBeat.total,savingCents:0,needsQuote:false};
 const service=input.service==="recording"?"mix_master":input.service;
 // All mix bundles share the same per-song upgrade. Allocate their places to
 // songs with the greatest real saving, including any active tier-specific offer.
 const advantage=(trackCount:number)=>buildServiceQuote({songs:[{service,trackCount,trackTitle:"Brano",description:"Configurazione assistente GENKS",referenceLinks:"",notes:"",desiredDeadline:""}]},discounts,referenceDate).totalCents-(service==="master"?0:packageUpgrade(trackCount)!);
 const tracks=input.service==="recording"?[]:[...input.tracks].sort((a,b)=>advantage(b)-advantage(a));
 const makePrefill=(list:number[],studio=false):AssistantPrefill=>({service,tracks:list,versions:input.versions,extraRevision:input.extraRevision,vocalTracks:input.vocalTracks,mode:studio?"studio":input.mode});
 const cache=new Map<string,AdvisorPart>();
 const audio=(index:number,count:number,code="")=>{
  const key=index+":"+count+":"+code;const found=cache.get(key);if(found)return found;
  const list=tracks.slice(index,index+count),prefill=makePrefill(list,Boolean(code&&packages[code as keyof typeof packages].studio));
  const songs=list.map((trackCount,i)=>({service,trackCount,trackTitle:"Brano "+(index+i+1),description:"Configurazione assistente GENKS",referenceLinks:"",notes:"",desiredDeadline:"",versions:input.versions,extraRevision:input.extraRevision,vocalTracks:input.vocalTracks}));
  const quote=buildServiceQuote({songs,packageCode:code,earlyStart:true},discounts,referenceDate);
  const title=code?packages[code as keyof typeof packages].name:service==="mix"?"Mix":service==="master"?"Master stereo":"Mix + master";
  const part:AdvisorPart={kind:"project",title,priceCents:quote.totalCents,tracks:list,packageCode:code||undefined,href:projectAssistantUrl(prefill,code)};
  cache.set(key,part);return part;
 };
 const recording=(quarters:number):AdvisorPart=>({kind:"recording",title:"Registrazione in studio",hours:quarters/4,priceCents:buildRecordingQuote("","",quarters/4,discounts).total,href:"/services/recording?duration="+quarters/4});
 const hoursPack:AdvisorPart={kind:"project",title:packages.hours.name,packageCode:"hours",hours:5,priceCents:packages.hours.price,href:"/services/project?package=hours"};
 const recordingPlan=(quarters:number):AdvisorPart[]=>{
  if(!quarters)return [];
  let best=[recording(quarters)];
  for(let n=1;n<=Math.ceil(quarters/20);n++){
   const rest=Math.max(0,quarters-n*20),candidate=[...Array.from({length:n},()=>({...hoursPack})),...(rest?[recording(rest)]:[])];
   if(sum(candidate)<sum(best))best=candidate;
  }
  return best;
 };
 const beatCount=input.beat?tracks.length:0;
 const memo=new Map<string,AdvisorPart[]>();
 function solve(i:number,quarters:number,beats:number):AdvisorPart[]{
  const key=i+":"+quarters+":"+beats;const found=memo.get(key);if(found)return found;
  if(i===tracks.length){
   const parts=[...recordingPlan(quarters),...(beats?[{kind:"custom" as const,title:beats===1?"Beat su misura":beats+" beat su misura",quantity:beats,priceCents:beats*customBeat.total,href:"/services/custom"}]:[])];
   memo.set(key,parts);return parts;
  }
  let best=[audio(i,1),...solve(i+1,quarters,beats)];
  const consider=(part:AdvisorPart,count:number,h:number,b:number)=>{
   const candidate=[part,...solve(i+count,h,b)];
   if(sum(candidate)<sum(best)||sum(candidate)===sum(best)&&candidate.length<best.length)best=candidate;
  };
  if(service==="mix_master"){
   consider(audio(i,1,"single"),1,quarters,beats);
   if(tracks.length-i>=4)consider(audio(i,4,"ep"),4,quarters,beats);
   if(quarters>0)consider(audio(i,1,"voice"),1,Math.max(0,quarters-12),beats);
   if(beats>0)consider(audio(i,1,"turnkey"),1,Math.max(0,quarters-12),beats-1);
  }else if(service==="master"&&tracks.length-i>=3)consider(audio(i,3,"masters"),3,quarters,beats);
  memo.set(key,best);return best;
 }
 const original=solve(0,Math.round(input.studioHours*4),beatCount);
 // Individual audio services share one existing multi-song form rather than forcing one request per song.
 const parts:AdvisorPart[]=[],individual=original.filter(p=>p.kind==="project"&&!p.packageCode);
 if(individual.length){
  const list=individual.flatMap(p=>p.tracks??[]),prefill=makePrefill(list);
  parts.push({...individual[0],tracks:list,priceCents:sum(individual),title:individual[0].title+(list.length>1?" · "+list.length+" brani":""),href:projectAssistantUrl(prefill)});
 }
 parts.push(...original.filter(p=>p.packageCode||p.kind!=="project"));
 const separateCents=tracks.reduce((n,_,i)=>n+audio(i,1).priceCents,0)+(input.studioHours?recording(input.studioHours*4).priceCents:0)+beatCount*customBeat.total;
 const totalCents=sum(parts);
 return {parts,totalCents,separateCents,savingCents:Math.max(0,separateCents-totalCents),needsQuote:false};
}
function sum(parts:AdvisorPart[]){return parts.reduce((n,p)=>n+p.priceCents,0);}
