import type { Service } from "@/types/domain";

/** Editable brand copy. No invented credits, metrics or collaborations. */
export const services: Service[] = [
  {
    id: "recording",
    number: "01",
    title: "Recording session",
    description: "Request a studio date, time and duration for your next session.",
  },
  {
    id: "mix",
    number: "02",
    title: "Mix",
    description: "Send your project details and receive a tailored quote.",
  },
  {
    id: "master",
    number: "03",
    title: "Master",
    description: "Final detail, weight and translation for your release.",
  },
  {
    id: "mix-master",
    number: "04",
    title: "Mix & master",
    description: "Give your track the space, weight and detail it needs.",
  },
  {
    id: "custom-beat",
    number: "05",
    title: "Custom beat",
    description: "A beat shaped around your voice, references and direction.",
  },
];
