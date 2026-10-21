import { remoteProjectPaymentsReady } from "@/lib/remote-project-payments";
import { studioCashOnly } from "@/lib/studio-payment-mode";
export type CustomerServiceQuote = {
  booking_id: string | null; project_id: string | null; amount_cents: number; currency: string;
  scope: string; fixed_price?: boolean; revision_count: number | null; agreed_deadline: string | null; status: string;
  checkout_url: string | null; expires_at: string;
};

export async function CustomerQuote({quote,payable,asOf}:{quote?:CustomerServiceQuote;payable:boolean;asOf:number}) {
  if(!quote)return null;
  let paymentUrl:string|undefined;
  try{const url=new URL(quote.checkout_url??"");if(url.protocol==="https:"&&url.hostname==="checkout.stripe.com")paymentUrl=url.href}catch{}
  const cardAllowed = !studioCashOnly || Boolean(quote.fixed_price && quote.project_id && await remoteProjectPaymentsReady());
  const open=cardAllowed&&payable&&quote.status==="open"&&new Date(quote.expires_at).getTime()>asOf;
  return <div className="service-form-note" style={{marginTop:16}}>
    <strong>{quote.fixed_price ? "Servizio" : "Preventivo"} · {new Intl.NumberFormat("it-IT",{style:"currency",currency:quote.currency}).format(quote.amount_cents/100)}</strong>
    <p style={{whiteSpace:"pre-wrap"}}>{quote.scope}</p>
    {quote.project_id&&!quote.fixed_price&&<small>Revisioni incluse: {quote.revision_count} · Consegna concordata: {quote.agreed_deadline??"Da concordare"}</small>}
    {quote.fixed_price && <small>Invio file, revisioni e consegna da concordare prima dell’avvio.</small>}
    {open&&paymentUrl?<><small>Valido fino al {new Date(quote.expires_at).toLocaleString("it-IT",{timeZone:"Europe/Rome"})}. Per modifiche contatta GENKS prima di pagare.</small><a className="button button-primary" href={paymentUrl}>Conferma e paga in sicurezza</a></>:<small>{quote.status==="paid"?"Pagamento ricevuto.":quote.fixed_price?"Pagamento con carta non completato o non disponibile. Contatta GENKS per assistenza.":studioCashOnly?"Concorda con GENKS la conferma e il pagamento in contanti presso lo studio.":"Contatta GENKS per aggiornare il preventivo."}</small>}
  </div>;
}
