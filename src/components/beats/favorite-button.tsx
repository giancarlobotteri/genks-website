"use client";

import { Heart } from "lucide-react";
import { useWishlist } from "@/features/wishlist/use-wishlist";
import type { Beat } from "@/types/domain";

export function FavoriteButton({ beat }: { beat: Beat }) {
  const { favorites, toggleFavorite } = useWishlist();
  const saved = favorites.includes(beat.id);
  return (
    <button
      type="button"
      className={`icon-button favorite-button ${saved ? "is-favorite" : ""}`}
      aria-label={`${saved ? "Unsave" : "Save"} ${beat.title}`}
      aria-pressed={saved}
      onClick={() => toggleFavorite(beat.id)}
    >
      <Heart size={18} fill={saved ? "currentColor" : "none"} />
    </button>
  );
}
