export type BeatGenre = "Trap" | "R&B" | "Afro" | "Reggae" | "Pop" | "Rap/HipHop" | "Experimental" | "Drill";
export type BeatMood = "Dark" | "Floating" | "Melodic" | "Hard";
export type LicenseTier = "mp3" | "wav" | "stems" | "exclusive";
export type PublicationStatus = "draft" | "published" | "archived";

export interface DownloadableAsset {
  id: string;
  kind: "mp3" | "wav" | "stems" | "license";
  filename: string;
  /** Private storage key; resolve to an authorized, expiring URL on the server. */
  storageKey: string;
}

export interface Beat {
  id: string;
  slug: string;
  title: string;
  cover: string;
  coverPosition?: string;
  previewUrl: string;
  bpm: number;
  key: string;
  genre: BeatGenre;
  mood: BeatMood;
  description: string;
  featured: boolean;
  status: PublicationStatus;
  licenseIds: LicenseTier[];
  assets: DownloadableAsset[];
  isDemo: boolean;
}

export interface License {
  id: LicenseTier;
  name: string;
  priceCents: number;
  currency: "EUR";
  format: string;
  features: string[];
  isDemo: boolean;
}

export interface OrderItem {
  beatId: string;
  title: string;
  licenseId: LicenseTier;
  unitPriceCents: number;
  /** Immutable license terms at the time of purchase. */
  licenseSnapshot: License;
}

export interface Order {
  id: string;
  customerId: string;
  items: OrderItem[];
  totalCents: number;
  currency: "EUR";
  status: "pending" | "paid" | "refunded" | "cancelled";
  createdAt: string;
}

export interface Customer {
  id: string;
  displayName: string;
  email: string;
}

export interface WishlistItem {
  beatId: string;
  addedAt: string;
}
export interface Service {
  id: string;
  title: string;
  description: string;
  number: string;
}
export interface PlayerState {
  currentBeat: Beat | null;
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
  queue: Beat[];
}

export interface PlaybackProgress {
  currentTime: number;
  duration: number;
  volume: number;
}
