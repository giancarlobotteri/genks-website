"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { useWishlist } from "@/features/wishlist/use-wishlist";
import type { Beat } from "@/types/domain";

export function FavoriteButton({ beat }: { beat: Beat }) {
  const { favorites, toggleFavorite } = useWishlist();
  const saved = favorites.includes(beat.id);
  const [celebrating, setCelebrating] = useState(false);

  useEffect(() => {
    if (!celebrating) return;
    const timer = window.setTimeout(() => setCelebrating(false), 980);
    return () => window.clearTimeout(timer);
  }, [celebrating]);

  const handleFavorite = () => {
    if (!saved) setCelebrating(true);
    toggleFavorite(beat.id);
  };

  return (
    <button
      type="button"
      className={`icon-button favorite-button ${saved ? "is-favorite" : ""} ${celebrating ? "is-celebrating" : ""}`}
      aria-label={`${saved ? "Unsave" : "Save"} ${beat.title}`}
      aria-pressed={saved}
      onClick={handleFavorite}
    >
      <span className="favorite-heart-icon"><Heart size={18} fill={saved ? "currentColor" : "none"} /></span>
      {celebrating ? <span className="favorite-burst" aria-hidden="true">
        <i>♥</i><i>✦</i><i>♥</i><i>✦</i><i>♥</i><i>✦</i>
      </span> : null}
    </button>
  );
}
