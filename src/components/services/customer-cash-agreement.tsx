import { formatPrice } from "@/lib/format";
export type CustomerCashAgreement = { booking_id: string | null; project_id: string | null; amount_cents: number; details: string; received_at: string | null; refunded_at: string | null };
export function CustomerCashAgreementSummary({ agreement }: { agreement?: CustomerCashAgreement }) {
  if (!agreement) return null;
  return <div className="service-form-note"><strong>Pagamento in studio · {formatPrice(agreement.amount_cents)}</strong><p style={{whiteSpace:"pre-wrap"}}>{agreement.details}</p><p>{agreement.refunded_at ? "Restituzione in contanti registrata da GENKS." : agreement.received_at ? "Pagamento in contanti registrato da GENKS." : "Pagamento in contanti da effettuare presso lo studio. Nessun pagamento online richiesto."}</p></div>;
}
