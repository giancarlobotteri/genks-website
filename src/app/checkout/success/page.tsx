import Link from "next/link";

export default async function SuccessPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q=await searchParams;
  const service=Boolean(q.booking||q.project);
  const destination=q.booking?"/account/bookings":q.project?"/account/projects":"/account/library";
  return <div className="portal-shell narrow-shell"><span className="eyebrow">VERIFICA DEL PAGAMENTO</span><h1>{service?"Il prossimo passo è confermato via email.":"Il tuo prossimo suono ti aspetta."}</h1><p className="muted">La conferma definitiva arriva dopo la verifica di Stripe. {service?"La tua richiesta si aggiornerà nell’area cliente.":"I file si sbloccano nella raccolta dopo il pagamento confermato."} Accedi usando la stessa email inserita al pagamento. Se l’aggiornamento tarda, controlla l’email prima di ripetere l’acquisto.</p><Link className="button button-primary" href={destination}>{service?"APRI LE TUE RICHIESTE":"APRI LA RACCOLTA"}</Link></div>;
}
