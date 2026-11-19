// Domain types of the GENKS studio site: catalogue, licences, services, packages and requests.
// Prices are those of prodbygenks.com (see data/fixtures.ts).

export type PublishState = "published" | "example" | "hidden";

export type LicenseTier = {
  id: string;
  name: string;
  /** Price in euro cents. `null` = on request (never sold automatically). */
  price: number | null;
  format: string;
  includes: string[];
  limits: string[];
};

export type BeatStyle = "trap" | "drill" | "rnb" | "boombap" | "afro" | "lofi";

export type Beat = {
  id: string;
  title: string;
  genre: string;
  mood: string[];
  bpm: number;
  key: string;
  description: string;
  /** Licence ids available for this beat. */
  licenses: string[];
  /** Synth recipe used to render the original preview in the browser. */
  style: BeatStyle;
  seed: number;
  /** Cover palette hue offset (0–40) — stays inside the blue brand range. */
  hue: number;
  status: PublishState;
  createdAt: string;
};

export type RecordingPackage = {
  id: string;
  name: string;
  hours: number;
  price: number | null;
  description: string;
  includes: string[];
};

export type MixService = {
  id: "mix" | "master" | "mixmaster";
  name: string;
  summary: string;
  price: number | null;
  priceNote: string;
  turnaround: string;
  revisions: string;
  includes: string[];
  needs: string;
};

export type Bundle = {
  id: string;
  name: string;
  summary: string;
  includes: string[];
  limits: string[];
  /** Bundle price; `null` hides price and saving. */
  price: number | null;
  /** Sum of list prices of the included items; saving shown only if both are set. */
  listValue: number | null;
  status: PublishState;
};

export type CustomBeatConfig = {
  turnaround: string;
  revisions: string;
  priceFrom: number | null;
  steps: { title: string; text: string }[];
};

export type StudioContent = {
  version: 1;
  beats: Beat[];
  licenses: LicenseTier[];
  recording: RecordingPackage[];
  mix: MixService[];
  bundles: Bundle[];
  customBeat: CustomBeatConfig;
};

export type CartItem = { beatId: string; licenseId: string };

export type DemoRequestKind = "booking" | "remote-project" | "custom-beat" | "bundle" | "exclusive" | "order";

export type DemoRequest = {
  id: string;
  kind: DemoRequestKind;
  createdAt: string;
  summary: string;
  data: Record<string, string>;
};
