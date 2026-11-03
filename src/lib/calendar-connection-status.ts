export function calendarConnectionStatus({direct,busy,subscription}:{direct:boolean;busy:boolean;subscription:boolean}){
 if(busy)return {label:'Libero/occupato collegato',description:'Gli impegni segnati Occupato nel calendario condiviso bloccano gli orari sul sito. '+(direct?'Le prenotazioni GENKS vengono create direttamente nell’agenda.':'Le prenotazioni e le scadenze GENKS arrivano tramite la sottoscrizione dell’agenda.')};
 if(direct)return {label:'Collegamento diretto',description:'Prenotazioni e scadenze vengono inviate direttamente al calendario.'};
 if(subscription)return {label:'Agenda GENKS aggiunta',description:'La sottoscrizione mostra prenotazioni e scadenze del sito. La lettura degli impegni esterni non è configurata: questi non bloccano gli orari.'};
 return {label:'Agenda da collegare',description:'Collega il calendario per consultare le prenotazioni e leggere gli impegni occupati.'};
}
