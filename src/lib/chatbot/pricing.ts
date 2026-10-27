export * from './pricing-engine-v10.ts';
export const PREZZI={mix:[2999,4999,6999,8999,11999],mixMaster:[5998,7998,9998,11998,14998],master:2999,maggiorazionePacchetto:[0,2000,4000,6000,9000],oraRegistrazione:1999,oraAggiuntivaPacchetto:1999,mezzoraNotturna:500,beat:3499,consegnaVeloce:1999,revisioneExtraBase:999,correzioneVoceBase:0,pacchetti:{singoloChiaviInMano:4999,registrazioneMixMaster:1999,epPack:37988,masterPack:6999,blocco5Ore:7999}} as const;
export const PROPORZIONI={ep:{soglia:4,rapporto:1},master:{soglia:3,rapporto:6999/(3*2999)}} as const;
export const ACQUISTO_PREVENTIVI_ATTIVO=true;
export const PREVENTIVO_TOOL = {
  name: "calcola_preventivo",
  description:
    "Calcola il prezzo esatto di qualsiasi richiesta del cliente, anche combinazioni che sul sito non esistono (EP da 6 brani, 5 master, EP di solo mix...), che vengono prezzate in proporzione ai pacchetti del sito. Sceglie in automatico la combinazione più conveniente. Usalo SEMPRE quando devi dire un prezzo totale.",
  parameters: {
    type: "OBJECT",
    properties: {
      progetto:{type:"OBJECT",description:"EP/album completo: produzione GENKS, mix, master, una revisione e 2 ore di studio per brano. Nessun servizio si può rimuovere.",properties:{format:{type:"STRING",enum:["ep","album"]},registrazione:{type:"BOOLEAN"},ore_extra:{type:"INTEGER",description:"Per il preventivo iniziale lascia 0. Ore extra a 19,99 euro, da scegliere per appuntamento nel modulo."},brani:{type:"ARRAY",items:{type:"OBJECT",properties:{servizio:{type:"STRING",enum:["mix_master"]},produzione:{type:"STRING",enum:["genks"]},tracce:{type:"INTEGER"},artisti:{type:"INTEGER"},revisioni_extra:{type:"INTEGER"},consegna_veloce:{type:"BOOLEAN"}},required:["servizio","produzione","tracce","artisti","revisioni_extra","consegna_veloce"]}},},required:["brani","registrazione","ore_extra"]},
      brani: {
        type: "ARRAY",
        description: "Brani da lavorare. Raggruppa i brani identici con 'quantita'.",
        items: {
          type: "OBJECT",
          properties: {
            servizio: { type: "STRING", enum: ["mix", "mix_master", "master"], description: "mix = solo mix; mix_master = mix + master; master = solo master di un mix stereo" },
            quantita: { type: "INTEGER", description: "Numero di brani con queste caratteristiche. Default 1." },
            file: { type: "INTEGER", description: "File audio (tracce) per brano. Se il cliente non lo dice, ometti: si assume fino a 8." },
            artisti_correzione_voce: { type: "INTEGER", description: "Artisti a cui correggere/pulire la voce in ciascun brano. Ometti se non richiesto." },
            revisioni_extra: { type: "INTEGER", description: "Revisioni oltre a quella inclusa, per ciascun brano. Ometti se non richiesto." },
            consegna_veloce: { type: "BOOLEAN", description: "true se vuole la prima versione in 48 ore." },
          },
          required: ["servizio"],
        },
      },
      ore_registrazione: { type: "INTEGER", description: "Ore totali di registrazione in studio." },
      mezzore_dopo_mezzanotte: { type: "INTEGER", description: "Blocchi da 30 minuti dopo le 00:00 (solo ven–sab)." },
      beat_su_misura: { type: "INTEGER", description: "Numero di beat su misura composti da GENKS." },
      usa_pacchetti: { type: "BOOLEAN", description: "Ometti (true). false solo se il cliente chiede esplicitamente il prezzo senza pacchetti." },
    },
  },
} as const;
