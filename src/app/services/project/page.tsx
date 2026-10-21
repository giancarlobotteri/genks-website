import { ReservationSuccess } from "@/components/services/reservation-success";
import { ProjectRequestForm } from "@/components/services/project-request-form";
import { GenksEmblem } from "@/components/brand/genks-emblem";
import { StudioPaymentNotice } from "@/components/services/studio-payment-notice";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Richiedi mix e master", description: "Scegli mix, master o mix e master. Mix 100 €, master 40 €, mix e master 120 € per brano. Anche a distanza, pagamento in contanti presso lo studio.", alternates: { canonical: "/services/project" } };

export default async function ProjectPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  if (typeof q.success === "string" && q.success.startsWith("PRJ-")) return <ReservationSuccess reference={q.success} project />;
  const service = typeof q.service === "string" && ["mix", "master", "mix_master"].includes(q.service) ? q.service : "mix_master";
  return <div className="portal-shell narrow-shell service-portal">
    <div className="service-page-heading"><div><span className="eyebrow">MIX E MASTER</span><h1>Diamo forma al tuo brano.</h1><p className="muted">Mix 100 €, master 40 €, mix + master 120 € per un brano. Prenota anche a distanza: ricevi subito la conferma. Consegna e revisioni vengono concordate prima dell’avvio.</p></div><GenksEmblem /></div>
    {q.success && <p className="notice success" role="status">Prenotazione {q.success} confermata. Riceverai il riepilogo via email; invio file e consegna si organizzano prima dell’avvio.</p>}
    {q.error && <p className="notice error" role="alert">{q.error === "limit" ? "Hai già inviato diverse richieste. Attendi un’ora prima di riprovare." : q.error === "save" ? "Non è stato possibile salvare la richiesta. Riprova tra poco." : q.error === "setup" ? "Le richieste sono temporaneamente non disponibili. Contatta GENKS." : "Controlla i campi: nome di almeno 2 caratteri, email valida e descrizione di almeno 10 caratteri."}</p>}
    <StudioPaymentNotice />
    <ProjectRequestForm initialService={service} />
  </div>;
}
