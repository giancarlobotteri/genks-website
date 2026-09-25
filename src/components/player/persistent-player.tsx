"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import {
  ListMusic,
  LoaderCircle,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  usePlayer,
  usePlayerActions,
  usePlayerProgress,
} from "@/features/player/player-provider";
import { useLicenses } from "@/features/licenses/license-provider";
import { formatTime } from "@/lib/format";
import { Modal } from "@/components/ui/modal";

export function PersistentPlayer() {
  const { currentBeat, isPlaying, isLoading, error, queue } = usePlayer();
  const { currentTime, duration, volume } = usePlayerProgress();
  const { toggle, next, previous, seek, setVolume, playBeat } =
    usePlayerActions();
  const { openLicenses } = useLicenses();
  const [queueOpen, setQueueOpen] = useState(false);
  const lastVolume = useRef(0.7);
  const queueTitle = useId();
  const percent =
    duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;

  useEffect(() => {
    document.documentElement.toggleAttribute("data-playing", isPlaying);
    return () => document.documentElement.removeAttribute("data-playing");
  }, [isPlaying]);

  if (!currentBeat || (!isPlaying && !isLoading)) return null;

  return (
    <>
      <aside
        className={`persistent-player ${isPlaying ? "is-playing" : ""}`}
        aria-label="Music player"
      >
        {error && (
          <p className="player-error" role="alert">
            {error}
          </p>
        )}
        <div className="player-content">
          <div className="player-track">
            <div className="player-cover">
              <Image
                src={currentBeat?.cover ?? "/icon.svg"}
                alt=""
                width={52}
                height={52}
              />
            </div>
            <div className="player-track-copy">
              <strong>{currentBeat?.title ?? "Your next sound."}</strong>
              <span>
                {currentBeat
                  ? `${currentBeat.bpm} BPM · ${currentBeat.key} · Demo`
                  : "Choose a beat. Press play."}
              </span>
            </div>
          </div>
          <div className="player-transport">
            <button
              type="button"
              className="icon-button player-previous"
              aria-label="Previous beat"
              onClick={previous}
              disabled={!queue.length}
            >
              <SkipBack size={18} fill="currentColor" />
            </button>
            <button
              type="button"
              className="player-main-play"
              aria-label={isPlaying ? "Pause playback" : "Start playback"}
              onClick={toggle}
              disabled={!queue.length}
            >
              {isLoading ? (
                <LoaderCircle className="spinner" size={20} />
              ) : isPlaying ? (
                <Pause size={20} fill="currentColor" />
              ) : (
                <Play size={20} fill="currentColor" />
              )}
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Next beat"
              onClick={next}
              disabled={!queue.length}
            >
              <SkipForward size={18} fill="currentColor" />
            </button>
          </div>
          <div className="player-progress">
            <span className="mono">{formatTime(currentTime)}</span>
            <div className="progress-rail">
              <div className="progress-fill" style={{ width: `${percent}%` }} />
              <input
                type="range"
                aria-label="Preview progress"
                aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
                min={0}
                max={duration || 1}
                step={0.1}
                value={Math.min(currentTime, duration || 1)}
                disabled={!duration}
                onChange={(event) => seek(Number(event.target.value))}
              />
            </div>
            <span className="mono">{formatTime(duration)}</span>
          </div>
          <div className="player-options">
            <div className="volume-control">
              <button
                type="button"
                className="icon-button"
                aria-label={volume ? "Mute" : "Unmute"}
                onClick={() => {
                  if (volume > 0) {
                    lastVolume.current = volume;
                    setVolume(0);
                  } else setVolume(lastVolume.current || 0.7);
                }}
              >
                {volume ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </button>
              <input
                aria-label="Volume"
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(event) => setVolume(Number(event.target.value))}
              />
            </div>
            <button
              type="button"
              className="icon-button queue-button"
              aria-label="Open play queue"
              onClick={() => setQueueOpen(true)}
            >
              <ListMusic size={20} />
            </button>
            <button
              type="button"
              className="player-license"
              onClick={() => currentBeat && openLicenses(currentBeat)}
              disabled={!currentBeat}
            >
              LICENSE <span aria-hidden="true">↗</span>
            </button>
          </div>
        </div>
      </aside>
      <Modal
        open={queueOpen}
        onClose={() => setQueueOpen(false)}
        titleId={queueTitle}
      >
        <span className="eyebrow">KEEP IT PLAYING</span>
        <h2 id={queueTitle}>In the queue.</h2>
        <p className="muted">
          Your current selection · {queue.length} beats
        </p>
        <div className="queue-list">
          {queue.map((beat, index) => (
            <button
              key={beat.id}
              type="button"
              className={`queue-track ${beat.id === currentBeat?.id ? "active" : ""}`}
              aria-label={`${beat.id === currentBeat?.id && isPlaying ? "Pause" : "Play"} ${beat.title} from queue`}
              onClick={() => playBeat(beat)}
            >
              <span className="mono">{String(index + 1).padStart(2, "0")}</span>
              <Image src={beat.cover} width={46} height={46} alt="" />
              <span>
                <strong>{beat.title}</strong>
                <small>
                  {beat.genre} · {beat.bpm} BPM
                </small>
              </span>
              {beat.id === currentBeat?.id && isPlaying ? (
                <Pause size={18} />
              ) : (
                <Play size={18} />
              )}
            </button>
          ))}
        </div>
      </Modal>
    </>
  );
}
