import {notFound} from "next/navigation";
import {packageByCode} from "@/lib/service-catalog";
import { getPublicDiscounts } from "@/lib/public-discounts-server";
import { remoteProjectPaymentsReady } from "@/lib/remote-project-payments";
import { ReservationSuccess } from "@/components/services/reservation-success";
import { ProjectRequestForm } from "@/components/services/project-song-wizard";

import type { Metadata } from "next";
export const metadata: Metadata = { title: "Richiedi mix e master", description: "Scegli mix, master o mix e master. Scegli il servizio e scopri il prezzo per un brano. Lavoro a distanza oppure fisicamente in studio.", alternates: { canonical: "/services/project" } };

export default async function ProjectPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  if(q.package && (typeof q.package!=="string" || !packageByCode(q.package)))notFound();
  if (typeof q.success === "string" && q.success.startsWith("PRJ-")) return <ReservationSuccess reference={q.success} project />;
  const service = typeof q.service === "string" && ["mix", "master", "mix_master"].includes(q.service) ? q.service : "";
  const requestedTracks = typeof q.tracks === "string" ? Number(q.tracks) : 1;
  const initialTrackCount = service !== "master" && Number.isInteger(requestedTracks) && requestedTracks >= 1 && requestedTracks <= 48 ? requestedTracks : 1;
  return <div className="portal-shell narrow-shell service-portal">
    <h1 className="sr-only">Mix e master · scegli il tuo servizio</h1>
    {q.success && <p className="notice success" role="status">Prenotazione {q.success} confermata. Riceverai il riepilogo via email; invio file e consegna si organizzano prima dell’avvio.</p>}
    {q.payment === "cancelled" && <p className="notice">Pagamento non completato. Nessun incasso è stato confermato. Puoi scegliere di nuovo il servizio.</p>}
    {q.error && <p className="notice error" role="alert">{q.error === "price" ? "Il listino è stato aggiornato mentre compilavi. Ricontrolla il totale aggiornato prima di confermare." : q.error === "remote_payment" ? "Il pagamento con carta non è al momento disponibile. Riprova oppure contatta GENKS." : q.error === "limit" ? "Hai già inviato diverse richieste. Attendi un’ora prima di riprovare." : q.error === "save" ? "Non è stato possibile salvare la richiesta. Riprova tra poco." : q.error === "setup" ? "Le richieste sono temporaneamente non disponibili. Contatta GENKS." : "Controlla i campi: nome di almeno 2 caratteri, email valida e descrizione di almeno 10 caratteri."}</p>}
    
    <ProjectRequestForm discounts={await getPublicDiscounts()} packageCode={typeof q.package === "string" ? q.package : ""} initialService={service} initialTrackCount={initialTrackCount} remoteCardReady={await remoteProjectPaymentsReady()} />
  </div>;
}
