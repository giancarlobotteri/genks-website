import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export default function NotFound() {
  return (
    <div className="not-found container">
      <span className="eyebrow">404 / FUORI FREQUENZA</span>
      <h1>Segnale perso.</h1>
      <p>Questa pagina non esiste. Il tuo prossimo suono ti aspetta.</p>
      <Link className="button button-primary" href="/beats">
        Esplora i beat <ArrowUpRight size={18} />
      </Link>
    </div>
  );
}
