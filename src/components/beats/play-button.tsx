"use client";

import { LoaderCircle, Pause, Play } from "lucide-react";
import { usePlayer, usePlayerActions } from "@/features/player/player-provider";
import type { Beat } from "@/types/domain";

export function PlayButton({
  beat,
  queue,
  className = "",
}: {
  beat: Beat;
  queue?: Beat[];
  className?: string;
}) {
  const { currentBeat, isPlaying, isLoading } = usePlayer();
  const { playBeat } = usePlayerActions();
  const active = currentBeat?.id === beat.id;
  const unavailable = !beat.previewUrl;
  return (
    <button
      type="button"
      className={`play-button ${className} ${active && isPlaying ? "is-playing" : ""}`}
      aria-label={unavailable ? `${beat.title} preview coming soon` : `${active && isPlaying ? "Pause" : "Play"} ${beat.title}`}
      aria-pressed={active && isPlaying}
      disabled={unavailable}
      onClick={() => !unavailable && playBeat(beat, queue)}
    >
      {active && isLoading ? (
        <LoaderCircle className="spinner" size={21} />
      ) : active && isPlaying ? (
        <Pause size={21} fill="currentColor" />
      ) : (
        <Play size={21} fill="currentColor" />
      )}
    </button>
  );
}
