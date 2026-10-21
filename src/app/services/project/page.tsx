import { remoteProjectPaymentsReady } from "@/lib/remote-project-payments";
import { ReservationSuccess } from "@/components/services/reservation-success";
import { ProjectRequestForm } from "@/components/services/project-request-form";
import { GenksEmblem } from "@/components/brand/genks-emblem";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Richiedi mix e master", description: "Scegli mix, master o mix e master. Scegli il servizio e scopri il prezzo per un brano. Lavoro a distanza oppure fisicamente in studio.", alternates: { canonical: "/services/project" } };

export default async function ProjectPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  if (typeof q.success === "string" && q.success.startsWith("PRJ-")) return <ReservationSuccess reference={q.success} project />;
  const service = typeof q.service === "string" && ["mix", "master", "mix_master"].includes(q.service) ? q.service : "";
  return <div className="portal-shell narrow-shell service-portal">
    <div className="service-page-heading"><div><span className="eyebrow">MIX E MASTER</span><h1>Diamo forma al tuo brano.</h1><p className="muted">Puoi lavorare a distanza, inviando i file online, oppure fisicamente in studio con un incontro da organizzare. Scegli il servizio per vedere il prezzo per un brano. Tempi e revisioni vengono concordati prima dell’avvio.</p></div><GenksEmblem /></div>
    {q.success && <p className="notice success" role="status">Prenotazione {q.success} confermata. Riceverai il riepilogo via email; invio file e consegna si organizzano prima dell’avvio.</p>}
    {q.payment === "cancelled" && <p className="notice">Pagamento non completato. Nessun incasso è stato confermato. Puoi scegliere di nuovo il servizio.</p>}
    {q.error && <p className="notice error" role="alert">{q.error === "remote_payment" ? "Il pagamento con carta per i progetti a distanza non è ancora disponibile. Contatta GENKS oppure scegli un incontro in studio." : q.error === "limit" ? "Hai già inviato diverse richieste. Attendi un’ora prima di riprovare." : q.error === "save" ? "Non è stato possibile salvare la richiesta. Riprova tra poco." : q.error === "setup" ? "Le richieste sono temporaneamente non disponibili. Contatta GENKS." : "Controlla i campi: nome di almeno 2 caratteri, email valida e descrizione di almeno 10 caratteri."}</p>}
    
    <ProjectRequestForm initialService={service} remoteCardReady={await remoteProjectPaymentsReady()} />
  </div>;
}
