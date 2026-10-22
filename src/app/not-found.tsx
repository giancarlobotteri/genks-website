import { BEATS_ENABLED } from "@/config/features";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export default function NotFound() {
  return (
    <div className="not-found container">
      <span className="eyebrow">404 / FUORI FREQUENZA</span>
      <h1>Segnale perso.</h1>
      <p>Questa pagina non esiste. Il tuo prossimo suono ti aspetta.</p>
      <Link className="button button-primary" href={BEATS_ENABLED ? "/beats" : "/services"}>
        {BEATS_ENABLED ? "Esplora i beat" : "Scegli il servizio"} <ArrowUpRight size={18} />
      </Link>
    </div>
  );
}
