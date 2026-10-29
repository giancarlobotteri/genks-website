import type {StoreCard} from './home-storefront.ts';

/** Match advertised complete minimum totals, never an invented discount or deposit. */
export function withinBudget(cards:StoreCard[],cents:number,goal:string='all'){
 if(!Number.isSafeInteger(cents)||cents<0)return [];
 return cards.filter(c=>c.price<=cents&&(goal==='all'||goal==='studio'&&(c.group==='studio'||['hours','voice','turnkey','beat_voice'].includes(c.id))||goal==='audio'&&(c.group==='audio'||c.id==='masters')||goal==='production'&&(c.group==='custom'||['production','turnkey','beat_voice'].includes(c.id))))
 .sort((a,b)=>b.saving-a.saving||a.price-b.price).slice(0,3);
}
export function suggestedServices(services:string[],hasStudio:boolean):string[]{
 const ids:string[]=[];
 for(const s of services){
  if(s==='mix')ids.push('mix','mix_master');
  if(s==='master')ids.push('master','masters');
  if(s==='mix_master')ids.push('mix_master','production');
  if(s==='custom')ids.push('custom','beat_voice');
  if(['hours','recording','studio_package'].includes(s))ids.push('recording','hours');
  if(['masters','beat_voice','voice','turnkey','production'].includes(s))ids.push(s);
  if(s==='ep')ids.push('production');
 }
 if(hasStudio)ids.push('recording','hours');
 return [...new Set(ids)].slice(0,3);
}
export function purchasedServiceIds(projects:{service:string;commerce_snapshot:unknown}[]):string[]{
 const ids:string[]=[];
 for(const p of projects){
  const snapshot=p.commerce_snapshot&&typeof p.commerce_snapshot==='object'?p.commerce_snapshot as Record<string,unknown>:{};
  const parts=Array.isArray(snapshot.parts)?snapshot.parts:[];
  let recognized=false;
  for(const part of parts){
   if(!part||typeof part!=='object')continue;
   const selection=(part as Record<string,unknown>).selection;
   if(!selection||typeof selection!=='object')continue;
   const s=selection as Record<string,unknown>;
   const id=s.kind==='package'?s.packageCode:s.kind;
   if(typeof id==='string'&&suggestedServices([id],false).length){ids.push(id);recognized=true;}
  }
  if(!recognized)ids.push(typeof snapshot.packageCode==='string'?snapshot.packageCode:p.service);
 }
 return ids;
}
