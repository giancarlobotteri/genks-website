"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck } from "lucide-react";

export function ReservationSuccess({ reference, project = false, paid = false }: { reference: string; project?: boolean; paid?: boolean }) {
  const router = useRouter();
  useEffect(() => {
    const timer = window.setTimeout(() => router.replace("/"), 6000);
    return () => window.clearTimeout(timer);
  }, [router]);

  return <div className="portal-shell narrow-shell service-portal">
    <section className="admin-form-card reservation-success-card" aria-labelledby="reservation-success-title" style={{ textAlign: "center", padding: "clamp(28px, 6vw, 64px)", borderRadius: 32 }}>
      <CircleCheck size={64} aria-hidden="true" style={{ color: "#4da3ff", margin: "0 auto 24px" }} />
      <span className="eyebrow">{paid ? "PAGAMENTO CONFERMATO" : "PRENOTAZIONE CONFERMATA"}</span>
      <h1 id="reservation-success-title">{paid ? "Il pagamento è andato a buon fine." : "La prenotazione è andata a buon fine."}</h1>
      <p>Grazie per aver scelto GENKS. La tua prenotazione è confermata.</p>
      <p>Riferimento: <strong>{reference}</strong></p>
      <p>{project ? "Riceverai via email le condizioni accettate e i prossimi passi per inviare i file. Per tempi e revisioni fa fede il riepilogo del tuo ordine." : "Il riepilogo e i collegamenti al calendario ti arriveranno via email."}</p>
      {!paid && <p>Il pagamento avviene in contanti presso lo studio. Nessun addebito online.</p>}
      <p className="muted">Tra pochi secondi tornerai automaticamente alla home.</p>
      <Link className="button button-primary" href="/" replace>Torna subito alla home</Link>
    </section>
  </div>;
}
