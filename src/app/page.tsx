import { CinematicHero } from "@/components/home/cinematic-hero";
import { CinematicHome } from "@/components/home/cinematic-home";
import { BeatCatalog } from "@/components/beats/beat-catalog";
import { SectionHeading } from "@/components/ui/section-heading";
import { Services } from "@/components/home/services";
import { AnnouncementTicker } from "@/components/home/announcement-ticker";
import { beatRepository } from "@/lib/repositories/beats";

export default async function Home() {
  const beats = await beatRepository.listPublished();
  return (
    <CinematicHome>
      <CinematicHero />
      <section id="collection" className="catalog-section">
      <AnnouncementTicker />
      <section className="container section purchase-guide" aria-labelledby="purchase-guide-title">
        <h2 id="purchase-guide-title">Dal primo ascolto alla tua prossima uscita.</h2>
        <div className="purchase-guide-grid">
          <article><span>01</span><h3>Trova il tuo suono</h3><p>Esplora il catalogo per genere, atmosfera e BPM. Ascolta prima di scegliere.</p></article>
          <article><span>02</span><h3>Scegli la tua licenza</h3><p>Confronta file inclusi e condizioni. La licenza scelta definisce come puoi utilizzare il beat.</p></article>
          <article><span>03</span><h3>Acquista e scarica</h3><p>Paga in sicurezza con Stripe. Dopo la conferma, accedi ai file disponibili nella tua raccolta con l’email usata per l’acquisto.</p></article>
        </div>
      </section>
      <section id="catalog" className="container section">
        <SectionHeading
          index="02"
          eyebrow="IL CATALOGO"
          title="Trova il tuo prossimo beat."
        >
          <p>
            Ascolta prima. Scegli la licenza quando trovi il suono che cerchi.
            <br />
            <span className="muted">Esplora e acquista liberamente. Per ritrovare i file, accedi alla raccolta con l’email usata per pagare.</span>
          </p>
        </SectionHeading>
        <BeatCatalog beats={beats} />
      </section>


      </section>
      <Services />
    </CinematicHome>
  );
}
