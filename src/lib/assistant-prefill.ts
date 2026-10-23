import {emptyProjectSong,type ProjectSong} from "./project-songs.ts";
import {packageByCode} from "./service-catalog.ts";

export type AssistantPrefill={service:"mix"|"master"|"mix_master";tracks:number[];versions:boolean;extraRevision:boolean;vocalTracks:number;mode:"remote"|"studio"};
export function parseAssistantPrefill(value:unknown,packageCode=""):AssistantPrefill|null{
 if(typeof value!=="string"||value.length>4000)return null;
 try{
  const x=JSON.parse(value);
  if(!x||!["mix","master","mix_master"].includes(x.service)||!Array.isArray(x.tracks)||x.tracks.length<1||x.tracks.length>20)return null;
  if(x.tracks.some((n:unknown)=>!Number.isInteger(n)||Number(n)<1||Number(n)>(x.service==="master"?1:48)))return null;
  if(typeof x.versions!=="boolean"||typeof x.extraRevision!=="boolean"||!Number.isInteger(x.vocalTracks)||x.vocalTracks<0||x.vocalTracks>Math.min(...x.tracks))return null;
  if(!["remote","studio"].includes(x.mode))return null;
  const pack=packageByCode(packageCode);
  if(packageCode&&(!pack||pack.songs!==x.tracks.length||pack.service!==x.service||pack.studio&&x.mode!=="studio"))return null;
  // Only configuration is copied. Names, contact details, prices and consents never come from this link.
  return {service:x.service,tracks:x.tracks,versions:x.versions,extraRevision:x.extraRevision,vocalTracks:x.vocalTracks,mode:x.mode};
 }catch{return null;}
}
export function assistantSongs(prefill:AssistantPrefill):ProjectSong[]{
 return prefill.tracks.map(trackCount=>({...emptyProjectSong(),service:prefill.service,trackCount,versions:prefill.versions,extraRevision:prefill.extraRevision,vocalTracks:prefill.vocalTracks}));
}
export function projectAssistantUrl(prefill:AssistantPrefill,packageCode=""){
 const params=new URLSearchParams({service:prefill.service,a:JSON.stringify(prefill)});
 if(packageCode)params.set("package",packageCode);
 return "/services/project?"+params;
}
export function assistantDuration(value:unknown){
 const n=typeof value==="string"?Number(value):NaN;
 return Number.isFinite(n)&&n>=.25&&n<=8&&Number.isInteger(n*4)?n:1;
}
