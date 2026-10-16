import { formatPrice } from "@/lib/format";
export function PaymentStatus({payments}:{payments:{amount_cents:number;refunded_cents:number;status:string;livemode:boolean;review_reason:string|null}[]}) {
  return <div className="service-payment-status">{payments.map((p,i)=><p key={i}>
    <strong>{p.livemode?"Pagamento reale":"Pagamento di prova"}: {formatPrice(p.amount_cents)}</strong>
    {p.refunded_cents>0&&<small>Rimborsato: {formatPrice(p.refunded_cents)}</small>}
    {p.review_reason&&<small className="notice error">{p.review_reason}</small>}
  </p>)}</div>;
}
