const messages: Record<string,string> = {
 package_saved: "Ore del pacchetto aggiornate.", package_error: "Aggiornamento non eseguito: verifica pagamento, ore residue e scadenza.",
  extra_time_saved:"Tempo extra e totale da incassare aggiornati. Nessun pagamento automatico registrato.",
  extra_time_error:"Tempo extra non aggiornato: ricarica la pagina e verifica che la sessione sia terminata e il pagamento non sia già stato registrato.",
  booking_alert_preview_sent:"Avviso di prova inviato a prod.genks@gmail.com. Nessuna prenotazione reale è stata creata.",
  booking_alert_preview_error:"Avviso di prova in attesa di invio. Controlla la quota email e riprova.",
  cash_saved:"Accordo o movimento in contanti registrato. Il cliente riceve il riepilogo via email.",
  cash_error:"Registrazione non riuscita: verifica conferma del cliente, importo e stato della richiesta. Un accordo già registrato non può essere sovrascritto.",
  reminder_preview_sent:"Anteprima inviata alla tua email amministratore. Nessuna prenotazione reale è stata creata.",
  reminder_preview_error:"Anteprima non inviata. Controlla la quota email e la configurazione Resend.",
  reminder_paused:"Promemoria messi in pausa. Le altre email GENKS restano attive.",
  reminder_enabled:"Promemoria delle sessioni confermate attivati.",
  blackout_conflict:"Il periodo si sovrappone a una richiesta o sessione esistente: gestiscila prima di bloccare l’orario.",
  stripe_configured:"Gli eventi necessari per pagamenti, scadenze, rimborsi e contestazioni sono configurati in Stripe.",
  stripe_error:"Non è stato possibile aggiornare l’endpoint Stripe. Controlla l’ambiente e le autorizzazioni delle credenziali.",
  quote_sent:"Preventivo registrato e inviato via email. Il link vale 24 ore, entro l’inizio della sessione.",
  email_pending:"Operazione salvata. Una o più email attendono l’invio: puoi ritentare dalla Panoramica.",
  invalid_quote:"Completa importo, attività incluse, revisioni e, per mix/master, scadenza concordata.",
  quote_error:"Preventivo non inviato. Controlla che la richiesta sia ancora da pagare, che Stripe sia configurato e che la scadenza sia valida. Un pagamento già completato deve prima essere confermato da Stripe.",
  invalid_status:"Passaggio non consentito. Gli stati di pagamento si aggiornano da Stripe; prosegui secondo l’ordine della lavorazione.",
  status_error:"Aggiornamento non riuscito: verifica disponibilità e stato attuale della richiesta.",
  retried:"Tentativo di invio completato. Le notifiche ancora in attesa restano visibili qui.",
  delivered:"Consegna registrata. L’email è stata messa in coda e il collegamento è disponibile nel progetto del cliente.",
};
export function OperationNotice({ code }: { code?: string }) {
  return code && messages[code] ? <p className="notice" role="status">{messages[code]}</p> : null;
}
