import {calculateProduction,type ProductionInput} from './production-calculator.ts';
import {calcolaPreventivo} from './chatbot/pricing.ts';
import {buildRecordingQuote} from './recording-quote.ts';
import {firstVersionEstimate} from './service-delivery.ts';
import {validateTransfer} from './swiss-transfer.ts';
import type {OrderSelection,OrderPart,OrderSong,OrderLine} from './service-order-v8.ts';
export function quoteProductionPart(raw:OrderSelection,early:boolean,now:Date,requireFiles=false):OrderPart{
 const project=raw.production;
 if(!project||raw.kind!=='production'||!Array.isArray(raw.songs)||raw.songs.length!==project.brani.length||!['card','cash'].includes(raw.payment)||!['own','split50'].includes(raw.rights)||typeof raw.notes!=='string'||raw.notes.length>2000)throw Error('Controlla il progetto e i contatti.');
 const q=calculateProduction(project,brani=>calcolaPreventivo({brani}));
 if(q.beats&&raw.rights!=='split50')throw Error('Per il 100% dei diritti serve un preventivo.');
 const songs:OrderSong[]=raw.songs.map((s,i)=>{const choice=project.brani[i];if(typeof s?.trackTitle!=='string'||s.trackTitle.length>160||typeof s.fileUrl!=='string'||s.fileUrl.length>2000)throw Error('Completa i titoli dei brani.');if(requireFiles&&(!s.trackTitle.trim()))throw Error('Completa il titolo di ogni brano.');if(s.fileUrl){const url=new URL(s.fileUrl);if(url.protocol!=='https:'||url.username||url.password)throw Error('Usa un collegamento HTTPS ai file.');}if(requireFiles&&choice.servizio!=='none'&&choice.produzione==='external')validateTransfer(s.fileUrl,s.filesThirtyDays);return {...s,trackTitle:s.trackTitle.trim()||`Brano ${i+1}`,trackCount:choice.servizio==='master'?1:choice.tracce,artists:choice.artisti,revisions:choice.revisioni_extra,rush:choice.consegna_veloce,production:choice.produzione,service:choice.servizio};});
 let night=0;
 if(q.hours){if(raw.date&&raw.time)night=buildRecordingQuote(raw.date,raw.time,q.hours).night;else if(requireFiles)throw Error('Scegli giorno e orario disponibili per la registrazione.');}
 const studio=q.studio+night,custom=q.custom,total=q.total+night;
 const studioDeposit=Math.round(studio/2),customDeposit=Math.round(custom/2);
 const balance=studio+custom-studioDeposit-customDeposit,dueNow=total-balance;
 let studioLeft=studioDeposit,beatLeft=customDeposit;
 const studioLines=q.lines.filter(l=>l.name.startsWith('Registrazione'));
 const withNight=[...q.lines,...(night?[{name:'Supplemento notturno · 9,99 € ogni 30 minuti',amount:night}]:[])];
 const lines:OrderLine[]=withNight.map((l)=>{let payNow=l.amount;if(l.name.includes('produzioni GENKS')){payNow=beatLeft;beatLeft=0;}else if(l.name.startsWith('Registrazione')||l.name.startsWith('Supplemento notturno')){const last=l===studioLines.at(-1)&&!night||l.name.startsWith('Supplemento notturno');payNow=last?studioLeft:Math.min(studioLeft,Math.round(l.amount/2));studioLeft-=payNow;}return {...l,payNow};});
 const guarantees=q.shares.flatMap((amount,i)=>project.brani[i].servizio==='none'?[]:[{title:songs[i].trackTitle,amount:Math.round(amount*.3)}]);
 return {selection:{...raw,songs,date:q.hours?raw.date:'',time:q.hours?raw.time:'',hours:q.hours,extraHours:project.ore_extra},title:`${project.brani.length>=8?'Album':'EP'} Pack personalizzato · ${songs.length} brani`,total,listTotal:q.listTotal+night,saving:Math.max(0,q.listTotal-q.total),deposit:studioDeposit+customDeposit,dueNow,cardNow:raw.payment==='card'?dueNow:0,cashNow:raw.payment==='cash'?dueNow:0,balance,studioAmount:studio,customAmount:custom,hours:q.hours,guarantees,lines,firstVersion:songs.some((_,i)=>project.brani[i].servizio!=='none')||q.beats?firstVersionEstimate(now,!q.beats&&project.brani.filter(s=>s.servizio!=='none').every(s=>s.consegna_veloce),early,q.beats?10:7):null};
}
export function productionSelection(project:ProductionInput):OrderSelection{return {kind:'production',production:project,songs:project.brani.map((s,i)=>({trackTitle:`Brano ${i+1}`,trackCount:s.tracce,artists:s.artisti,revisions:s.revisioni_extra,rush:s.consegna_veloce,fileUrl:'',production:s.produzione})),hours:0,extraHours:project.ore_extra,date:'',time:'',payment:'card',notes:'',rights:project.brani.some(s=>s.produzione==='genks')?'split50':'own'};}
