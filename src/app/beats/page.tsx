import type { Metadata } from "next";
import {GenksEmblem} from "@/components/brand/genks-emblem";
import { BeatCatalog } from "@/components/beats/beat-catalog";
import { beatRepository } from "@/lib/repositories/beats";
import { studioCashOnly } from "@/lib/studio-payment-mode";
import { PurchaseHelp } from "@/components/commerce/purchase-help";

export const metadata: Metadata = {
  title: "Negozio di beat",
  alternates: { canonical: "/beats" },
  description:
    "Esplora i beat GENKS, confronta le licenze e trova il suono giusto per la tua prossima uscita.",
};

export default async function BeatStorePage() {
  const beats = await beatRepository.listPublished();
  return (
    <div className="store-page container">
      <div className="store-heading funnel-store-heading">
        <div className="store-heading-stage">
          <GenksEmblem />
          <div className="store-heading-copy">
            <span className="eyebrow">GENKS / NEGOZIO DI BEAT</span>
            <h1 className="store-frequency-title">
              Scegli il tuo <span className="chrome-text">beat.</span>
            </h1>
          </div>
        </div>
        <p className="catalog-disclaimer">
          <span className="demo-badge">GENKS</span>{studioCashOnly ? "Scegli il beat e la licenza. Pagamento in contanti presso lo studio." : "Scegli un beat e confronta le licenze disponibili."}
        </p>
      </div>
      <BeatCatalog beats={beats} />
      <PurchaseHelp compact />
    </div>
  );
}
