"use client";

import Image from "next/image";
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
  const playing = currentBeat?.id === beat.id && isPlaying;
  return (
    <article className={`beat-card ${playing ? "is-playing" : ""}`} data-reveal>
      <div className="beat-artwork">
        <Image
          src={beat.cover}
          alt={`${beat.title} demo cover artwork`}
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
        <LicenseButton beat={beat} compact />
      </div>
    </article>
  );
}
