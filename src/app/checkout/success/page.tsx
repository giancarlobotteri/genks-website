import Link from "next/link";

export default async function SuccessPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await searchParams;
  return <div className="portal-shell narrow-shell"><span className="eyebrow">PAGAMENTO RICEVUTO</span><h1>Il tuo prossimo suono ti aspetta.</h1><p className="muted">Stripe sta verificando il pagamento. La tua raccolta si aggiorna dopo la conferma.</p><Link className="button button-primary" href="/account/library">APRI LA RACCOLTA</Link></div>;
}
