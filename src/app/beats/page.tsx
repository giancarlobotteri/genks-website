import type { Metadata } from "next";
import Image from "next/image";
import { BeatCatalog } from "@/components/beats/beat-catalog";
import { beatRepository } from "@/lib/repositories/beats";

export const metadata: Metadata = {
  title: "Negozio di beat",
  description:
    "Esplora i beat GENKS, confronta le licenze e trova il suono giusto per la tua prossima uscita.",
};

export default async function BeatStorePage() {
  const beats = await beatRepository.listPublished();
  return (
    <div className="store-page container">
      <div className="store-heading">
        <div className="store-heading-stage">
          <Image className="store-heading-logo" src="/brand/genks-logo.jpeg" width={620} height={620} alt="" aria-hidden="true" priority />
          <div className="store-heading-copy">
            <span className="eyebrow">GENKS / NEGOZIO DI BEAT</span>
            <h1 className="store-frequency-title">
              Trova la tua
              <br />
              <span className="chrome-text">frequenza.</span>
            </h1>
          </div>
        </div>
        <p>Un’atmosfera per ogni storia. Inizia la tua qui.</p>
        <p className="catalog-disclaimer">
          <span className="demo-badge">GENKS</span>Scegli un beat, confronta le licenze disponibili e prosegui al pagamento sicuro.
        </p>
      </div>
      <BeatCatalog beats={beats} />
    </div>
  );
}
