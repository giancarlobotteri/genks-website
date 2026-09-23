"use client";

import { useSyncExternalStore } from "react";

const storageKey = "genks:wishlist:v1";
const changeEvent = "genks:wishlist-change";
const empty: string[] = [];
let cachedRaw: string | null = null;
let cachedIds: string[] = empty;
let memoryOnly = false;

function getSnapshot(): string[] {
  try {
    if (memoryOnly) return cachedIds;
    const raw = window.localStorage.getItem(storageKey) ?? "[]";
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      const parsed: unknown = JSON.parse(raw);
      cachedIds = Array.isArray(parsed)
        ? [
            ...new Set(
              parsed.filter((id): id is string => typeof id === "string"),
            ),
          ]
        : empty;
    }
  } catch {
    /* Storage can be disabled. Keep this tab's in-memory selection. */
  }
  return cachedIds;
}

function subscribe(onChange: () => void) {
  const storageChanged = (event: StorageEvent) => {
    if (event.key === storageKey || event.key === null) onChange();
  };
  window.addEventListener("storage", storageChanged);
  window.addEventListener(changeEvent, onChange);
  return () => {
    window.removeEventListener("storage", storageChanged);
    window.removeEventListener(changeEvent, onChange);
  };
}

function toggleFavorite(id: string) {
  const current = getSnapshot();
  cachedIds = current.includes(id)
    ? current.filter((value) => value !== id)
    : [...current, id];
  cachedRaw = JSON.stringify(cachedIds);
  try {
    window.localStorage.setItem(storageKey, cachedRaw);
  } catch {
    memoryOnly = true;
  }
  window.dispatchEvent(new Event(changeEvent));
}

export function useWishlist() {
  const favorites = useSyncExternalStore(subscribe, getSnapshot, () => empty);
  return { favorites, toggleFavorite };
}
