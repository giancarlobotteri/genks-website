import {ratesV10} from './service-pricing-v10.ts';
import {calculateProduction,type ProductionInput} from './production-calculator.ts';
import {buildRecordingQuote} from './recording-quote.ts';
import {firstVersionEstimate} from './service-delivery.ts';
import {validateProjectAppointmentsV10} from './project-appointments-v10.ts';
import type {OrderSelection,OrderPart,OrderSong,OrderQuote} from './service-order-v8.ts';
export function quoteProductionPart(raw:OrderSelection,early:boolean,now:Date,requireFiles=false):OrderPart{
 const project=raw.production;
 if(!project||raw.kind!=='production'||!Array.isArray(raw.songs)||raw.songs.length!==project.brani.length||!['card','cash'].includes(raw.payment)||raw.rights!=='split50'||typeof raw.notes!=='string'||raw.notes.length>2000)throw Error('Controlla il progetto e i contatti.');
 const q=calculateProduction(project,()=>({righe:[],importi_centesimi:{totale:0,listino:0}}));
 const songs:OrderSong[]=raw.songs.map((s,i)=>{const choice=project.brani[i];if(typeof s?.trackTitle!=='string'||s.trackTitle.length>160)throw Error('Controlla i titoli dei brani.');return {...s,trackTitle:s.trackTitle.trim()||`Brano ${i+1}`,trackCount:choice.tracce,artists:choice.artisti,revisions:0,rush:false,fileUrl:'',production:'genks',service:'mix_master'};});
 if(requireFiles)validateProjectAppointmentsV10(raw.appointments??[],songs.length,now);
 const appointments=raw.appointments??[];
 if(appointments.length&&appointments.length!==songs.length)throw Error('Scegli un appuntamento per ogni brano.');
 if(appointments.reduce((n,a)=>n+a.extraHours,0)!==project.ore_extra)throw Error('Le ore aggiuntive non corrispondono agli appuntamenti.');
 const night=appointments.reduce((n,a)=>n+(a.date&&a.time?buildRecordingQuote(a.date,a.time,2+a.extraHours).night:0),0);
 const total=q.total+night,balance=q.balance,dueNow=total-balance;
 const lines=q.lines.map(l=>({...l,payNow:l.amount}));
 if(night)lines.push({name:'Supplemento notturno · +10,00 €/ora',amount:night,payNow:night});
 return {selection:{...raw,songs,date:'',time:'',hours:q.hours},title:`${project.format==='album'?'Album':'EP'} Pack · ${songs.length} brani`,total,listTotal:q.listTotal+night,saving:q.listTotal-q.total,deposit:total,dueNow,cardNow:raw.payment==='card'?dueNow:0,cashNow:raw.payment==='cash'?dueNow:0,balance,studioAmount:q.studio+night,customAmount:q.custom,hours:q.hours,guarantees:q.shares.map((amount,i)=>({title:songs[i].trackTitle,amount:Math.round(amount*.3)})),lines,firstVersion:firstVersionEstimate(now,false,early,10)};
}
export function productionSelection(project:ProductionInput):OrderSelection{if(project.ore_extra!==0)throw Error('Le ore ulteriori richiedono una nuova prenotazione separata e il relativo pagamento.');return {kind:'production',production:project,songs:project.brani.map((s,i)=>({trackTitle:`Brano ${i+1}`,trackCount:s.tracce,artists:s.artisti,revisions:0,rush:false,fileUrl:'',production:'genks'})),appointments:project.brani.map(()=>({date:'',time:'',extraHours:0})),hours:0,extraHours:0,date:'',time:'',payment:'card',notes:'',rights:'split50'};}
/** Expand server-verified project snapshots into one atomic booking per song. */
export function expandProductionBookings(quote:OrderQuote,early:boolean,now:Date):OrderQuote{
 const parts=quote.parts.flatMap(p=>{
  if(p.selection.kind!=='production')return [p];
  const r=p.selection,project=r.production!;
  validateProjectAppointmentsV10(r.appointments??[],project.brani.length,now);
  return project.brani.map((song,i):OrderPart=>{
   const a=r.appointments![i],audio=p.lines.filter(l=>l.name.startsWith(`Brano ${i+1} ·`)),night=buildRecordingQuote(a.date,a.time,2+a.extraHours).night,studio=a.extraHours*1999+night;
   const total=audio.reduce((n,l)=>n+l.amount,0)+studio,balance=0,dueNow=total;
   const lines=[...audio,...(studio?[{name:`Registrazione · 2 ore incluse + ${a.extraHours} aggiuntive; supplemento notturno ${night/100} €`,amount:studio,payNow:studio}]:[])];
   return {...p,title:`${p.title} · ${r.songs[i].trackTitle}`,selection:{...r,production:undefined,songs:[r.songs[i]],appointments:undefined,date:a.date,time:a.time,hours:2+a.extraHours,extraHours:a.extraHours},total,listTotal:total+3998+ratesV10.projectSongSaving,saving:3998+ratesV10.projectSongSaving,deposit:total,dueNow,cardNow:r.payment==='card'?dueNow:0,cashNow:r.payment==='cash'?dueNow:0,balance,studioAmount:studio,customAmount:ratesV10.beat-ratesV10.projectSongSaving,hours:2+a.extraHours,bookingAmount:studio,bookingDeposit:studio,guarantees:[p.guarantees[i]],lines,firstVersion:firstVersionEstimate(now,false,early,10)};
  });
 });
 if(parts.length>20)throw Error('Puoi acquistare al massimo 20 servizi o sessioni nello stesso ordine.');
 for(const key of ['total','cardNow','cashNow','balance'] as const)if(parts.reduce((n,p)=>n+p[key],0)!==quote[key])throw Error('Importi del progetto non coerenti.');
 return {...quote,parts};
}
