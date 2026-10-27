import {productionSelection,quoteProductionPart} from '../production-order.ts';
import {validateTransfer} from '../swiss-transfer.ts';
import {z} from 'zod';
import {verificaPreventivo as canonicalQuote} from './pricing.ts';
import {verificaPreventivo,decodificaPreventivo,codificaPreventivo,PREZZI,type Brano,type PreventivoInput,type Riga} from './pricing-breakdown.ts';
import {orderVersion,type OrderQuote,type OrderPart,type OrderLine} from '../service-order-v8.ts';
import {projectPrice,recordingHourlyCents} from '../service-rates.ts';
import {firstVersionEstimate} from '../service-delivery.ts';
import {buildRecordingQuote} from '../recording-quote.ts';

const song=z.object({servizio:z.enum(['mix','master','mix_master']),quantita:z.number().int().min(1).max(40).optional(),file:z.number().int().min(1).max(48).optional(),artisti_correzione_voce:z.number().int().min(0).max(20).optional(),revisioni_extra:z.number().int().min(0).max(2).optional(),consegna_veloce:z.boolean().optional()}).strict();
export const productionInputSchema=z.object({brani:z.array(z.object({servizio:z.enum(['none','mix','master','mix_master']),produzione:z.enum(['genks','external']),tracce:z.number().int().min(1).max(48),artisti:z.number().int().min(1).max(20),revisioni_extra:z.number().int().min(0).max(2),consegna_veloce:z.boolean()}).strict()).min(2).max(20),registrazione:z.boolean(),ore_extra:z.number().int().min(0).max(6)}).strict();
export const quoteInputSchema=z.object({progetto:productionInputSchema.optional(),brani:z.array(song).max(40).optional(),ore_registrazione:z.number().int().min(0).max(200).optional(),mezzore_dopo_mezzanotte:z.number().int().min(0).max(20).optional(),beat_su_misura:z.number().int().min(0).max(20).optional(),usa_pacchetti:z.boolean().optional()}).strict().refine(x=>(x.brani??[]).reduce((n,b)=>n+(b.quantita??1),0)<=40,'Massimo 40 brani per preventivo.');
const infoSchema=z.object({sessionHours:z.number().min(.25).max(8).optional(),date:z.union([z.iso.date(),z.literal('')]).default(''),time:z.union([z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),z.literal('')]).default(''),titles:z.array(z.string().trim().min(1).max(160)).max(40).default([]),files:z.array(z.string().max(2000)).max(40).default([]),sources:z.array(z.enum(['genks','external'])).max(40).default([]),fileConfirmations:z.array(z.boolean()).max(40).default([])}).strict();
export const quoteDetailsSchema=z.array(infoSchema).max(20);
export type QuoteDetail=z.infer<typeof infoSchema>;
type Draft={tipo:string;title:string;lines:OrderLine[];total:number;rawBalance:number;hours:number;credit:boolean;beat:number;songs:Brano[];personalizzato:boolean;studioAmount:number;customAmount:number};
function drafts(rows:Riga[]):Draft[]{
 const result:Draft[]=[];const deferred:Riga[]=[];
 for(const row of rows){const m=row.componente;if(!m)throw Error('Preventivo incompleto.');
  if(['extra_studio','night'].includes(m.tipo)){deferred.push(row);continue;}
  const count=m.tipo==='credits'?m.quantita??1:m.tipo==='custom'?m.beat??1:m.tipo==='recording'?Math.ceil((m.ore??0)/8):1;
  for(let i=0;i<count;i++){
   const hours=m.tipo==='credits'?5:m.tipo==='recording'?Math.min(8,(m.ore??0)-i*8):m.ore??0;
   const amount=m.tipo==='credits'?PREZZI.pacchetti.blocco5Ore:m.tipo==='custom'?PREZZI.beat:m.tipo==='recording'?hours*recordingHourlyCents:row.centesimi;
   const balance=m.tipo==='credits'||m.tipo==='custom'||m.tipo==='recording'?amount/2:m.saldo??0;
   const rawStudio=m.tipo==='turnkey'?2*recordingHourlyCents*PREZZI.pacchetti.singoloChiaviInMano/(PREZZI.beat+2*recordingHourlyCents+PREZZI.mixMaster[0]):m.tipo==='voice'?2*recordingHourlyCents*PREZZI.pacchetti.registrazioneMixMaster/(2*recordingHourlyCents+PREZZI.mixMaster[0]):hours?amount:0;
   const rawCustom=m.tipo==='turnkey'?PREZZI.beat*PREZZI.pacchetti.singoloChiaviInMano/(PREZZI.beat+2*recordingHourlyCents+PREZZI.mixMaster[0]):m.tipo==='custom'?amount:0;
   result.push({tipo:m.tipo,title:m.tipo==='custom'?`Beat su misura ${i+1} di ${count}`:row.personalizzato?'Offerta su misura · '+row.descrizione:row.descrizione,lines:[{name:count>1?`${row.descrizione} · quota ${i+1} di ${count}`:row.descrizione,amount}],total:amount,rawBalance:balance,hours,credit:m.tipo==='credits',beat:m.tipo==='turnkey'||m.tipo==='custom'?1:0,songs:m.brani??[],personalizzato:!!row.personalizzato,studioAmount:Math.round(rawStudio),customAmount:Math.round(rawCustom)});
  }
 }
 for(const row of deferred){const m=row.componente!;
  const eligible=result.filter(d=>m.tipo==='night'?d.hours>0:m.aggancio==='blocchi'?d.credit:!d.credit&&['turnkey','voice'].includes(d.tipo));
  let left=m.tipo==='night'?row.centesimi:(m.ore??0);
  for(const d of eligible){if(!left)break;const units=m.tipo==='night'?left:Math.min(left,d.credit?5:2);const amount=m.tipo==='night'?units:units*PREZZI.oraAggiuntivaPacchetto;d.lines.push({name:row.descrizione,amount});d.total+=amount;d.rawBalance+=amount/2;d.studioAmount+=amount;if(m.tipo!=='night')d.hours+=units;left-=units;}
  if(left)throw Error('Le ore aggiuntive richiedono una sessione compatibile.');
 }
 return result;
}
export function validateQuoteCode(code:string):PreventivoInput{
 if(!code||code.length>16000||!/^[A-Za-z0-9_-]+$/.test(code))throw Error('Preventivo non valido');
 const input=quoteInputSchema.parse(decodificaPreventivo(code));
 if(input.progetto&&((input.brani?.length??0)||(input.ore_registrazione??0)||(input.beat_su_misura??0)||(input.mezzore_dopo_mezzanotte??0)))throw Error('Usa il progetto configurabile senza duplicare i servizi.');
 if(input.brani?.some(b=>b.servizio==='master'&&(b.artisti_correzione_voce??0)>0))throw Error('La correzione delle voci si aggiunge al mix, non al master stereo.');
 if(!verificaPreventivo(code))throw Error('Preventivo non valido');
 return input;
}
function verifiedBreakdown(code:string){
 const canonical=canonicalQuote(code),annotated=verificaPreventivo(code);
 if(!canonical||!annotated||JSON.stringify(canonical.importi_centesimi)!==JSON.stringify(annotated.importi_centesimi)||canonical.righe.length!==annotated.righe.length||canonical.righe.some((r,i)=>r.prezzo!==annotated.righe[i].prezzo||r.descrizione!==annotated.righe[i].descrizione))throw Error('Preventivo non verificabile.');
 return {...canonical,righe:annotated.righe};
}
export function quotePreventivo(code:string,rawDetails:unknown=[],payment:'card'|'cash'='card',early=false,now=new Date(),requireDates=false){
 const input=validateQuoteCode(code);
 if(input.progetto){const details=quoteDetailsSchema.parse(rawDetails);const info=details[0];const selection=productionSelection(input.progetto);selection.payment=payment;selection.date=info?.date??'';selection.time=info?.time??'';selection.songs=selection.songs.map((s,i)=>({...s,trackTitle:info?.titles[i]??s.trackTitle,fileUrl:info?.files[i]??'',filesThirtyDays:info?.fileConfirmations[i]??false}));const part=quoteProductionPart(selection,early,now,requireDates);return {version:orderVersion,parts:[{...part,preventivoCode:code,personalizzato:true,creditMinutes:undefined as number|undefined}],total:part.total,cardNow:part.cardNow,cashNow:part.cashNow,balance:part.balance,saving:part.saving,preventivoCode:code,preventivo:canonicalQuote(code)!};}
 let checked=verifiedBreakdown(code);let ds=drafts(checked.righe);const details=quoteDetailsSchema.parse(rawDetails);
 if(payment!=='card'&&payment!=='cash')throw Error('Scegli come pagare.');
 let night=0;let hasDates=false;
 ds.forEach((d,i)=>{if(d.hours){const info=details[i];if(info?.date&&info.time){hasDates=true;if(d.credit&&(info.sessionHours??Math.min(d.hours,8))>d.hours)throw Error('Non puoi prenotare più ore del credito.');night+=buildRecordingQuote(info.date,info.time,d.credit?(info.sessionHours??Math.min(d.hours,8)):d.hours).night/999;}else if(requireDates)throw Error('Scegli giorno e orario per ogni sessione prima di confermare.');}});
 if(requireDates||hasDates){if((input.mezzore_dopo_mezzanotte??0)>0&&!hasDates)throw Error('Il supplemento notturno si determina dopo aver scelto l’appuntamento.');const updated={...input,mezzore_dopo_mezzanotte:night};code=codificaPreventivo(updated);checked=verifiedBreakdown(code);ds=drafts(checked.righe);}
 if(ds.length>20)throw Error('Per oltre 20 servizi separati contatta GENKS.');
 const balances=ds.map(d=>Math.floor(d.rawBalance));let rest=checked.importi_centesimi.saldo-balances.reduce((n,v)=>n+v,0);
 const order=ds.map((d,i)=>({i,f:d.rawBalance-Math.floor(d.rawBalance)})).sort((a,b)=>b.f-a.f);
 for(const x of order){if(rest<=0)break;balances[x.i]++;rest--;}
 if(rest!==0)throw Error('Ripartizione del preventivo non valida.');
 let songNumber=0;
 const parts=ds.map((d,i):OrderPart&{preventivoCode:string;creditMinutes?:number;personalizzato:boolean}=>{
  const info=details[i]??{date:'',time:'',titles:[],files:[],sources:[],fileConfirmations:[]};const balance=balances[i];const due=d.total-balance;
  const songs=d.songs.map((s,n)=>{songNumber++;const fileUrl=info.files[n]??'';const source=info.sources[n]??(d.tipo==='turnkey'?'genks':'external');if(requireDates&&source==='external')validateTransfer(fileUrl,info.fileConfirmations[n]);if(fileUrl){const u=new URL(fileUrl);if(u.protocol!=='https:'||u.username||u.password)throw Error('Usa collegamenti HTTPS ai file.');}return {trackTitle:info.titles[n]??`Brano ${songNumber}`,trackCount:s.file,artists:s.artisti,revisions:s.revisioni,rush:s.veloce,fileUrl,production:source,filesThirtyDays:info.fileConfirmations[n]??false,service:s.servizio};});
  const nightCents=d.lines.filter(l=>/mezzanotte|notturn/i.test(l.name)).reduce((n,l)=>n+l.amount,0);
  const upgrades=d.songs.reduce((n,s)=>n+(s.servizio==='master'?0:PREZZI.maggiorazionePacchetto[s.fascia]),0);
  const audioPaid=Math.max(0,d.total-d.studioAmount-d.customAmount-d.lines.slice(1).reduce((n,l)=>n+l.amount,0)-upgrades);
  const audioList=d.songs.reduce((n,s)=>n+(s.servizio==='master'?PREZZI.master:s.servizio==='mix'?PREZZI.mix[0]:PREZZI.mixMaster[0]),0);
  const guarantees=d.songs.map((s,n)=>({title:songs[n].trackTitle,amount:Math.round((d.tipo==='audio'?projectPrice(s.servizio,s.file)!:audioPaid*(s.servizio==='master'?PREZZI.master:s.servizio==='mix'?PREZZI.mix[0]:PREZZI.mixMaster[0])/audioList+(s.servizio==='master'?0:PREZZI.maggiorazionePacchetto[s.fascia]))*.3)}));
  return {selection:{kind:'package',packageCode:d.credit?'hours':'preventivo',songs,hours:d.hours,extraHours:0,date:info.date,time:info.time,payment,notes:checked.note.join('\n'),rights:d.beat?'split50':'own'},title:d.title,total:d.total,listTotal:d.total,saving:0,deposit:d.studioAmount+d.customAmount-balance,dueNow:due,cardNow:payment==='card'?due:0,cashNow:payment==='cash'?due:0,balance,studioAmount:d.studioAmount,customAmount:d.customAmount,hours:d.credit?(info.sessionHours??Math.min(d.hours,8)):d.hours,guarantees,lines:d.lines,firstVersion:songs.length?firstVersionEstimate(now,songs.every(s=>s.rush),early):d.beat?firstVersionEstimate(now,false,early,10):null,preventivoCode:code,...d.credit?{creditMinutes:d.hours*60,bookingAmount:Math.round((d.studioAmount-nightCents)*(info.sessionHours??Math.min(d.hours,8))/d.hours)+nightCents}:{},personalizzato:d.personalizzato};
 });
 const sum=(key:'total'|'cardNow'|'cashNow'|'balance')=>parts.reduce((n,p)=>n+p[key],0);
 const quote={version:orderVersion,parts,total:sum('total'),cardNow:sum('cardNow'),cashNow:sum('cashNow'),balance:sum('balance'),saving:Math.max(0,checked.importi_centesimi.listino-checked.importi_centesimi.totale),preventivoCode:code,preventivo:checked} satisfies OrderQuote&{preventivoCode:string;preventivo:typeof checked};
 if(quote.total!==checked.importi_centesimi.totale||quote.balance!==checked.importi_centesimi.saldo)throw Error('Importi del preventivo non coerenti.');
 return quote;
}
