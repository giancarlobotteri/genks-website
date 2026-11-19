import type { StudioContent } from "../types.ts";

// The catalogue and the price list of GENKS. Licences, studio rate, custom beat and packages are those
// of prodbygenks.com (src/lib/service-pricing-v10.ts, service-catalog.ts and the licence types of the main
// site); mix 70 €, master 30 €, mix + master 100 € as set by GENKS for this site. The "listValue" of a
// package is the same services bought separately at these prices. Beat previews are synthesised in the
// browser from `style` + `seed`.

export const demoContent: StudioContent = {
  version: 1,
  licenses: [
    {
      id: "mp3",
      name: "Base MP3",
      price: 2999,
      format: "MP3 320 kbps",
      includes: ["MP3 di alta qualità", "Licenza non esclusiva", "Pubblicazione su piattaforme streaming"],
      limits: ["Condizioni complete nel contratto di licenza", "Nessuna traccia separata"],
    },
    {
      id: "wav",
      name: "Premium WAV",
      price: 4999,
      format: "WAV 24 bit + MP3",
      includes: ["WAV non compresso + MP3", "Licenza non esclusiva", "Video musicale consentito"],
      limits: ["Condizioni complete nel contratto di licenza", "Nessuna traccia separata"],
    },
    {
      id: "stems",
      name: "Trackout (tracce separate)",
      price: 9999,
      format: "Tracce separate + WAV + MP3",
      includes: ["Tracce separate per il mix", "WAV e MP3 inclusi", "Licenza non esclusiva"],
      limits: ["Il beat resta disponibile per altri artisti", "Condizioni complete nel contratto di licenza"],
    },
    {
      id: "exclusive",
      name: "Esclusiva",
      price: null,
      format: "Su richiesta",
      includes: ["Trattativa diretta con GENKS", "Ritiro del beat dal catalogo se accettata"],
      limits: ["Nessun prezzo fisso: proposta su richiesta"],
    },
  ],
  beats: [
    { id: "b1", title: "Notte Cobalto", genre: "Trap", mood: ["Scuro", "Notturno"], bpm: 142, key: "F# min", description: "808 lunghi, hi-hat in terzine e un pad freddo che apre lo spazio alla voce.", licenses: ["mp3", "wav", "stems", "exclusive"], style: "trap", seed: 11, hue: 0, status: "published", createdAt: "2026-11-10" },
    { id: "b2", title: "Cromo Liquido", genre: "Drill", mood: ["Aggressivo", "Energico"], bpm: 144, key: "C min", description: "Batteria drill scivolata, basso con glide e campanelle metalliche.", licenses: ["mp3", "wav", "stems", "exclusive"], style: "drill", seed: 23, hue: 12, status: "published", createdAt: "2026-11-08" },
    { id: "b3", title: "Velluto Blu", genre: "R&B", mood: ["Romantico", "Morbido"], bpm: 92, key: "Eb maj", description: "Accordi estesi, groove rilassato e linea di basso rotonda.", licenses: ["mp3", "wav", "stems"], style: "rnb", seed: 37, hue: 28, status: "published", createdAt: "2026-11-05" },
    { id: "b4", title: "Cassetta 1997", genre: "Boom bap", mood: ["Nostalgico", "Ruvido"], bpm: 88, key: "A min", description: "Kick secco, rullante pieno e pianoforte filtrato in loop.", licenses: ["mp3", "wav", "exclusive"], style: "boombap", seed: 41, hue: 20, status: "published", createdAt: "2026-10-30" },
    { id: "b5", title: "Marea Elettrica", genre: "Afro", mood: ["Solare", "Energico"], bpm: 104, key: "G maj", description: "Percussioni sincopate, plucks luminosi e basso che spinge in levare.", licenses: ["mp3", "wav", "stems", "exclusive"], style: "afro", seed: 53, hue: 34, status: "published", createdAt: "2026-10-26" },
    { id: "b6", title: "Polvere di Luna", genre: "Lo-fi", mood: ["Malinconico", "Morbido"], bpm: 78, key: "D min", description: "Batteria morbida, accordi caldi e un velo di rumore di nastro.", licenses: ["mp3", "wav"], style: "lofi", seed: 67, hue: 8, status: "published", createdAt: "2026-10-20" },
    { id: "b7", title: "Segnale Zero", genre: "Trap", mood: ["Scuro", "Aggressivo"], bpm: 150, key: "B min", description: "Arpeggio digitale, 808 distorto e pause improvvise.", licenses: ["mp3", "wav", "stems", "exclusive"], style: "trap", seed: 79, hue: 16, status: "published", createdAt: "2026-10-14" },
    { id: "b8", title: "Ora Blu", genre: "R&B", mood: ["Notturno", "Romantico"], bpm: 96, key: "Bb min", description: "Groove lento con chitarra sintetica e accordi sospesi.", licenses: ["mp3", "wav", "stems"], style: "rnb", seed: 83, hue: 4, status: "published", createdAt: "2026-10-08" },
    { id: "b9", title: "Neon Sospeso", genre: "Pop", mood: ["Solare", "Energico"], bpm: 118, key: "E maj", description: "Synth luminosi, cassa dritta e un hook di plucks pronto per il ritornello.", licenses: ["mp3", "wav", "stems", "exclusive"], style: "afro", seed: 97, hue: 22, status: "published", createdAt: "2026-10-02" },
    { id: "b10", title: "Asfalto", genre: "Drill", mood: ["Scuro", "Aggressivo"], bpm: 140, key: "G min", description: "Slide di 808, percussioni spezzate e un coro campionato distante.", licenses: ["mp3", "wav", "stems"], style: "drill", seed: 101, hue: 30, status: "published", createdAt: "2026-09-27" },
    { id: "b11", title: "Fumo Lento", genre: "Lo-fi", mood: ["Notturno", "Morbido"], bpm: 82, key: "C maj", description: "Piano Rhodes, batteria spazzolata e crepitio di vinile.", licenses: ["mp3", "wav"], style: "lofi", seed: 109, hue: 6, status: "published", createdAt: "2026-09-21" },
    { id: "b12", title: "Città Sommersa", genre: "Trap", mood: ["Malinconico", "Notturno"], bpm: 136, key: "D# min", description: "Pad ampi, campanelle e un 808 profondo che respira con la voce.", licenses: ["mp3", "wav", "stems", "exclusive"], style: "trap", seed: 113, hue: 14, status: "published", createdAt: "2026-09-15" },
  ],
  // studio: 19,99 €/ora (dopo mezzanotte 29,99 €/ora), minimo di prenotazione 20 €; blocco 5 ore 79,99 €
  recording: [
    { id: "rec-1h", name: "Sessione 1 ora", hours: 1, price: 1999, description: "Per un brano già preparato. Minimo di prenotazione 20 €.", includes: ["Fonico in sala", "Registrazione voce", "Esportazione delle take"] },
    { id: "rec-2h", name: "Sessione 2 ore", hours: 2, price: 3998, description: "Tempo per doppie, cori e prove.", includes: ["Fonico in sala", "Registrazione voce e doppie", "Esportazione delle take"] },
    { id: "rec-5h", name: "Blocco 5 ore", hours: 5, price: 7999, description: "5 ore da usare entro 90 giorni, al massimo in 2 appuntamenti.", includes: ["Fonico in sala", "Più brani o più sessioni", "Risparmi 19,96 € sulle ore singole"] },
  ],
  // mix 70 €, master 30 €, mix + master 100 € (per brano)
  mix: [
    { id: "mix", name: "Mix", summary: "Bilanciamento, spazialità e coerenza tra voce e base.", price: 7000, priceNote: "per brano", turnaround: "Prima versione entro 7 giorni lavorativi", revisions: "Una revisione inclusa per brano", includes: ["Editing di base delle voci", "Equalizzazione e dinamica", "Effetti e spazialità", "WAV stereo del mix"], needs: "Voce e strumenti in file separati (WAV)" },
    { id: "master", name: "Master", summary: "Volume, timbrica e compatibilità con le piattaforme.", price: 3000, priceNote: "per brano", turnaround: "Prima versione entro 7 giorni lavorativi", revisions: "Una revisione inclusa per brano", includes: ["Bilanciamento timbrico finale", "Loudness per lo streaming", "Controllo mono e picchi", "WAV e MP3 finali"], needs: "Un solo file stereo del mix finito" },
    { id: "mixmaster", name: "Mix & Master", summary: "Il percorso completo, dal multitraccia al file pronto da pubblicare.", price: 10000, priceNote: "per brano", turnaround: "Prima versione entro 7 giorni lavorativi", revisions: "Una revisione inclusa per lavorazione", includes: ["Tutto il servizio Mix", "Tutto il servizio Master", "Un solo referente", "Brano pronto da pubblicare"], needs: "Voce e strumenti in file separati (WAV)" },
  ],
  bundles: [
    { id: "pk-beat-voice", name: "Beat & Voce", summary: "Beat GENKS su misura e 2 ore di registrazione.", includes: ["Beat su misura", "2 ore di registrazione", "Una revisione del beat"], limits: ["Mix e master esclusi", "Un brano"], price: 6499, listValue: 7497, status: "published" },
    { id: "pk-masters", name: "Master Pack", summary: "Tre master stereo, una revisione per brano.", includes: ["3 master stereo", "Una revisione per brano"], limits: ["Tre brani"], price: 6999, listValue: 9000, status: "published" },
    { id: "pk-voice", name: "Registrazione + mix/master", summary: "Un’ora di studio, mix e master dello stesso brano.", includes: ["1 ora di registrazione", "Mix", "Master"], limits: ["Un brano", "Ore aggiuntive 19,99 €/ora"], price: 6999, listValue: 11999, status: "published" },
    { id: "pk-hours", name: "Blocco 5 ore di registrazione", summary: "Cinque ore di studio da usare entro 90 giorni.", includes: ["5 ore di registrazione con fonico"], limits: ["Entro 90 giorni", "Al massimo 2 appuntamenti"], price: 7999, listValue: 9995, status: "published" },
    { id: "pk-turnkey", name: "Singolo chiavi in mano", summary: "Beat GENKS, un’ora di studio, mix e master.", includes: ["Beat GENKS su misura", "1 ora di registrazione", "Mix", "Master"], limits: ["Un brano", "Ore aggiuntive 19,99 €/ora"], price: 9999, listValue: 15498, status: "published" },
    { id: "pk-ep", name: "EP Pack", summary: "Quattro produzioni GENKS con mix, master e 2 ore di studio per brano.", includes: ["4 beat GENKS", "Mix e master di ogni brano", "2 ore di studio per brano", "Una revisione inclusa"], limits: ["Solo produzioni GENKS", "Ore aggiuntive 19,99 €/ora"], price: 35999, listValue: 69988, status: "published" },
  ],
  customBeat: {
    turnaround: "Entro 10 giorni lavorativi dall’avvio",
    revisions: "Una revisione inclusa",
    priceFrom: 3499,
    steps: [
      { title: "Brief", text: "Mi mandi riferimenti, mood e destinazione del brano." },
      { title: "Pagamento", text: "34,99 €: con carta subito, oppure in contanti in studio." },
      { title: "Bozza", text: "Prima versione del beat da ascoltare e commentare." },
      { title: "Revisione", text: "Una revisione inclusa su struttura e suoni." },
      { title: "Consegna", text: "File e licenza secondo l’accordo firmato." },
    ],
  },
};
