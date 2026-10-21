"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck } from "lucide-react";

export function ReservationSuccess({ reference, project = false }: { reference: string; project?: boolean }) {
  const router = useRouter();
  useEffect(() => {
    const timer = window.setTimeout(() => router.replace("/"), 6000);
    return () => window.clearTimeout(timer);
  }, [router]);

  return <div className="portal-shell narrow-shell service-portal">
    <section className="admin-form-card" aria-labelledby="reservation-success-title" style={{ textAlign: "center", padding: "clamp(28px, 6vw, 64px)", borderRadius: 32 }}>
      <CircleCheck size={64} aria-hidden="true" style={{ color: "#4da3ff", margin: "0 auto 24px" }} />
      <span className="eyebrow">PRENOTAZIONE CONFERMATA</span>
      <h1 id="reservation-success-title">La prenotazione è andata a buon fine.</h1>
      <p>Grazie per aver scelto GENKS. La tua prenotazione è confermata.</p>
      <p>Riferimento: <strong>{reference}</strong></p>
      <p>{project ? "Invio file, tempi di consegna e revisioni saranno concordati prima dell’avvio." : "Il riepilogo e i collegamenti al calendario ti arriveranno via email."}</p>
      <p>Il pagamento avviene in contanti presso lo studio. Nessun addebito online.</p>
      <p className="muted">Tra pochi secondi tornerai automaticamente alla home.</p>
      <Link className="button button-primary" href="/" replace>Torna subito alla home</Link>
    </section>
  </div>;
}
