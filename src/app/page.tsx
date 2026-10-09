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
      <section id="catalog" className="catalog-section container section">
        <SectionHeading
          index="02"
          eyebrow="THE COLLECTION"
          title="Find your next beat."
        >
          <p>
            Listen first. Choose your license when you find your sound.
            <br />
            <span className="muted">No account needed to browse or checkout.</span>
          </p>
        </SectionHeading>
        <BeatCatalog beats={beats} />
      </section>
      <FeaturedBeats beats={beats} />
      <AnnouncementTicker />
      <section className="container section purchase-guide" aria-labelledby="purchase-guide-title">
        <h2 id="purchase-guide-title">From first listen to your next release.</h2>
        <div className="purchase-guide-grid">
          <article><span>01</span><h3>Find your sound</h3><p>Explore the catalog by genre, mood and BPM. Listen before you choose.</p></article>
          <article><span>02</span><h3>Choose your license</h3><p>Compare the included files and terms. The selected license determines what you can do with your beat.</p></article>
          <article><span>03</span><h3>Checkout &amp; download</h3><p>Pay securely via Stripe. After payment confirmation, access the available files in your Library using your purchase email.</p></article>
        </div>
      </section>
      <Services />
      <About />
    </>
  );
}
