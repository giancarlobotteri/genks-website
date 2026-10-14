import { ProjectRequestForm } from "@/components/services/project-request-form";
import { GenksEmblem } from "@/components/brand/genks-emblem";

export default async function ProjectPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const service = typeof q.service === "string" && ["mix", "master", "mix_master"].includes(q.service) ? q.service : "mix_master";
  return <div className="portal-shell narrow-shell service-portal">
    <div className="service-page-heading"><div><span className="eyebrow">MIX E MASTER</span><h1>Diamo forma al tuo brano.</h1><p className="muted">Pochi dettagli per iniziare. Riceverai un preventivo e le istruzioni per inviare i file dopo l’accettazione della richiesta.</p></div><GenksEmblem /></div>
    {q.success && <p className="notice success" role="status">Progetto {q.success} ricevuto. Ti risponderemo via email.</p>}
    {q.error && <p className="notice error" role="alert">Controlla i dati e riprova.</p>}
    <ProjectRequestForm initialService={service} />
  </div>;
}
