/**
 * Camera "shots" for everything the user does inside a service: each choice, field group,
 * upload or confirmation asks the studio camera for its own framing.
 * Panels only *name* a shot; StudioStage turns names into camera moves.
 */
import { useEffect, useRef } from "react";

let sub: string | null = null;
let dive = 0;
const subs = new Set<() => void>();
const emit = () => subs.forEach(f => f());

export const getSubShot = () => sub;
export function setSubShot(id: string | null) {
  if (id === sub) return;
  sub = id;
  emit();
}
export const onShot = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

/** 0..1: how far the camera dives into the mixer display (used by the Beat Store transition). */
export const getDive = () => dive;
export const setDive = (v: number) => { dive = v; };

/**
 * Props for a block of a panel: when the user points at it, focuses a field inside it,
 * or scrolls it into the middle of the panel, the camera moves to `shot`.
 */
export function useShotZone<T extends HTMLElement>(shot: string) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = el.closest("dialog") ?? null;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setSubShot(shot); }, { root: root?.querySelector("[data-sheet-body]") ?? null, rootMargin: "-45% 0px -45% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [shot]);
  return { ref, onFocusCapture: () => setSubShot(shot), onPointerDownCapture: () => setSubShot(shot) };
}

/** Ask for a shot as soon as a block appears (e.g. a confirmation). */
export function useShotOnMount(shot: string) {
  useEffect(() => { setSubShot(shot); }, [shot]);
}
