import { Hero } from "@/components/home/hero";
import { FeaturedBeats } from "@/components/home/featured-beats";
import { BeatCatalog } from "@/components/beats/beat-catalog";
import { SectionHeading } from "@/components/ui/section-heading";
import { Services } from "@/components/home/services";
import { About } from "@/components/home/about";
import { AnnouncementTicker } from "@/components/home/announcement-ticker";
import { beatRepository } from "@/lib/repositories/beats";

export default async function Home() {
  const beats = await beatRepository.listPublished();
  return (
    <>
      <Hero />
      <AnnouncementTicker />
      <FeaturedBeats beats={beats} />
      <section id="catalog" className="catalog-section container section">
        <SectionHeading
          index="02"
          eyebrow="THE COLLECTION"
          title="Find your frequency."
        >
          <p>
            Different moods. One instinct.
            <br />
            <span className="muted">Press play and follow it.</span>
          </p>
        </SectionHeading>
        <BeatCatalog beats={beats} />
      </section>
      <Services />
      <About />
    </>
  );
}
