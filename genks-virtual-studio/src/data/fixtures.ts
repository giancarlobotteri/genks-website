import type { StudioContent } from "../types.ts";

// DEMO fixtures. Titles, prices, licences and packages are invented placeholders,
// clearly marked as DEMO in the UI and editable from the demo admin (#gestione).
// Previews are synthesised in the browser from the `style` + `seed` recipe:
// original audio, no third-party music, no files to license.

export const demoContent: StudioContent = {
  version: 1,
  licenses: [
    {
      id: "mp3",
      name: "Base MP3",
      price: 2999,
      format: "MP3 320 kbps",
      includes: ["File MP3 senza tag vocale", "Uso non esclusivo", "Pubblicazione su piattaforme streaming"],
      limits: ["Limiti di stream e copie da definire nel contratto reale", "Nessuna traccia separata"],
    },
    {
      id: "wav",
      name: "Premium WAV",
      price: 4999,
      format: "WAV 24 bit + MP3",
      includes: ["WAV e MP3 senza tag vocale", "Uso non esclusivo", "Video musicale consentito"],
      limits: ["Limiti di distribuzione da definire nel contratto reale", "Nessuna traccia separata"],
    },
    {
      id: "stems",
      name: "Trackout Stems",
      price: 9999,
      format: "Stems WAV + WAV + MP3",
      includes: ["Tracce separate per il mix", "WAV e MP3", "Uso non esclusivo"],
      limits: ["Il beat resta disponibile per altri artisti", "Condizioni definitive nel contratto reale"],
    },
    {
      id: "exclusive",
      name: "Esclusiva",
      price: null,
      format: "Su richiesta",
      includes: ["Valutazione personalizzata", "Ritiro del beat dal catalogo se accettata"],
      limits: ["Nessun prezzo fisso: richiesta separata", "Nessuna vendita automatica"],
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
  ],
  recording: [
    { id: "rec-1h", name: "Sessione voce 1 ora", hours: 1, price: 3500, description: "Per un singolo brano già preparato.", includes: ["Fonico in sala", "Registrazione voce", "Esportazione delle take"] },
    { id: "rec-2h", name: "Sessione voce 2 ore", hours: 2, price: 6500, description: "Tempo per doppie, cori e prove.", includes: ["Fonico in sala", "Registrazione voce e doppie", "Comping base delle take"] },
    { id: "rec-4h", name: "Mezza giornata", hours: 4, price: 12000, description: "Per EP o più brani nella stessa sessione.", includes: ["Fonico in sala", "Più brani", "Comping base e pre-mix di ascolto"] },
  ],
  mix: [
    { id: "mix", name: "Mix", summary: "Bilanciamento, spazialità e coerenza tra voce e base.", price: 8000, priceNote: "fino a 24 tracce", turnaround: "5–7 giorni lavorativi (indicativo)", revisions: "2 revisioni incluse", includes: ["Editing di base delle voci", "Equalizzazione e dinamica", "Effetti e spazialità", "Bounce WAV stereo"], needs: "Tracce separate (stems) in WAV" },
    { id: "master", name: "Master", summary: "Volume, timbrica e compatibilità con le piattaforme.", price: 3000, priceNote: "per brano", turnaround: "2–3 giorni lavorativi (indicativo)", revisions: "1 revisione inclusa", includes: ["Bilanciamento timbrico finale", "Loudness per streaming", "Controllo mono e picchi", "WAV e MP3 finali"], needs: "Un file stereo del mix finito" },
    { id: "mixmaster", name: "Mix & Master", summary: "Il percorso completo, dal multitraccia al file pronto da pubblicare.", price: 10000, priceNote: "fino a 24 tracce", turnaround: "7–10 giorni lavorativi (indicativo)", revisions: "2 revisioni mix + 1 master", includes: ["Tutto il servizio Mix", "Tutto il servizio Master", "Un solo referente", "Versione strumentale su richiesta"], needs: "Tracce separate (stems) in WAV" },
  ],
  bundles: [
    { id: "bd-1", name: "Voce pronta", summary: "Registrazione di 2 ore e Mix & Master dello stesso brano.", includes: ["Sessione voce 2 ore", "Mix & Master 1 brano"], limits: ["Un brano", "Revisioni come da servizi inclusi"], price: 15000, listValue: 16500, status: "example" },
    { id: "bd-2", name: "Tre licenze WAV", summary: "Tre beat a scelta in licenza Premium WAV.", includes: ["3 licenze Premium WAV", "Beat a scelta dal catalogo"], limits: ["Esclusive escluse", "Condizioni di licenza invariate"], price: 12000, listValue: 14997, status: "example" },
    { id: "bd-3", name: "Progetto completo", summary: "Beat su misura, registrazione e Mix & Master: un unico percorso.", includes: ["Beat su misura", "Sessione voce 4 ore", "Mix & Master 1 brano"], limits: ["Prezzo definito dopo il brief", "Tempi concordati"], price: null, listValue: null, status: "example" },
  ],
  customBeat: {
    turnaround: "7–14 giorni dal brief approvato (indicativo)",
    revisions: "2 revisioni sulla bozza incluse (indicativo)",
    priceFrom: 25000,
    steps: [
      { title: "Brief", text: "Mi mandi riferimenti, mood e destinazione del brano." },
      { title: "Preventivo", text: "Ricevi una proposta con prezzo e tempi prima di iniziare." },
      { title: "Bozza", text: "Prima versione del beat da ascoltare e commentare." },
      { title: "Revisioni", text: "Modifiche sulla struttura e sui suoni concordati." },
      { title: "Consegna", text: "File e licenza secondo l’accordo firmato." },
    ],
  },
};
