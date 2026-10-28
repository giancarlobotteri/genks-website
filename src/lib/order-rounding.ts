import {recordingDepositCents} from './service-payment-policy.ts';
import type {OrderQuote,OrderPart} from './service-order-v8.ts';
export const roundingLineName='Arrotondamento del totale a ,99';
/** Integer euros decrease by one cent; other positive amounts move to x,99. */
export function totalEnding99(cents:number){
 if(!Number.isSafeInteger(cents)||cents<0)throw Error('Importo non valido.');
 return cents===0?0:cents%100===0?cents-1:Math.floor(cents/100)*100+99;
}
export function roundOrderQuote<T extends OrderQuote>(raw:T):T{
 const adjustment=totalEnding99(raw.total)-raw.total;if(!adjustment)return raw;
 const parts=raw.parts.map(p=>({...p,lines:p.lines.map(l=>({...l}))}));
 const target=parts.find(p=>p.selection.kind!=='recording'&&!p.standaloneRecording)??parts[0];
 if(!target)throw Error('Ordine senza servizi.');
 const recording=target.selection.kind==='recording'||target.standaloneRecording;
 target.total+=adjustment;
 if(recording){
  const before=target.dueNow;target.dueNow=recordingDepositCents(target.total);target.balance=target.total-target.dueNow;
  target.deposit=target.dueNow;target.bookingDeposit=target.dueNow;target.studioAmount+=adjustment;
  if(target.bookingAmount!==undefined)target.bookingAmount+=adjustment;
  if(target.selection.payment==='card')target.cardNow+=target.dueNow-before;else target.cashNow+=target.dueNow-before;
 }else{
  target.dueNow+=adjustment;if(target.deposit===target.total-adjustment)target.deposit+=adjustment;
  if(target.selection.payment==='card')target.cardNow+=adjustment;else target.cashNow+=adjustment;
 }
 const initialAdjustment=recording?target.dueNow-raw.parts[parts.indexOf(target)].dueNow:adjustment;
 target.lines.push({name:roundingLineName,amount:adjustment,...(target.lines.every(l=>l.payNow!==undefined)?{payNow:initialAdjustment}:{})});
 target.saving=Math.max(0,target.listTotal-target.total);
 const sum=(key:'total'|'cardNow'|'cashNow'|'balance'|'saving')=>parts.reduce((n,p)=>n+p[key],0);
 return {...raw,parts:parts as OrderPart[],total:sum('total'),cardNow:sum('cardNow'),cashNow:sum('cashNow'),balance:sum('balance'),saving:Math.max(0,raw.saving-adjustment)};
}
