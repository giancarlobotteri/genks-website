/** Match the message to the verified payment state, never a percentage from an old agreement. */
export function serviceOrderNotice({paid,review,awaitingCard}:{paid:boolean;review:boolean;awaitingCard:boolean}){
 if(paid&&!review)return 'Le sessioni con anticipo pagato con carta sono confermate. Eventuali sessioni con anticipo in contanti restano in attesa del relativo incasso.';
 if(review)return 'GENKS verificherà la disponibilità prima di confermare. Controlla l’email e non ripetere il pagamento.';
 if(awaitingCard)return 'Stiamo attendendo la conferma verificata del pagamento con carta. Non ripetere il pagamento: controlla l’email e la tua area personale. Se la conferma non arriva, contatta l’assistenza indicando il codice ordine.';
 return 'La creazione dell’ordine non conferma una sessione. Per i contanti passa in studio, paga e presenta il codice ordine: GENKS registrerà l’incasso e la conferma. Per la sola registrazione versa 20 € di acconto; se il totale della sessione è 19,99 €, bastano 10 €. L’acconto non supera mai il totale. Pacchetti, beat e altri servizi si pagano per intero prima dell’avvio. Per le sessioni in contanti versa la quota iniziale entro metà del tempo tra richiesta e inizio: tra 2 giorni hai 1 giorno, tra 6 giorni hai 3 giorni. Senza incasso registrato la riserva scade automaticamente. La scadenza esatta è nell’email.';
}
