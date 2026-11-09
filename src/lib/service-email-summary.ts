import type {SavedOrderPart} from './saved-order-details.ts';
import {serviceAmount} from './service-rates.ts';
export type ServiceEmailOrder={reference:string;total:number;paid:number;name:string;artistName?:string|null;email:string;purchases?:string[];purchaseDetails?:SavedOrderPart[];quoteLines?:{descrizione:string;prezzo:string}[];initialDue?:number;confirmedServices?:boolean;cashDeadlines?:{until:string;amount:number;deposit:boolean;method?:'card'|'cash'}[]};
export function serviceEmailSummary(order:ServiceEmailOrder,audience:'owner'|'customer'){
 const clean=(value:string)=>value.replace(/[\r\n\t]/g," ").trim();
 const total=Math.max(0,order.total),paid=Math.max(0,order.paid);const subject=`GENKS - ${clean(order.reference)}`;
 const deadlineLines=(order.cashDeadlines??[]).map(({until,amount,deposit,method})=>{
  const when=new Date(until).toLocaleString("it-IT",{timeZone:"Europe/Rome",dateStyle:"long",timeStyle:"short"});
  const label=deposit?(method==="card"?"Acconto studio con carta":"Acconto studio in contanti"):"Pagamento completo in contanti";
  return `${label}: ${serviceAmount(amount)} da versare ${method==='card'?'con carta':'in studio'} entro ${when} (ora italiana). Se l’acconto non risulta incassato entro il termine, si libera solo la sessione. Gli altri servizi restano confermati.`;
 });
 if(audience==='owner'){
  const quotedItems=(order.quoteLines??[])
    .filter(line=>line.descrizione.trim())
    .map(line=>`${clean(line.descrizione)}: ${clean(line.prezzo)}`);
  const purchases=quotedItems.length ? quotedItems : (order.purchases??[]).map(clean).filter(Boolean);
  const fields=[
    `Totale: ${serviceAmount(total)}`,
    `Codice ordine: ${clean(order.reference)}`,
    `Email artista: ${clean(order.email)}`,
    `Nome artista: ${clean(order.artistName?.trim()||order.name)}`,
  ];
  if(!order.purchaseDetails?.length && purchases.length) fields.push(`Acquistato / prenotato: ${purchases.join(" • ")}`);
  if(order.confirmedServices) fields.push("Quello che resta da pagare si salda a fine lavoro. Gli altri servizi sono confermati anche se la sessione di studio è in attesa.");
  fields.push(...deadlineLines);
  return {subject,heading:'Hai un nuovo ordine.',body:fields.join('\n'),purchaseDetails:order.purchaseDetails,compact:true as const};
 }
 return {subject,heading:"Grazie per aver effettuato l'acquisto.",body:[`Totale: ${serviceAmount(total)}`,`Totale pagato: ${serviceAmount(paid)}`,`Saldo ancora da pagare: ${serviceAmount(Math.max(0,total-paid))}`,`Codice ordine: ${clean(order.reference)}`,...(order.initialDue&&order.initialDue<Math.max(0,total-paid)?[`Quota iniziale da versare per confermare: ${serviceAmount(order.initialDue)}`]:[]),...(order.quoteLines??[]).map(l=>`${clean(l.descrizione)}: ${clean(l.prezzo)}`),...(order.confirmedServices?["Gli altri servizi sono confermati. L’acconto con carta conferma automaticamente la sessione dopo la verifica dell’incasso. Per i contanti GENKS registra l’incasso. Il saldo si paga a fine lavoro."]:[]),...deadlineLines].join('\n'),compact:true as const,receiptFooter:true as const};
}
