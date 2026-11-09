import { studioAppointmentPaymentNotice } from './studio-deposit-final-balance.ts';
export function serviceOrderNotice({paid,review,awaitingCard}:{paid:boolean;review:boolean;awaitingCard:boolean}){
 if(review)return 'GENKS verificherà l’incasso e la disponibilità. Controlla l’email e non ripetere il pagamento.';
 if(paid)return 'Pagamento ricevuto. L’acconto con carta conferma automaticamente solo la relativa sessione. Il saldo si paga a fine lavoro.';
 if(awaitingCard)return 'La conferma delle sessioni pagate con carta è in verifica. Il resto dell’ordine è già confermato.';
 return studioAppointmentPaymentNotice;
}
