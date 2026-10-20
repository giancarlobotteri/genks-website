import { CinematicHero } from "@/components/home/cinematic-hero";
import { CinematicHome } from "@/components/home/cinematic-home";
import { BeatCatalog } from "@/components/beats/beat-catalog";
import { SectionHeading } from "@/components/ui/section-heading";
import { Services } from "@/components/home/services";
import { AnnouncementTicker } from "@/components/home/announcement-ticker";
import { beatRepository } from "@/lib/repositories/beats";
import { StudioPaymentNotice } from "@/components/services/studio-payment-notice";
import { studioCashOnly } from "@/lib/studio-payment-mode";
import { PurchaseHelp } from "@/components/commerce/purchase-help";
import type { Metadata } from "next";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function Home() {
  const beats = await beatRepository.listPublished();
  return (
    <CinematicHome>
      <CinematicHero />
      <section id="collection" className="catalog-section">
      <AnnouncementTicker />
      <div className="container"><StudioPaymentNotice /></div>
      <section className="container section purchase-guide" aria-labelledby="purchase-guide-title">
        <h2 id="purchase-guide-title">Dal primo ascolto alla tua prossima uscita.</h2>
        <div className="purchase-guide-grid">
          <article><span>01</span><h3>Trova il tuo suono</h3><p>Esplora il catalogo per genere, atmosfera e BPM. Ascolta prima di scegliere.</p></article>
          <article><span>02</span><h3>Scegli la tua licenza</h3><p>Confronta file inclusi e condizioni. La licenza scelta definisce come puoi utilizzare il beat.</p></article>
          <article><span>03</span><h3>{studioCashOnly ? "Concorda e passa in studio" : "Acquista e scarica"}</h3><p>{studioCashOnly ? "Richiedi il beat o il servizio. Concordiamo prezzo, licenza e consegna; il pagamento avviene in contanti presso lo studio." : "Dopo il pagamento confermato, accedi ai file disponibili nella raccolta con la tua email."}</p></article>
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
            <span className="muted">{studioCashOnly ? "Beat e produzioni su richiesta. Concordiamo insieme licenza, prezzo e consegna in studio." : "Esplora e acquista liberamente. Ritrova i file nella tua raccolta."}</span>
          </p>
        </SectionHeading>
        <BeatCatalog beats={beats} />
        <PurchaseHelp compact />
      </section>


      </section>
      <Services />
    </CinematicHome>
  );
}
