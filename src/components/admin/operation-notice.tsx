const messages: Record<string,string> = {
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
