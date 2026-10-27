import {parseBookingRequest} from './booking-request';
import {buildRecordingQuote} from '../recording-quote';
import {calcolaPreventivo} from './pricing';
import 'server-only';
import {z} from 'zod';
import {readBookingAvailability} from '../booking-availability';
export const BOOKING_TOOL={name:'orari_disponibili',description:'Legge gli orari di inizio liberi nel calendario GENKS per data italiana e durata. Non prenota e non conferma.',parameters:{type:'OBJECT',properties:{data:{type:'STRING',description:'Data italiana YYYY-MM-DD'},ore:{type:'INTEGER',description:'Durata da 1 a 8 ore'},ora:{type:'STRING',description:'Orario richiesto HH:mm, se indicato dal cliente'}},required:['data','ore']}} as const;
export async function availableBookingLinks(input:unknown){
 const {data,ore,ora}=z.object({data:z.iso.date(),ore:z.number().int().min(1).max(8),ora:z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).optional()}).strict().parse(input);
 const result=await readBookingAvailability(data,ore);
 return {data,ore,fuso:'Europe/Rome',...ora?{richiesto:{inizio:ora,disponibile:('slots' in result?result.slots:[]).includes(ora)}}:{},orari:('slots' in result?result.slots:[]).map(start=>({inizio:start,link:`https://www.prodbygenks.com/services/recording?${new URLSearchParams({date:data,hours:String(ore),start})}`})),nota:'Disponibilità al momento della richiesta: il cliente deve verificare e confermare dalla pagina di prenotazione. Nessuna riserva effettuata.'};
}

export async function answerBookingRequest(text:string){
 const input=parseBookingRequest(text);if(!input)return null;
 const r=await availableBookingLinks(input);
 const day=new Date(r.data+'T12:00:00Z').toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long',timeZone:'Europe/Rome'});
 const selected=r.richiesto;
 const response=selected?`${selected.disponibile?'Sì':'No'}, ${day} alle ${selected.inizio} ${selected.disponibile?'risulta disponibile':'non risulta disponibile'} per ${r.ore} ${r.ore===1?'ora':'ore'}.`:`${day}, per ${r.ore} ore: ${r.orari.length?'questi orari risultano liberi':'non risultano intervalli disponibili'}.`;
 const options=selected?.disponibile?r.orari.filter(x=>x.inizio===selected.inizio):r.orari.filter(x=>x.inizio.endsWith(':00')||x.inizio.endsWith(':30')).slice(0,6);
 let quote='';
 if(selected?.disponibile){const night=buildRecordingQuote(r.data,selected.inizio,r.ore).night/500;const q=calcolaPreventivo({ore_registrazione:r.ore,mezzore_dopo_mezzanotte:night,usa_pacchetti:false});quote=`Totale della sessione: **${q.totale}**. Anticipo: **${q.da_pagare_subito}**; saldo ancora da pagare ${q.saldo_successivo}.`+(night?' Il supplemento dopo mezzanotte è già incluso.':'');}
 return [response,quote,options.map(x=>`[${x.inizio} · scegli e conferma](${x.link})`).join('\n'),r.ore===1?'Ho verificato un’ora: per una sessione più lunga dimmi la durata.':'Disponibilità verificata per tutta la durata indicata.','La sessione non è ancora prenotata: si conferma dopo il pagamento dell’anticipo.'].filter(Boolean).join('\n\n');
}
