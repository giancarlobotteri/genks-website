import type { Metadata } from "next";
import Image from "next/image";
import { BeatCatalog } from "@/components/beats/beat-catalog";
import { beatRepository } from "@/lib/repositories/beats";

export const metadata: Metadata = {
  title: "Beat store",
  description:
    "Explore the GENKS beat collection, compare licenses and find the right sound for your next release.",
};

export default async function BeatStorePage() {
  const beats = await beatRepository.listPublished();
  return (
    <div className="store-page container">
      <div className="store-heading">
        <div className="store-heading-stage">
          <Image className="store-heading-logo" src="/brand/genks-logo.jpeg" width={620} height={620} alt="" aria-hidden="true" priority />
          <div className="store-heading-copy">
            <span className="eyebrow">GENKS / BEAT STORE</span>
            <h1 className="store-frequency-title">
              Find your
              <br />
              <span className="chrome-text">frequency.</span>
            </h1>
          </div>
        </div>
        <p>A different mood for every story. Start yours here.</p>
        <p className="catalog-disclaimer">
          <span className="demo-badge">GENKS</span>Choose a beat, compare the
          available licenses and continue to secure checkout.
        </p>
      </div>
      <BeatCatalog beats={beats} />
    </div>
  );
}
