"use client";

import { useEffect } from "react";

// Interface deterrent only. Paid audio files are protected by server authorization.
export function AssetGuard() {
  useEffect(() => {
    const guard = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && target.closest("img, canvas, video, audio, [data-protected-visual]")) event.preventDefault();
    };
    document.addEventListener("dragstart", guard, true);
    document.addEventListener("contextmenu", guard, true);
    return () => {
      document.removeEventListener("dragstart", guard, true);
      document.removeEventListener("contextmenu", guard, true);
    };
  }, []);
  return null;
}
