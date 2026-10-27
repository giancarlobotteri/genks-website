import 'server-only';
import {z} from 'zod';
import {readBookingAvailability} from '../booking-availability';
export const BOOKING_TOOL={name:'orari_disponibili',description:'Legge gli orari di inizio liberi nel calendario GENKS per data italiana e durata. Non prenota e non conferma.',parameters:{type:'OBJECT',properties:{data:{type:'STRING',description:'Data italiana YYYY-MM-DD'},ore:{type:'INTEGER',description:'Durata da 1 a 8 ore'}},required:['data','ore']}} as const;
export async function availableBookingLinks(input:unknown){
 const {data,ore}=z.object({data:z.iso.date(),ore:z.number().int().min(1).max(8)}).strict().parse(input);
 const result=await readBookingAvailability(data,ore);
 return {data,ore,fuso:'Europe/Rome',orari:('slots' in result?result.slots:[]).map(start=>({inizio:start,link:`https://www.prodbygenks.com/services/recording?${new URLSearchParams({date:data,hours:String(ore),start})}`})),nota:'Disponibilità al momento della richiesta: il cliente deve verificare e confermare dalla pagina di prenotazione. Nessuna riserva effettuata.'};
}
