import { Hero } from "@/components/home/hero";
import { FeaturedBeats } from "@/components/home/featured-beats";
import { BeatCatalog } from "@/components/beats/beat-catalog";
import { SectionHeading } from "@/components/ui/section-heading";
import { Services } from "@/components/home/services";
import { About } from "@/components/home/about";
import { beatRepository } from "@/lib/repositories/beats";
import { site } from "@/config/site";

export default async function Home() {
  const beats = await beatRepository.listPublished();
  return (
    <>
      <Hero beats={beats} />
      <div className="frequency-strip social-marquee" aria-label="GENKS social profiles">
        <div className="frequency-track">
          <div className="social-marquee-group">
            <a href={site.instagram} target="_blank" rel="noreferrer">
              INSTAGRAM <strong>@PRODBYGENKS</strong>
            </a>
            <i />
            <a href={site.tiktok} target="_blank" rel="noreferrer">
              TIKTOK <strong>@PRODBYGENKS</strong>
            </a>
            <i />
          </div>
          <div className="social-marquee-group" aria-hidden="true">
            <span>INSTAGRAM <strong>@PRODBYGENKS</strong></span>
            <i />
            <span>TIKTOK <strong>@PRODBYGENKS</strong></span>
            <i />
          </div>
        </div>
      </div>
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
