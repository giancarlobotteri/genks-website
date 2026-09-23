import type { License } from "@/types/domain";

/** Initial public prices; Admin remains the source of truth once Supabase is connected. */
export const mockLicenses: License[] = [
  {
    id: "mp3",
    name: "MP3 lease",
    priceCents: 2900,
    currency: "EUR",
    format: "MP3",
    features: [
      "High-quality MP3",
      "Non-exclusive license",
      "Example terms — to be confirmed",
    ],
    isDemo: false,
  },
  {
    id: "wav",
    name: "WAV lease",
    priceCents: 4900,
    currency: "EUR",
    format: "MP3 + WAV",
    features: [
      "Uncompressed WAV + MP3",
      "Non-exclusive license",
      "Example terms — to be confirmed",
    ],
    isDemo: false,
  },
  {
    id: "stems",
    name: "Trackout lease",
    priceCents: 9900,
    currency: "EUR",
    format: "MP3 + WAV + STEMS",
    features: [
      "Individual track stems",
      "WAV + MP3 included",
      "Example terms — to be confirmed",
    ],
    isDemo: false,
  },
];
