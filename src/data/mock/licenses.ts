import type { License } from "@/types/domain";

/** UI examples only: these are not binding commercial terms or production prices. */
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
    isDemo: true,
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
    isDemo: true,
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
    isDemo: true,
  },
];
