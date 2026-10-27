import {recordingDepositCents} from './service-payment-policy.ts';
import {quoteStudioBundle} from './studio-bundle-order.ts';
import type {ProductionInput} from './production-calculator.ts';
import {quoteProductionPart} from './production-order.ts';
import {validateTransfer} from './swiss-transfer.ts';
import {projectPrice,recordingHourlyCents,serviceAmount} from './service-rates.ts';
import {packageByCode,vocalPrice,revisionTotal,customBeat,guaranteeRefund} from './service-catalog.ts';
import {buildRecordingQuote} from './recording-quote.ts';
import {firstVersionEstimate} from './service-delivery.ts';
import {discountPrice,type PublicDiscount} from './public-discounts.ts';
export const orderVersion='2026-10-26-commerce-v8';
export type OrderSong={trackTitle:string;trackCount:number;artists:number;revisions:number;rush:boolean;fileUrl:string;production?:'genks'|'external';filesThirtyDays?:boolean};
export type OrderSelection={kind:'production'|'mix'|'master'|'mix_master'|'recording'|'custom'|'package';packageCode?:string;production?:ProductionInput;songs:OrderSong[];hours:number;extraHours:number;date:string;time:string;payment:'card'|'cash';notes:string;rights:'split50'|'own';appointments?:import('./project-appointments-v10.ts').ProjectAppointmentV10[];};
export type OrderLine={name:string;amount:number;payNow?:number};
export type OrderPart={selection:OrderSelection;title:string;total:number;listTotal:number;saving:number;deposit:number;dueNow:number;cardNow:number;cashNow:number;balance:number;studioAmount:number;customAmount:number;hours:number;guarantees:{title:string;amount:number}[];lines:OrderLine[];firstVersion:string|null;creditMinutes?:number;bookingDeposit?:number;bookingAmount?:number};
const int=(value:unknown,min:number,max:number)=>{if(!Number.isInteger(value)||Number(value)<min||Number(value)>max)throw Error('Valore numerico non valido.');return Number(value);};
export function quoteOrder(input:unknown,early=false,now=new Date(),discounts:PublicDiscount[]=[],options:{requireFiles?:boolean}={}){
 if(!Array.isArray(input)||input.length<1||input.length>20)throw Error('Scegli da 1 a 20 servizi.');
 const parts:OrderPart[]=input.map((raw):OrderPart=>{
  if(!raw||typeof raw!=='object')throw Error('Servizio non valido.');
  const r=raw as OrderSelection;
  if(r.kind==='production')return quoteProductionPart(r,early,now,Boolean(options.requireFiles));
  if(!['mix','master','mix_master','recording','custom','package'].includes(r.kind)||!['card','cash'].includes(r.payment)||!['own','split50'].includes(r.rights)||typeof r.notes!=='string'||r.notes.length>2000)throw Error('Controlla servizio e pagamento.');
  const pack=r.kind==='package'?packageByCode(r.packageCode):null;
  if(r.kind==='package'&&!pack)throw Error('Pacchetto non valido.');if(r.packageCode==='ep')throw Error('Configura il nuovo EP dalla pagina EP e album.');
  const hasBeat=r.kind==='custom'||r.packageCode==='turnkey';
  if(hasBeat&&r.rights!=='split50')throw Error('Per il 100% dei diritti serve un preventivo prima dell’acquisto.');
  const expected=pack?pack.songs:r.kind==='recording'?0:r.kind==='custom'?1:Array.isArray(r.songs)?r.songs.length:0;
  if(!pack&&r.kind!=='recording'&&(expected<1||expected>20))throw Error('Scegli da 1 a 20 brani.');
  if(!Array.isArray(r.songs)||r.songs.length!==expected)throw Error('Controlla il numero di brani.');
  const audio=pack?.service??r.kind;
  const songs=r.songs.map((s,i)=>{
   if(!s||typeof s.trackTitle!=='string'||s.trackTitle.trim().length<1||s.trackTitle.length>160||typeof s.rush!=='boolean'||typeof s.fileUrl!=='string'||s.fileUrl.length>2000)throw Error('Completa il titolo e i dettagli del brano.');
   int(s.trackCount,1,audio==='master'||audio==='custom'?1:1000);int(s.artists,0,audio==='master'||audio==='custom'?0:20);int(s.revisions,0,2);
   if(audio==='custom'&&s.rush)throw Error('La consegna veloce non si applica alla produzione del beat.');
   if(s.production!==undefined&&!['genks','external'].includes(s.production))throw Error('Indica la provenienza della produzione.');
   if(options.requireFiles&&audio!=='custom'&&r.packageCode!=='turnkey'&&r.packageCode!=='voice'&&s.production!=='genks')validateTransfer(s.fileUrl,s.filesThirtyDays);
   if(s.fileUrl){const u=new URL(s.fileUrl);if(u.protocol!=='https:'||u.username||u.password)throw Error('Usa un collegamento HTTPS ai file.');}
   return {...s,trackTitle:s.trackTitle.trim()||`Brano ${i+1}`};
  });
  if(pack&&songs.some(s=>s.revisions>0||s.rush))throw Error('Il pacchetto include una revisione e tempi standard: puoi modificare soltanto tracce audio separate e ore dove previste.');
  int(r.extraHours,0,6);
  if(r.packageCode==='hours'&&r.extraHours)throw Error('Il blocco contiene cinque ore; gli ampliamenti richiedono un nuovo accordo.');
  const studio=pack?.studio||r.kind==='recording';
  if(!studio&&r.extraHours)throw Error('Ore extra non applicabili.');
  const hours=r.kind==='recording'?r.hours:r.packageCode==='hours'?(r.hours||5):studio?(r.hours||1)+r.extraHours:0;
  if(r.packageCode==='hours'&&hours>5)throw Error('Il blocco contiene cinque ore.');
  if(studio&&(!Number.isFinite(hours)||hours<.25||hours>8||hours*4!==Math.round(hours*4)))throw Error('Durata non valida.');
  if(!studio&&r.hours!==0)throw Error('Durata non applicabile.');
  if(r.packageCode==='voice'||r.packageCode==='turnkey'){
   if(typeof r.date!=='string'||typeof r.time!=='string'||((options.requireFiles||r.date&&r.time)&&(!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time))))throw Error('Scegli giorno e ora.');
   return quoteStudioBundle({...r,songs},hours,early,now,discounts);
  }
  const lines:OrderLine[]=[];
  let listBase:number=pack?.separate??0,base:number=pack?.price??0,upgrades=0;
  if(r.kind==='custom'){base=customBeat.total;listBase=base;}
  if(pack)lines.push({name:pack.name,amount:base});
  if(r.kind==='custom')lines.push({name:'Beat su misura · una revisione inclusa · split 50/50',amount:base});
  for(const s of songs){if(audio==='custom')continue;const price=projectPrice(audio,s.trackCount);if(price===null)throw Error('Controlla il numero di tracce audio separate.');if(pack){const upgrade=audio==='master'?0:price;upgrades+=upgrade;if(upgrade)lines.push({name:`${s.trackTitle} · adeguamento fascia ${s.trackCount} file`,amount:upgrade});}else{const paid=discountPrice(price,[audio,'projects','services'],discounts);base+=paid;listBase+=price;lines.push({name:`${s.trackTitle} · ${audio.replaceAll('_',' + ')} · ${s.trackCount} file · una revisione inclusa`,amount:paid});}}
  let night=0;
  if(studio){
   if(typeof r.date!=='string'||typeof r.time!=='string')throw Error('Scegli giorno e ora.');
   if((options.requireFiles||r.date&&r.time)&&(!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time)))throw Error('Scegli giorno e ora.');
   const recording=buildRecordingQuote(r.date,r.time,hours,pack?[]:discounts);
   night=recording.night;
   if(r.kind==='recording'){base=recording.total;listBase=base;lines.push(...recording.lines.map(l=>({name:l.name,amount:l.quantity*l.unitAmount})));}
   else{const extra=r.packageCode==='hours'?0:recording.base;upgrades+=extra+night;if(extra)lines.push({name:`Registrazione · ${hours} ore × 19,99 €/ora`,amount:extra});if(night)lines.push({name:'Supplemento notturno · +10,00 €/ora; tariffa totale 29,99 €/ora',amount:night});}
  }
  const studioAmount=studio?(pack?r.packageCode==='hours'?pack.price+night:Math.round(hours*recordingHourlyCents)+night:base):0;
  const customAmount=hasBeat?(pack?pack.price:base):0;
  const guarantees=audio==='custom'?[]:songs.map(s=>({title:s.trackTitle,amount:guaranteeRefund(pack?audio==='master'?Math.round(pack.price/pack.songs):projectPrice(audio,s.trackCount)!:discountPrice(projectPrice(audio,s.trackCount)!,[audio,'projects','services'],discounts))}));
  let extras=0;
  for(const s of songs){for(const [label,amount] of [['Correzione e pulizia delle voci',vocalPrice(s.artists)],['Revisioni aggiuntive',revisionTotal(s.revisions)],['Prima versione entro 48 ore',s.rush?1999:0]] as const){if(amount){extras+=amount;lines.push({name:`${s.trackTitle} · ${label}${label.startsWith('Correzione')?` · ${s.artists} artisti`:label.startsWith('Revisioni')?` · ${s.revisions}`:''}`,amount});}}}
  const total=base+upgrades+extras;
  const deposit=r.kind==='recording'?recordingDepositCents(total):pack?total:customAmount;
  const balance=r.kind==='recording'?total-deposit:pack?0:customAmount-deposit;
  const dueNow=total-balance;
  const comparison=pack?songs.reduce((n,s)=>n+discountPrice(projectPrice(audio,s.trackCount)!,[audio,"projects","services"],discounts),0)+(studio?Math.round(hours*discountPrice(recordingHourlyCents,["recording","services"],discounts))+night:0)+(hasBeat?customBeat.total:0)+extras:listBase+upgrades+extras;
  const title=pack?.name??({mix:'Mix',master:'Master stereo',mix_master:'Mix + master',recording:'Registrazione in studio',custom:'Beat su misura',package:'Pacchetto',production:'EP / Album Pack'}[r.kind]);
  return {selection:{...r,songs},title,total,listTotal:comparison,saving:Math.max(0,comparison-total),deposit,dueNow,cardNow:r.payment==='card'?dueNow:0,cashNow:r.payment==='cash'?dueNow:0,balance,studioAmount,customAmount,hours:studio?hours:0,...studio?{bookingDeposit:r.kind==='recording'?deposit:r.packageCode==='hours'?Math.round((studioAmount-night)*hours/5)+night:studioAmount}:{},...r.packageCode==='hours'?{creditMinutes:300,bookingAmount:Math.round((studioAmount-night)*hours/5)+night}:{},guarantees,lines,firstVersion:songs.length?firstVersionEstimate(now,audio!=='custom'&&songs.every(s=>s.rush),early,audio==='custom'?10:7):null};
 });
 const sum=(key:'total'|'cardNow'|'cashNow'|'balance'|'saving')=>parts.reduce((n,p)=>n+p[key],0);
 return {version:orderVersion,parts,total:sum('total'),cardNow:sum('cardNow'),cashNow:sum('cashNow'),balance:sum('balance'),saving:sum('saving')};
}
export type OrderQuote=ReturnType<typeof quoteOrder>;
export function orderSummary(q:OrderQuote){return [
 ...q.parts.flatMap((p,i)=>[`SERVIZIO ${i+1} · ${p.title}`,...p.lines.map(l=>`${l.name}: ${serviceAmount(l.amount)}`),`Totale servizio: ${serviceAmount(p.total)} · Risparmi ${serviceAmount(p.saving)}`,`Da versare ora: ${serviceAmount(p.dueNow)} (${p.selection.payment==='card'?'carta':'contanti in studio'}) · Saldo ancora da pagare: ${serviceAmount(p.balance)}`,...(p.selection.production?p.selection.production.brani.map((s,i)=>`${p.selection.songs[i].trackTitle}: ${s.produzione==='genks'?'Produzione GENKS inclusa nel pacchetto':'Base del cliente, produzione 0 EUR'}; ${s.servizio==='none'?'nessuna lavorazione audio':s.servizio.replaceAll('_',' + ')}; ${s.tracce} tracce audio separate; ${s.artisti} artisti inclusi`):[]),...p.selection.songs.filter(s=>s.fileUrl).map(s=>`File · ${s.trackTitle}: ${s.fileUrl}`),p.selection.notes?`Note del cliente: ${p.selection.notes}`:"",...p.guarantees.map(g=>`Garanzia commerciale 30% · ${g.title}: ${serviceAmount(g.amount)}`),p.selection.date?`Appuntamento richiesto: ${p.selection.date} ${p.selection.time} · ${p.hours} ore · Europe/Rome`:'',p.selection.rights==='split50'?'Beat GENKS: split 50/50 dei diritti patrimoniali concordati sulla composizione. Il 100% richiede un preventivo.':'Materiale del cliente: nessuno split attribuito dal solo mix/master o registrazione.']),
 `TOTALE ORDINE: ${serviceAmount(q.total)}`,`CARTA ORA: ${serviceAmount(q.cardNow)}`,`CONTANTI DA VERSARE ORA IN STUDIO: ${serviceAmount(q.cashNow)}`,`SALDO ANCORA DA PAGARE: ${serviceAmount(q.balance)}`,
 'Pacchetti e progetti: pagamento completo del totale configurato prima dell’avvio. Sola prenotazione studio: acconto 20 €, oppure 10 € su un totale di 19,99 €, senza superare il prezzo; il saldo resta da versare. Beat singolo: 34,99 € da pagare interamente prima dell’avvio. Per i contanti passa in studio, paga e presenta il codice ordine entro metà del tempo tra richiesta e appuntamento. Senza incasso l’orario si libera automaticamente. Per EP e album sono prenotabili solo le 2 ore incluse per brano; le ore ulteriori richiedono una nuova prenotazione separata con relativo pagamento, secondo disponibilità. Gli altri pacchetti consentono le ore configurabili previste; eventuali prolungamenti non previsti si concordano, senza addebiti automatici.',
 'Una revisione inclusa per lavorazione. Extra: prima +9,99 €, seconda +14,99 €, poi +5 € sul prezzo della precedente; oltre due extra serve disponibilità GENKS. Garanzia commerciale 30% dopo la revisione inclusa, entro 14 giorni; condizioni e diritti legali restano distinti.'
 ].filter(Boolean).join('\n\n');}

