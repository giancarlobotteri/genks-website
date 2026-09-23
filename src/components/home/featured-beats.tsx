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
        eyebrow="SELECTED SOUNDS"
        title="In the rotation."
      >
        <Link className="text-link" href="/beats">
          All beats <ArrowUpRight size={18} />
        </Link>
      </SectionHeading>
      <div className="featured-grid">
        {featured.map((beat, index) => (
          <BeatCard key={beat.id} beat={beat} queue={featured} index={index} />
        ))}
      </div>
      <p className="catalog-disclaimer">
        <span className="demo-badge">GENKS</span>Explore the catalog and choose
        the license that fits your release.
      </p>
    </section>
  );
}
