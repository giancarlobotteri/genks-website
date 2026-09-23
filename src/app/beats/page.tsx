import type { Metadata } from "next";
import { BeatCatalog } from "@/components/beats/beat-catalog";
import { beatRepository } from "@/lib/repositories/beats";

export const metadata: Metadata = {
  title: "Beat store",
  description:
    "Explore the GENKS demo beat collection. Filter by genre, mood, tempo and key, and find your next sound.",
};

export default async function BeatStorePage() {
  const beats = await beatRepository.listPublished();
  return (
    <div className="store-page container">
      <div className="store-heading">
        <span className="eyebrow">GENKS / BEAT STORE</span>
        <h1>
          Find your
          <br />
          <span className="chrome-text">frequency.</span>
        </h1>
        <p>A different mood for every story. Start yours here.</p>
        <p className="catalog-disclaimer">
          <span className="demo-badge">DEMO</span>Fictional catalog ·
          Synthesized previews · Example prices
        </p>
      </div>
      <BeatCatalog beats={beats} />
    </div>
  );
}
