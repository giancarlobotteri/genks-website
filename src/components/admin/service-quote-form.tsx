type Quote = { amount_cents: number; scope: string; revision_count: number; agreed_deadline: string | null; status: string; checkout_url: string | null; expires_at: string; created_at: string };
export function ServiceQuoteForm({id,type,quotes,action}:{id:string;type:"booking"|"project";quotes:Quote[];action:(form:FormData)=>Promise<void>}) {
  const quote=[...quotes].sort((a,b)=>b.created_at.localeCompare(a.created_at))[0];
  return <form action={action} className="payment-request premium-form">
    <input name="id" type="hidden" value={id}/>
    <label>Totale del preventivo €<input name="price" type="number" min="0.50" max="100000" step="0.01" defaultValue={quote?quote.amount_cents/100:""} required/></label>
    <label>Attività e consegne incluse<textarea name="scope" minLength={10} maxLength={2000} rows={3} defaultValue={quote?.scope??""} placeholder={type==="booking"?"Durata, luogo e cosa comprende la sessione":"Lavoro incluso, formati consegnati e modalità di invio dei file"} required/></label>
    {type==="project"?<><label>Revisioni concordate<input name="revisions" type="number" min="0" max="50" defaultValue={quote?.revision_count??""} required/></label><label>Scadenza concordata<input name="deadline" type="date" defaultValue={quote?.agreed_deadline??""} required/></label></>:<input name="revisions" type="hidden" value="0"/>}
    <small>Valido 24 ore. Modificando il preventivo, il vecchio collegamento viene disattivato prima di inviare quello nuovo.</small>
    {quote&&<small>Ultimo preventivo: {quote.status} · scadenza {new Date(quote.expires_at).toLocaleString("it-IT",{timeZone:"Europe/Rome"})}</small>}
    <button className="button button-primary">Invia preventivo e pagamento</button>
  </form>;
}
