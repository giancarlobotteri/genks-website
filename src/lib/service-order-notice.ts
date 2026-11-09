import { studioAppointmentPaymentNotice } from './studio-deposit-final-balance.ts';
export function serviceOrderNotice({paid,review,awaitingCard}:{paid:boolean;review:boolean;awaitingCard:boolean}){
 if(review)return 'GENKS verificherà l’incasso e la disponibilità prima di confermare. Controlla l’email e non ripetere il pagamento.';
 if(paid)return 'Pagamento ricevuto: le sessioni e i servizi pagati con carta sono confermati. Quello che resta si paga a fine lavoro.';
 if(awaitingCard)return 'Il pagamento con carta è in verifica. Non ripetere il pagamento: l’ordine si conferma appena l’incasso è verificato.';
 return studioAppointmentPaymentNotice;
}
