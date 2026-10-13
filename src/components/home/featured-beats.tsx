import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { BeatCard } from "@/components/beats/beat-card";
import { SectionHeading } from "@/components/ui/section-heading";
import type { Beat } from "@/types/domain";

export function FeaturedBeats({ beats }: { beats: Beat[] }) {
  const featured = beats.filter((beat) => beat.featured);
  return (
    <section className="featured-section container section" id="featured">
      <SectionHeading
        index="01"
        eyebrow="SUONI SELEZIONATI"
        title="In primo piano."
      >
        <Link className="text-link" href="/beats">
          Tutti i beat <ArrowUpRight size={18} />
        </Link>
      </SectionHeading>
      <div className="featured-grid">
        {featured.map((beat, index) => (
          <BeatCard key={beat.id} beat={beat} queue={featured} index={index} />
        ))}
      </div>
      <p className="catalog-disclaimer">
        <span className="demo-badge">GENKS</span>Esplora il catalogo e scegli la licenza adatta alla tua uscita.
      </p>
    </section>
  );
}
