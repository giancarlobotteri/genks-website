import type { Service } from "@/types/domain";

/** Editable brand copy. No invented credits, metrics or collaborations. */
export const services: Service[] = [
  {
    id: "recording",
    number: "01",
    title: "Sessione di registrazione",
    description: "Richiedi data, orario e durata per la tua prossima sessione in studio.",
  },
  {
    id: "mix-master",
    number: "02",
    title: "Mix e master",
    description: "Seleziona il tipo di servizio di cui hai bisogno: mix, master o mix e master.",
  },
  {
    id: "custom-beat",
    number: "03",
    title: "Beat su misura",
    description: "Un beat costruito intorno alla tua voce, ai tuoi riferimenti e alla tua visione.",
  },
];