/** Integer allocation: audio extras are paid in full; studio/beat advance is distributed across its lines. */
export function cardOrderLines(q:OrderQuote):OrderLine[]{return q.parts.filter(p=>p.cardNow>0).flatMap(p=>{
 if(p.lines.every(l=>l.payNow!==undefined)){const lines=p.lines.filter(l=>(l.payNow??0)>0).map(l=>({name:l.name,amount:l.payNow!}));if(lines.reduce((n,l)=>n+l.amount,0)!==p.cardNow)throw Error('Ripartizione pagamento non valida.');return lines;}
 const isExtra=(name:string)=>/Correzione e pulizia|Revisioni aggiuntive|Prima versione entro 48/.test(name);
 const extras=p.lines.filter(l=>isExtra(l.name));const bases=p.lines.filter(l=>!isExtra(l.name));
 const due=p.cardNow-extras.reduce((n,l)=>n+l.amount,0),baseTotal=bases.reduce((n,l)=>n+l.amount,0);let allocated=0;
 return [...bases.map((l,i)=>{const amount=i===bases.length-1?due-allocated:Math.floor(due*l.amount/baseTotal);allocated+=amount;return {name:(p.balance?"Quota iniziale · ":"")+l.name,amount};}),...extras].filter(l=>l.amount>0);
});}
