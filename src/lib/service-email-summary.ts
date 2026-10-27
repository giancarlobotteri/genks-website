import {serviceAmount} from './service-rates.ts';
export type ServiceEmailOrder={reference:string;total:number;paid:number;name:string;artistName?:string|null;email:string;cashDeadlines?:string[]};
export function serviceEmailSummary(order:ServiceEmailOrder,audience:'owner'|'customer'){
 const clean=(value:string)=>value.replace(/[\r\n\t]/g," ").trim();
 const total=Math.max(0,order.total),paid=Math.max(0,order.paid);const subject=`GENKS - ${clean(order.reference)}`;
 if(audience==='owner')return {subject,heading:'Hai un nuovo ordine.',body:[`Totale: ${serviceAmount(total)}`,`Codice ordine: ${clean(order.reference)}`,`Email artista: ${clean(order.email)}`,`Nome artista: ${clean(order.artistName?.trim()||order.name)}`].join('\n'),compact:true as const};
 return {subject,heading:"Grazie per aver effettuato l'acquisto.",body:[`Totale: ${serviceAmount(total)}`,`Totale pagato: ${serviceAmount(paid)}`,`Totale da pagare: ${serviceAmount(Math.max(0,total-paid))}`,`Codice ordine: ${clean(order.reference)}`,...(order.cashDeadlines??[]).map(d=>`Acconto 50% in studio entro: ${new Date(d).toLocaleString("it-IT",{timeZone:"Europe/Rome",dateStyle:"long",timeStyle:"short"})}. Senza incasso registrato la sessione si annulla automaticamente.`)].join('\n'),compact:true as const,receiptFooter:true as const};
}
