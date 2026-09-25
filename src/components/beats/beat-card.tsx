"use client";

import Image from "next/image";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/features/cart/cart-provider";
import { usePlayer } from "@/features/player/player-provider";
import { PlayButton } from "./play-button";
import { FavoriteButton } from "./favorite-button";
import { LicenseButton } from "./license-button";
import type { Beat } from "@/types/domain";

export function BeatCard({
  beat,
  queue,
  index,
}: {
  beat: Beat;
  queue: Beat[];
  index: number;
}) {
  const { currentBeat, isPlaying } = usePlayer();
  const { add } = useCart();
  const playing = currentBeat?.id === beat.id && isPlaying;
  return (
    <article className={`beat-card ${playing ? "is-playing" : ""}`} data-reveal>
      <div className="beat-artwork">
        <Image
          src={beat.cover}
          alt={`${beat.title} cover artwork`}
          fill
          sizes="(max-width: 600px) 85vw, (max-width: 1000px) 44vw, 30vw"
          style={{ objectPosition: beat.coverPosition }}
        />
        <div className="artwork-vignette" />
        <span className="artwork-index mono">G / 00{index + 1}</span>
        <FavoriteButton beat={beat} />
        <span className="artwork-genre">
          {beat.genre} <span>/</span> {beat.mood}
        </span>
        <PlayButton beat={beat} queue={queue} className="artwork-play" />
        {playing && (
          <span className="playing-label">
            <span className="equalizer" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
            NOW PLAYING
          </span>
        )}
      </div>
      <div className="beat-card-info">
        <div>
          <h3>{beat.title}</h3>
          <span className="beat-meta">
            {beat.bpm} BPM <span>·</span> {beat.key}
          </span>
        </div>
        <div className="beat-card-actions">
          <button type="button" className="cart-add-button" aria-label={`Add ${beat.title} to cart`} onClick={(event) => add(beat, event.currentTarget.getBoundingClientRect())}>
            <ShoppingBag size={17} /><span>Add</span>
          </button>
          <LicenseButton beat={beat} compact />
        </div>
      </div>
    </article>
  );
}
