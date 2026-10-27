import {customBeat,revisionTotal} from './service-catalog.ts';
import {projectPrice,recordingHourlyCents,serviceAmount} from './service-rates.ts';
export type ProductionSong={servizio:'none'|'mix'|'master'|'mix_master';produzione:'genks'|'external';tracce:number;artisti:number;revisioni_extra:number;consegna_veloce:boolean};
export type ProductionInput={brani:ProductionSong[];registrazione:boolean;ore_extra:number};
export const productionRates={beat:7999,includedHours:2,extraHour:1499} as const;
type AudioInput={servizio:'mix'|'master'|'mix_master';file:number;artisti_correzione_voce:number;revisioni_extra:number;consegna_veloce:boolean};
type AudioQuote={righe:{descrizione:string;prezzo:string}[];importi_centesimi:{totale:number;listino:number};errore?:string};
export function calculateProduction(input:ProductionInput,quoteAudio:(songs:AudioInput[])=>AudioQuote){
 if(!input||!Array.isArray(input.brani)||input.brani.length<2||input.brani.length>20||typeof input.registrazione!=='boolean'||!Number.isInteger(input.ore_extra)||input.ore_extra<0||input.ore_extra>6||!input.registrazione&&input.ore_extra)throw Error('Scegli da 2 a 20 brani e controlla le ore di registrazione.');
 for(const s of input.brani){if(!s||!['none','mix','master','mix_master'].includes(s.servizio)||!['genks','external'].includes(s.produzione)||!Number.isInteger(s.tracce)||s.tracce<1||s.tracce>48||!Number.isInteger(s.artisti)||s.artisti<1||s.artisti>20||!Number.isInteger(s.revisioni_extra)||s.revisioni_extra<0||s.revisioni_extra>2||typeof s.consegna_veloce!=='boolean'||s.servizio==='none'&&(s.revisioni_extra>0||s.consegna_veloce))throw Error('Controlla servizi e tracce audio separate di ogni brano.');}
 const work=input.brani.filter(s=>s.servizio!=='none');
 const audio=work.length?quoteAudio(work.map(s=>({servizio:s.servizio as AudioInput['servizio'],file:s.servizio==='master'?1:s.tracce,artisti_correzione_voce:s.servizio==='master'?0:s.artisti,revisioni_extra:s.revisioni_extra,consegna_veloce:s.consegna_veloce}))):{righe:[],importi_centesimi:{totale:0,listino:0}};
 if(audio.errore)throw Error(audio.errore);
 const beats=input.brani.filter(s=>s.produzione==='genks').length;
 if(!work.length&&!beats)throw Error('Scegli almeno una produzione GENKS o una lavorazione audio. Per la sola registrazione usa Prenota lo studio.');
 const custom=beats*productionRates.beat;
 const hours=input.registrazione?productionRates.includedHours+input.ore_extra:0;
 const studio=input.registrazione?productionRates.includedHours*recordingHourlyCents+input.ore_extra*productionRates.extraHour:0;
 const total=audio.importi_centesimi.totale+custom+studio;
 const listTotal=audio.importi_centesimi.listino+beats*customBeat.total+hours*recordingHourlyCents;
 const balance=studio+custom-Math.round(studio/2)-Math.round(custom/2);
 const lines=[...audio.righe.map(r=>({name:r.descrizione,amount:Math.round(Number(r.prezzo.replace(/[^0-9,]/g,'').replace(',','.'))*100)})),...(beats?[{name:`${beats} ${beats===1?'produzione':'produzioni'} GENKS su misura · ${serviceAmount(productionRates.beat)} per brano · una revisione inclusa`,amount:custom}]:[]),...(hours?[{name:'Registrazione · 2 ore incluse nel pacchetto',amount:2*recordingHourlyCents},...(input.ore_extra?[{name:`Registrazione · ${input.ore_extra} ${input.ore_extra===1?'ora aggiuntiva':'ore aggiuntive'} a 14,99 €/ora`,amount:input.ore_extra*productionRates.extraHour}]:[])]:[])];
 // Package upgrades are paid in full. Allocate only the discounted base price,
 // preserving the guarantee rule used by the standard EP/master packages.
 const shares=input.brani.map(()=>0);
 for(const master of [false,true]){
  const indices=input.brani.map((s,i)=>({s,i})).filter(({s})=>s.servizio!=='none'&&(s.servizio==='master')===master);
  if(!indices.length)continue;
  const group=quoteAudio(indices.map(({s})=>({servizio:s.servizio as AudioInput['servizio'],file:master?1:s.tracce,artisti_correzione_voce:master?0:s.artisti,revisioni_extra:s.revisioni_extra,consegna_veloce:s.consegna_veloce})));
  if(group.errore)throw Error(group.errore);
  const extras=indices.reduce((n,{s})=>n+revisionTotal(s.revisioni_extra)+(s.consegna_veloce?1999:0),0);
  const upgrades=indices.map(({s})=>!master&&indices.length>=4?(s.tracce<=8?0:s.tracce<=24?2500:7000):0);
  const weights=indices.map(({s})=>projectPrice(s.servizio as AudioInput['servizio'],!master&&indices.length>=4?8:master?1:s.tracce)!);
  const base=Math.max(0,group.importi_centesimi.totale-extras-upgrades.reduce<number>((n,v)=>n+v,0));
  const weight=weights.reduce((n,v)=>n+v,0);
  const allocated=weights.map(w=>Math.floor(base*w/weight));
  let remainder=base-allocated.reduce((n,v)=>n+v,0);
  for(let i=0;remainder>0&&i<allocated.length;i++,remainder--)allocated[i]++;
  indices.forEach(({i},j)=>{shares[i]=allocated[j]+upgrades[j];});
 }
 return {total,listTotal,balance,dueNow:total-balance,studio,custom,hours,beats,lines,shares,audio};
}
