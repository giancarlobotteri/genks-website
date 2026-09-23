"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Beat, PlaybackProgress, PlayerState } from "@/types/domain";

interface PlayerActions {
  playBeat: (beat: Beat, queue?: Beat[]) => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
}

const StateContext = createContext<PlayerState | null>(null);
const ProgressContext = createContext<PlaybackProgress | null>(null);
const ActionsContext = createContext<PlayerActions | null>(null);

export function PlayerProvider({
  children,
  catalog,
}: {
  children: ReactNode;
  catalog: Beat[];
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const beatRef = useRef<Beat | null>(null);
  const queueRef = useRef(catalog);
  const requestRef = useRef(0);
  const [currentBeat, setCurrentBeat] = useState<Beat | null>(null);
  const [queue, setQueue] = useState(catalog);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, updateVolume] = useState(0.7);

  const start = useCallback((beat: Beat) => {
    const audio = audioRef.current;
    if (!audio || beat.status !== "published") return;
    const requestId = ++requestRef.current;
    setError(null);
    if (beatRef.current?.id !== beat.id) {
      audio.pause();
      audio.src = beat.previewUrl;
      audio.load();
      beatRef.current = beat;
      setCurrentBeat(beat);
      setCurrentTime(0);
      setDuration(0);
    } else if (audio.error) {
      audio.load();
    }
    setIsLoading(true);
    void audio.play().catch((cause: unknown) => {
      if (requestId !== requestRef.current) return;
      setIsLoading(false);
      setIsPlaying(false);
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError("This preview couldn't play. Press play to try again.");
    });
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!beatRef.current) {
      if (queueRef.current[0]) start(queueRef.current[0]);
    } else if (!audio.paused) {
      ++requestRef.current;
      audio.pause();
      setIsLoading(false);
    } else {
      start(beatRef.current);
    }
  }, [start]);

  const playBeat = useCallback(
    (beat: Beat, nextQueue?: Beat[]) => {
      if (nextQueue) {
        const published = nextQueue.filter(
          (item) => item.status === "published",
        );
        const validQueue = published.some((item) => item.id === beat.id)
          ? published
          : [beat, ...published];
        queueRef.current = validQueue;
        setQueue(validQueue);
      }
      if (beatRef.current?.id === beat.id) toggle();
      else start(beat);
    },
    [start, toggle],
  );

  const next = useCallback(() => {
    const list = queueRef.current;
    if (!list.length) return;
    const index = list.findIndex((beat) => beat.id === beatRef.current?.id);
    start(list[(index + 1) % list.length]);
  }, [start]);

  const previous = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      setCurrentTime(0);
      return;
    }
    const list = queueRef.current;
    if (!list.length) return;
    const index = list.findIndex((beat) => beat.id === beatRef.current?.id);
    start(list[(index - 1 + list.length) % list.length]);
  }, [start]);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration) || !Number.isFinite(seconds))
      return;
    audio.currentTime = Math.min(Math.max(seconds, 0), audio.duration);
    setCurrentTime(audio.currentTime);
  }, []);

  const setVolume = useCallback((value: number) => {
    const level = Number.isFinite(value)
      ? Math.min(Math.max(value, 0), 1)
      : 0.7;
    if (audioRef.current) audioRef.current.volume = level;
    updateVolume(level);
  }, []);

  const state = useMemo(
    () => ({ currentBeat, queue, isPlaying, isLoading, error }),
    [currentBeat, queue, isPlaying, isLoading, error],
  );
  const progress = useMemo(
    () => ({ currentTime, duration, volume }),
    [currentTime, duration, volume],
  );
  const actions = useMemo(
    () => ({ playBeat, toggle, next, previous, seek, setVolume }),
    [playBeat, toggle, next, previous, seek, setVolume],
  );

  return (
    <ActionsContext value={actions}>
      <StateContext value={state}>
        <ProgressContext value={progress}>
          {children}
          <audio
            ref={audioRef}
            preload="none"
            onPlay={() => {
              setIsPlaying(true);
              setError(null);
            }}
            onPlaying={() => setIsLoading(false)}
            onPause={() => {
              setIsPlaying(false);
              setIsLoading(false);
            }}
            onWaiting={() => setIsLoading(true)}
            onLoadedMetadata={(event) => {
              event.currentTarget.volume = volume;
              setDuration(
                Number.isFinite(event.currentTarget.duration)
                  ? event.currentTarget.duration
                  : 0,
              );
            }}
            onTimeUpdate={(event) =>
              setCurrentTime(event.currentTarget.currentTime)
            }
            onEnded={() => {
              setIsPlaying(false);
              const index = queueRef.current.findIndex(
                (beat) => beat.id === beatRef.current?.id,
              );
              const following = queueRef.current[index + 1];
              if (following) start(following);
            }}
            onError={() => {
              setIsLoading(false);
              setIsPlaying(false);
              setError(
                "The preview is unavailable. Try another beat or press play to retry.",
              );
            }}
          />
        </ProgressContext>
      </StateContext>
    </ActionsContext>
  );
}

export function usePlayer() {
  const value = useContext(StateContext);
  if (!value) throw new Error("PlayerProvider is required");
  return value;
}
export function usePlayerProgress() {
  const value = useContext(ProgressContext);
  if (!value) throw new Error("PlayerProvider is required");
  return value;
}
export function usePlayerActions() {
  const value = useContext(ActionsContext);
  if (!value) throw new Error("PlayerProvider is required");
  return value;
}
