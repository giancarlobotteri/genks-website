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
    id: "mix",
    number: "02",
    title: "Mix",
    description: "Invia i dettagli del progetto e ricevi un preventivo su misura.",
  },
  {
    id: "master",
    number: "03",
    title: "Master",
    description: "Definizione, potenza e resa su ogni impianto per la tua uscita.",
  },
  {
    id: "mix-master",
    number: "04",
    title: "Mix & master",
    description: "Dai al tuo brano lo spazio, la potenza e la definizione che merita.",
  },
  {
    id: "custom-beat",
    number: "05",
    title: "Beat su misura",
    description: "Un beat costruito intorno alla tua voce, ai tuoi riferimenti e alla tua visione.",
  },
];
