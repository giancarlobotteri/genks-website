/** Italian presentation labels; database codes and product identifiers stay unchanged. */
const labels: Record<string, string> = {
  pending: "In attesa", paid: "Pagato", failed: "Non riuscito", refunded: "Rimborsato", cancelled: "Annullato",
  draft: "Bozza", published: "Pubblicato", archived: "Archiviato", exclusive_sold: "Esclusiva venduta",
  requested: "Richiesto", quoted: "Preventivo inviato", awaiting_payment: "In attesa di pagamento",
  approved_awaiting_payment: "Approvato, in attesa di pagamento", confirmed: "Confermato", completed: "Completato",
  rejected: "Rifiutato", no_show: "Mancata presentazione", in_progress: "Prenotato / in lavorazione", review: "In revisione", delivered: "Consegnato", sold: "Venduto",
  studio_package: "Pacchetto ore di studio", recording: "Registrazione", mix_master: "Mix e master", stems: "Tracce separate", percent: "Percentuale", fixed: "Importo fisso",
  Dark: "Scuro", Floating: "Etereo", Melodic: "Melodico", Hard: "Potente", Experimental: "Sperimentale", EXPERIMENTAL: "SPERIMENTALE",
  "MP3 Lease": "Licenza MP3", "WAV Lease": "Licenza WAV", "Trackout Lease": "Licenza con tracce separate", "Exclusive License": "Licenza esclusiva",
  "MP3 lease": "Licenza MP3", "WAV lease": "Licenza WAV", "Trackout lease": "Licenza con tracce separate",
  "High quality MP3 non-exclusive license": "Licenza non esclusiva con MP3 di alta qualità",
  "MP3 and uncompressed WAV": "MP3 e WAV non compresso", "MP3, WAV and track stems": "MP3, WAV e tracce separate",
  "Direct negotiation with GENKS": "Accordo diretto con GENKS",
  commerce: "Acquisti", booking: "Prenotazioni", customer_segments: "Segmenti clienti",

  "Weightless keys. Heavy low end. A late-night pocket.": "Tasti leggeri e bassi profondi. Un’atmosfera da tarda notte.",
  "Cold textures and a bassline built to cut through.": "Suoni freddi e una linea di basso incisiva.",
  "Soft chords, blurred edges and room for a melody.": "Accordi morbidi, sfumature e spazio per una melodia.",
  "Sparse melody. Restless percussion. All forward motion.": "Melodia essenziale e percussioni vivaci. Energia in movimento.",
  "An open groove with a darker melodic undercurrent.": "Un ritmo arioso con una melodia scura in sottofondo.",
  "A slow-burning melody over rolling drums.": "Una melodia che cresce lentamente su batterie incalzanti.",
  "High-quality MP3": "MP3 di alta qualità", "Non-exclusive license": "Licenza non esclusiva",
  "Example terms — to be confirmed": "Condizioni di esempio da confermare",
  "Uncompressed WAV + MP3": "WAV non compresso e MP3", "Individual track stems": "Tracce separate del brano",
  "WAV + MP3 included": "WAV e MP3 inclusi",
};
export function italianLabel(value: string | null | undefined): string { return value ? labels[value] ?? value : ""; }
