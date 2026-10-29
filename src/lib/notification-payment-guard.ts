/** Central gate shared by immediate sends, scheduled workers and manual retries. */
export type NotificationDecision = 'send' | 'cancel' | 'defer';
export type AgreementState = {cash: boolean; paid: boolean; terminal: boolean};
export type PaymentState = {status: string};
export type NotificationReaders = {
 order: (id: string) => Promise<{card: boolean} | null>;
 payment: (id: string) => Promise<PaymentState | null>;
 contract: (id: string) => Promise<AgreementState | null>;
 reservation: (reference: string) => Promise<AgreementState | null>;
};
const uuid='([a-f0-9-]{36})';
export async function notificationPaymentGuard(key:string,read:NotificationReaders):Promise<NotificationDecision>{
 const initial=key.match(new RegExp('^v8-(?:order|owner)-'+uuid+'$'));
 if(initial){
  const order=await read.order(initial[1]);
  if(!order)throw Error('Ordine della notifica non disponibile.');
  // Card orders use payment-*/v8-paid-owner-* after settlement, never the creation receipt.
  return order.card?'cancel':'send';
 }
 const receipt=key.match(new RegExp('^(?:payment-|v8-paid-owner-)'+uuid+'$'));
 if(receipt){const payment=await read.payment(receipt[1]);if(!payment)throw Error('Pagamento della notifica non disponibile.');return payment.status==='succeeded'?'send':'cancel';}
 const contract=key.match(new RegExp('^contract-'+uuid+'$'));
 if(contract){const state=await read.contract(contract[1]);if(!state)throw Error('Contratto della notifica non disponibile.');return state.terminal?'cancel':state.cash||state.paid?'send':'defer';}
 const reservation=key.match(/^(request|reservation)-((?:BKG|PRJ)-[A-Z0-9-]+)-(customer|admin)$/);
 if(reservation){const state=await read.reservation(reservation[2]);if(!state)throw Error('Richiesta della notifica non disponibile.');return state.terminal?'cancel':state.cash||state.paid?'send':'defer';}
 // Payment requests, support messages, refunds and reminder messages have their own checks.
 return 'send';
}
