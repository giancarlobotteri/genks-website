import {calculateProduction,type ProductionInput} from '../production-calculator.ts';
/**
 * CALCOLATRICE PREZZI GENKS
 * -------------------------
 * Il bot NON fa i conti a mente: chiama questa funzione per ogni preventivo.
 *
 * 1. Applica il listino del sito (condizioni versione 26/10/2026).
 * 2. Per le richieste che il sito non prevede (EP da 6 brani, 5 master, EP di solo
 *    mix...) estende i pacchetti IN PROPORZIONE: stessa percentuale di sconto del
 *    pacchetto originale, arrotondata a ",99" come gli altri prezzi del sito.
 * 3. Prova tutte le combinazioni di pacchetti e sceglie la più conveniente.
 *
 * La stessa funzione va usata dal checkout del sito per ricalcolare il prezzo
 * di un preventivo lato server (vedi verificaPreventivo in fondo).
 *
 * Se cambi un prezzo sul sito, cambialo anche qui in PREZZI (in centesimi)
 * e in knowledge.ts.
 */

const SITE = "https://www.prodbygenks.com";

/** true quando il checkout del sito accetta ?preventivo=... (vedi INTEGRAZIONE-CHATGPT.md). */
export const ACQUISTO_PREVENTIVI_ATTIVO = true;

// Tutti i prezzi in centesimi di euro (7999 = 79,99 €).
// Checkout annotations only. Canonical prices and proportions always come from the supplied calculator.
export {PREZZI,PROPORZIONI} from './pricing.ts';
import {PREZZI,PROPORZIONI} from './pricing.ts';
export type Componente={tipo:string;brani?:Brano[];ore?:number;beat?:number;quantita?:number;saldo?:number;aggancio?:string};
export type Servizio='mix'|'mix_master'|'master';
export interface BranoInput{servizio:Servizio;quantita?:number;file?:number;artisti_correzione_voce?:number;revisioni_extra?:number;consegna_veloce?:boolean}
export interface PreventivoInput{progetto?:ProductionInput;brani?:BranoInput[];ore_registrazione?:number;mezzore_dopo_mezzanotte?:number;beat_su_misura?:number;usa_pacchetti?:boolean}
export interface Riga{descrizione:string;prezzo:string;centesimi:number;componente?:Componente;personalizzato?:boolean}
export interface Preventivo{righe:Riga[];totale:string;totale_servizi_separati:string;risparmio:string;da_pagare_subito:string;saldo_successivo:string;offerta_personalizzata:boolean;link_acquisto?:string;link:string[];note:string[];importi_centesimi:{totale:number;subito:number;saldo:number;listino:number};errore?:string}

// ---------- utilità ----------

export const euro = (c: number) =>
  (Math.round(c) / 100).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

/** Arrotonda all'euro più vicino e termina in ,99 (come i prezzi del sito). */
export const arrotonda99 = (c: number) => Math.max(99, Math.round(c / 100) * 100 - 1);

const fascia = (file: number) => (file <= 8 ? 0 : file <= 24 ? 1 : 2);
const nomeFascia = ["fino a 8 file", "9–24 file", "25–48 file"];
const int = (n: unknown, def = 0) => {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) && v > 0 ? v : def;
};
const plur = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;

/** Costo totale di k revisioni extra: 9,99 + 14,99 + 19,99 + ... */
export function costoRevisioni(k: number): number {
  let tot = 0;
  for (let i = 0; i < k; i++) tot += PREZZI.revisioneExtraBase + 500 * i;
  return tot;
}

/** Numero di artisti incluso nella lavorazione, senza maggiorazioni. */
export function costoCorrezioneVoci(n: number): number {
  if(!Number.isInteger(n)||n<0||n>20)throw new Error("invalid_artists");
  return 0;
}

// ---------- modello interno ----------

export interface Brano {
  file:number;
  servizio: Servizio;
  fascia: number;
  artisti: number;
  revisioni: number;
  veloce: boolean;
}

interface Piano {
  righe: Riga[];
  totale: number;
  saldo: number;
  link: Set<string>;
  note: string[];
  personalizzati: number;
}

const listinoBrano = (b: Brano) =>
  b.servizio === "mix" ? PREZZI.mix[b.fascia] : b.servizio === "mix_master" ? PREZZI.mixMaster[b.fascia] : PREZZI.master;
// Prezzo base (fino a 8 file) su cui si applica lo sconto del pacchetto
const baseBrano = (b: Brano) => (b.servizio === "mix" ? PREZZI.mix[0] : PREZZI.mixMaster[0]);

/** Costruisce un piano con t "Singolo chiavi in mano" e v "Registrazione + mix/master". */
function costruisciPiano(
  mmTutti: Brano[],
  soloMix: Brano[],
  soloMaster: Brano[],
  oreTot: number,
  beatTot: number,
  t: number,
  v: number,
  usaPacchetti: boolean,
): Piano {
  const p: Piano = { righe: [], totale: 0, saldo: 0, link: new Set(), note: [], personalizzati: 0 };
  const add = (descrizione: string, c: number, personalizzato = false, componente?:Componente) => {
    p.righe.push({descrizione,prezzo:euro(c),centesimi:c,...personalizzato?{personalizzato:true}:{},...componente?{componente}:{}});
    p.totale += c;
    if (personalizzato) p.personalizzati++;
  };
  const P = PREZZI.pacchetti;
  const magg = (b: Brano) => PREZZI.maggiorazionePacchetto[b.fascia];

  const mm = [...mmTutti];
  let ore = oreTot;
  let beat = beatTot;

  // Singolo chiavi in mano
  for (let i = 0; i < t; i++) {
    const b = mm.shift()!;
    add(`Singolo chiavi in mano: beat su misura + 2 ore di registrazione + mix/master (${nomeFascia[b.fascia]})`, P.singoloChiaviInMano + magg(b),false,{tipo:"turnkey",brani:[b],ore:2,beat:1,saldo:.5*(PREZZI.beat+2*PREZZI.oraRegistrazione)*(P.singoloChiaviInMano/(PREZZI.beat+2*PREZZI.oraRegistrazione+PREZZI.mixMaster[0]))});
    const listinoComp = PREZZI.beat + 2 * PREZZI.oraRegistrazione + PREZZI.mixMaster[0];
    p.saldo += 0.5 * (PREZZI.beat + 2 * PREZZI.oraRegistrazione) * (P.singoloChiaviInMano / listinoComp);
    beat--; ore -= 2;
    p.link.add(`${SITE}/services/project?package=turnkey`);
  }
  if (t > 1) p.note.push(`${t} Singoli chiavi in mano: ogni brano ha il suo beat, le sue 2 ore e il suo mix/master.`);

  // Registrazione + mix/master
  for (let i = 0; i < v; i++) {
    const b = mm.shift()!;
    add(`Registrazione + mix/master: 2 ore + mix/master (${nomeFascia[b.fascia]})`, P.registrazioneMixMaster + magg(b),false,{tipo:"voice",brani:[b],ore:2,saldo:.5*2*PREZZI.oraRegistrazione*(P.registrazioneMixMaster/(2*PREZZI.oraRegistrazione+PREZZI.mixMaster[0]))});
    const listinoComp = 2 * PREZZI.oraRegistrazione + PREZZI.mixMaster[0];
    p.saldo += 0.5 * 2 * PREZZI.oraRegistrazione * (P.registrazioneMixMaster / listinoComp);
    ore -= 2;
    p.link.add(`${SITE}/services/project?package=voice`);
  }

  // Brani con mix rimasti: EP (standard o proporzionale) oppure singoli
  const conMix = [...mm, ...soloMix];
  if (usaPacchetti && conMix.length >= PROPORZIONI.ep.soglia) {
    const nMM = mm.length;
    const nMix = soloMix.length;
    const maggTot = conMix.reduce((s, b) => s + magg(b), 0);
    const standard = nMM === 4 && nMix === 0;
    const prezzo = standard
      ? P.epPack + maggTot
      : arrotonda99(PROPORZIONI.ep.rapporto * conMix.reduce((s, b) => s + baseBrano(b), 0)) + maggTot;
    const fasce = [0, 1, 2]
      .map((f) => [f, conMix.filter((b) => b.fascia === f).length] as const)
      .filter(([, n]) => n)
      .map(([f, n]) => `${n} ${nomeFascia[f]}`)
      .join(", ");
    const comp = [nMM && plur(nMM, "mix + master", "mix + master"), nMix && plur(nMix, "solo mix", "solo mix")].filter(Boolean).join(" e ");
    add(
      standard
        ? `EP Pack: mix + master di 4 brani (${fasce})`
        : `EP personalizzato da ${conMix.length} brani: ${comp} (${fasce}) · prezzo in proporzione all'EP Pack`,
      prezzo,
      !standard,{tipo:"ep",brani:conMix},
    );
    p.link.add(`${SITE}/services/project?package=ep`);
    if (maggTot) p.note.push("Nei pacchetti: +25 € per ogni brano da 9–24 file, +70 € per ogni brano da 25–48 file (come da sito).");
  } else {
    for (const [lista, nome, prezzi, url] of [
      [mm, "Mix + master", PREZZI.mixMaster, `${SITE}/services/project?service=mix_master`],
      [soloMix, "Mix", PREZZI.mix, `${SITE}/services/project?service=mix`],
    ] as const) {
      for (let f = 0; f < 3; f++) {
        const n = lista.filter((b) => b.fascia === f).length;
        if (!n) continue;
        add(`${nome} singolo (${nomeFascia[f]}) × ${plur(n, "brano", "brani")} a ${euro(prezzi[f])}`, n * prezzi[f],false,{tipo:"audio",brani:lista.filter(b=>b.fascia===f)});
        p.link.add(url);
      }
    }
    if (usaPacchetti && conMix.length === 3) {
      const attuale = conMix.reduce((s, b) => s + listinoBrano(b), 0);
      const quarto = { servizio: "mix_master", fascia: 0, artisti: 0, revisioni: 0, veloce: false } as Brano;
      const conEP =
        arrotonda99(PROPORZIONI.ep.rapporto * [...conMix, quarto].reduce((s, b) => s + baseBrano(b), 0)) +
        conMix.reduce((s, b) => s + magg(b), 0);
      p.note.push(`Suggerimento: aggiungendo un 4° brano (mix + master, fino a 8 file) passi all'EP e paghi solo ${euro(conEP - attuale)} in più.`);
    }
  }

  // Ore rimaste.
  // Regola del sito: ore aggiuntive ai pacchetti a 9,99 € nella stessa sessione.
  // Proporzione: ogni pacchetto può al massimo RADDOPPIARE le proprie ore a 9,99 €
  // (2 ore → +2; Blocco 5 ore → +5). Le ore oltre si prezzano a blocchi o a 19,99 €.
  if (ore > 0 && usaPacchetti && t + v > 0) {
    const extra = Math.min(ore, 2 * (t + v));
    add(`${plur(extra, "ora aggiuntiva", "ore aggiuntive")} ai pacchetti a 9,99 €`, extra * PREZZI.oraAggiuntivaPacchetto,false,{tipo:"extra_studio",ore:extra,aggancio:"sessioni",saldo:.5*extra*PREZZI.oraAggiuntivaPacchetto});
    p.saldo += 0.5 * extra * PREZZI.oraAggiuntivaPacchetto;
    p.note.push("Ore aggiuntive a 9,99 €: nella stessa sessione del pacchetto, secondo disponibilità (al massimo tante quante le ore già incluse).");
    ore -= extra;
  }
  if (ore > 0) {
    if (usaPacchetti && ore >= 5) {
      const blocchi = Math.floor(ore / 10) + (ore % 10 >= 5 ? 1 : 0);
      const extra = Math.min(ore - 5 * blocchi, 5 * blocchi);
      add(
        blocchi === 1
          ? "Blocco 5 ore di registrazione (entro 90 giorni, massimo 2 appuntamenti)"
          : `Blocco 5 ore di registrazione × ${blocchi} (ognuno entro 90 giorni, massimo 2 appuntamenti)`,
        blocchi * P.blocco5Ore,false,{tipo:"credits",ore:5*blocchi,quantita:blocchi,saldo:.5*blocchi*P.blocco5Ore},
      );
      p.saldo += 0.5 * blocchi * P.blocco5Ore;
      if (extra > 0) {
        add(`${plur(extra, "ora aggiuntiva", "ore aggiuntive")} ai blocchi a 9,99 €`, extra * PREZZI.oraAggiuntivaPacchetto,false,{tipo:"extra_studio",ore:extra,aggancio:"blocchi",saldo:.5*extra*PREZZI.oraAggiuntivaPacchetto});
        p.saldo += 0.5 * extra * PREZZI.oraAggiuntivaPacchetto;
        p.note.push("Ore aggiuntive ai blocchi a 9,99 €: nelle stesse sessioni, secondo disponibilità e orari dello studio (al massimo 5 per blocco).");
      }
      ore -= 5 * blocchi + extra;
      p.link.add(`${SITE}/services/project?package=hours`);
    }
  }
  if (ore > 0) {
    {
      add(`Registrazione in studio: ${plur(ore, "ora", "ore")} × 19,99 €`, ore * PREZZI.oraRegistrazione,false,{tipo:"recording",ore,saldo:.5*ore*PREZZI.oraRegistrazione});
      p.saldo += 0.5 * ore * PREZZI.oraRegistrazione;
      p.link.add(`${SITE}/services/recording`);
      if (usaPacchetti && (ore === 3 || ore === 4)) {
        p.note.push(`Suggerimento: con il Blocco 5 ore (89,99 €) paghi ${euro(P.blocco5Ore - ore * PREZZI.oraRegistrazione)} in più e hai ${plur(5 - ore, "ora", "ore")} in più, da usare in massimo 2 appuntamenti entro 90 giorni.`);
      }
    }
  }

  // Beat rimasti
  if (beat > 0) {
    add(`Beat su misura × ${beat} a ${euro(PREZZI.beat)}`, beat * PREZZI.beat,false,{tipo:"custom",beat,saldo:.5*beat*PREZZI.beat});
    p.saldo += 0.5 * beat * PREZZI.beat;
    p.link.add(`${SITE}/services/custom`);
  }

  // Master: Master Pack (standard o proporzionale) oppure singoli
  const nM = soloMaster.length;
  if (usaPacchetti && nM >= PROPORZIONI.master.soglia) {
    const standard = nM === 3;
    const prezzo = standard ? P.masterPack : arrotonda99(PROPORZIONI.master.rapporto * nM * PREZZI.master);
    add(standard ? "Master Pack: 3 master stereo" : `Master Pack personalizzato da ${nM} master · prezzo in proporzione al Master Pack`, prezzo, !standard,{tipo:"masters",brani:soloMaster});
    p.link.add(`${SITE}/services/project?package=masters`);
  } else if (nM) {
    add(`Master stereo × ${plur(nM, "brano", "brani")} a 29,99 €`, nM * PREZZI.master,false,{tipo:"audio",brani:soloMaster});
    p.link.add(`${SITE}/services/project?service=master`);
    if (usaPacchetti && nM === 2) p.note.push(`Suggerimento: con un 3° master passi al Master Pack (79,99 €), solo ${euro(P.masterPack - 2 * PREZZI.master)} in più.`);
  }

  return p;
}

// ---------- calcolo pubblico ----------

export function calcolaPreventivo(input: PreventivoInput): Preventivo {
  if(input.progetto){
   const q=calculateProduction(input.progetto,brani=>calcolaPreventivo({brani}));
   const link=`${SITE}/services/album?preventivo=${codificaPreventivo(input)}`;
   return {righe:q.lines.map(l=>({descrizione:l.name,prezzo:euro(l.amount),centesimi:l.amount})),totale:euro(q.total),totale_servizi_separati:euro(q.listTotal),risparmio:euro(Math.max(0,q.listTotal-q.total)),da_pagare_subito:euro(q.dueNow),saldo_successivo:euro(q.balance),offerta_personalizzata:true,link_acquisto:link,link:[link],note:['Una revisione inclusa per ogni lavorazione e brano.','Produzioni GENKS: split 50/50; il 100% richiede un preventivo.','Registrazione e produzioni si confermano con il 50%; le lavorazioni audio si pagano prima dell’avvio.'],importi_centesimi:{totale:q.total,subito:q.dueNow,saldo:q.balance,listino:q.listTotal}};
  }
  const usaPacchetti = input?.usa_pacchetti !== false;
  const noteIniziali: string[] = [];

  const brani: Brano[] = [];
  for (const b of input?.brani ?? []) {
    if (!b || !["mix", "mix_master", "master"].includes(b.servizio)) continue;
    const q = Math.min(int(b.quantita, 1), 40);
    const file = b.servizio === "master" ? 1 : int(b.file, 8);
    if (file > 48) {
      noteIniziali.push(`${plur(q, "brano", "brani")} con ${file} file: oltre 48 file serve un preventivo personalizzato nei DM Instagram (https://www.instagram.com/prodbygenks/). Non incluso nel totale.`);
      continue;
    }
    for (let i = 0; i < q; i++)
      brani.push({
        servizio: b.servizio,
        file,
        fascia: fascia(file),
        artisti: Math.min(int(b.artisti_correzione_voce), 10),
        revisioni: Math.min(int(b.revisioni_extra), 10),
        veloce: !!b.consegna_veloce,
      });
  }
  const ore = Math.min(int(input?.ore_registrazione), 200);
  const beat = Math.min(int(input?.beat_su_misura), 20);
  const mezzore = Math.min(int(input?.mezzore_dopo_mezzanotte), 20);

  const vuoto = (errore: string): Preventivo => ({
    righe: [], totale: euro(0), totale_servizi_separati: euro(0), risparmio: euro(0),
    da_pagare_subito: euro(0), saldo_successivo: euro(0), offerta_personalizzata: false,
    link: [], note: noteIniziali, importi_centesimi: { totale: 0, subito: 0, saldo: 0, listino: 0 }, errore,
  });
  if (!brani.length && !ore && !beat) {
    return vuoto(noteIniziali.length ? "Serve un preventivo personalizzato: vedi note." : "Nessun servizio indicato: chiedi al cliente cosa gli serve (brani, servizio, file, ore, beat).");
  }

  const mm = brani.filter((b) => b.servizio === "mix_master");
  const soloMix = brani.filter((b) => b.servizio === "mix");
  const soloMaster = brani.filter((b) => b.servizio === "master");

  // Prova tutte le combinazioni di pacchetti con registrazione e tiene la più conveniente.
  let migliore: Piano | null = null;
  const maxT = usaPacchetti ? Math.min(beat, Math.floor(ore / 2), mm.length) : 0;
  for (let t = 0; t <= maxT; t++) {
    const maxV = usaPacchetti ? Math.min(Math.floor((ore - 2 * t) / 2), mm.length - t) : 0;
    for (let v = 0; v <= maxV; v++) {
      const piano = costruisciPiano(mm, soloMix, soloMaster, ore, beat, t, v, usaPacchetti);
      if (
        !migliore ||
        piano.totale < migliore.totale ||
        (piano.totale === migliore.totale && piano.personalizzati < migliore.personalizzati)
      )
        migliore = piano;
    }
  }
  const p = migliore!;
  const add = (descrizione: string, c: number) => {
    p.righe.push({ descrizione, prezzo: euro(c),centesimi:c,componente:{tipo:descrizione.startsWith("Supplemento dopo")?"night":"extra_audio",saldo:descrizione.startsWith("Supplemento dopo")?.5*c:0} });
    p.totale += c;
  };

  // Supplemento notturno
  if (mezzore > 0) {
    add(`Supplemento dopo mezzanotte: ${mezzore} × 30 minuti a 9,99 €`, mezzore * PREZZI.mezzoraNotturna);
    p.saldo += 0.5 * mezzore * PREZZI.mezzoraNotturna;
    p.note.push("Dopo mezzanotte si registra solo venerdì e sabato, secondo disponibilità.");
  }

  // Extra per brano (raggruppati)
  const raggruppa = (chiave: (b: Brano) => number) => {
    const m = new Map<number, number>();
    for (const b of brani) if (chiave(b)) m.set(chiave(b), (m.get(chiave(b)) ?? 0) + 1);
    return m;
  };
  const nVeloci = brani.filter((b) => b.veloce).length;
  if (nVeloci) add(`Consegna veloce (prima versione in 48 ore) × ${plur(nVeloci, "brano", "brani")}`, nVeloci * PREZZI.consegnaVeloce);
  for (const [artisti, n] of raggruppa((b) => b.artisti)) if(costoCorrezioneVoci(artisti)>0)
    add(`Correzione e pulizia voci (${plur(artisti, "artista", "artisti")}) × ${plur(n, "brano", "brani")}`, n * costoCorrezioneVoci(artisti));
  for (const [rev, n] of raggruppa((b) => b.revisioni)) {
    add(`${plur(rev, "revisione aggiuntiva", "revisioni aggiuntive")} × ${plur(n, "brano", "brani")}`, n * costoRevisioni(rev));
    if (rev > 2) p.note.push("Oltre 2 revisioni aggiuntive serve prima la conferma di disponibilità di GENKS.");
  }

  // Prezzo se si comprasse tutto separato
  const listino =
    brani.reduce((s, b) => s + listinoBrano(b) + costoCorrezioneVoci(b.artisti) + costoRevisioni(b.revisioni) + (b.veloce ? PREZZI.consegnaVeloce : 0), 0) +
    ore * PREZZI.oraRegistrazione + beat * PREZZI.beat + mezzore * PREZZI.mezzoraNotturna;

  // Note finali
  const note = [...noteIniziali, ...p.note];
  if (p.personalizzati) {
    note.push("Offerta personalizzata: non è nel listino del sito, è calcolata con la stessa percentuale di sconto del pacchetto originale. Valgono tutte le regole del sito per ogni servizio (revisioni, tempi, garanzia, anticipi).");
    if (!ACQUISTO_PREVENTIVI_ATTIVO) note.push("Per acquistare questa offerta personalizzata scrivi a Gianca nei DM Instagram: https://www.instagram.com/prodbygenks/");
  }
  if (beat > 0) note.push("Beat su misura: split 50/50 dei diritti sulla composizione; per il 100% o l'esclusiva serve un preventivo scritto.");
  if (p.saldo > 0) note.push("Registrazione e beat su misura si confermano con un anticipo del 50%.");
  if (ore > 0) note.push("Data e orario si scelgono al momento della prenotazione, in base alla disponibilità.");
  note.push("Una revisione inclusa per ogni lavorazione e brano.");

  const saldo = Math.floor(p.saldo); // l'anticipo si arrotonda per eccesso, come sul sito
  const conLinkAcquisto = ACQUISTO_PREVENTIVI_ATTIVO && (p.personalizzati > 0 || p.righe.length > 1);

  return {
    righe: p.righe,
    totale: euro(p.totale),
    totale_servizi_separati: euro(listino),
    risparmio: euro(Math.max(0, listino - p.totale)),
    da_pagare_subito: euro(p.totale - saldo),
    saldo_successivo: euro(saldo),
    offerta_personalizzata: p.personalizzati > 0,
    ...(conLinkAcquisto ? { link_acquisto: `${SITE}/services/checkout?preventivo=${codificaPreventivo(input)}` } : {}),
    link: [...p.link],
    note,
    importi_centesimi: { totale: p.totale, subito: p.totale - saldo, saldo, listino },
  };
}

// ---------- link di acquisto del preventivo ----------
// Il link contiene SOLO la richiesta (brani, ore, ecc.), mai il prezzo:
// il checkout ricalcola tutto sul server con calcolaPreventivo.

function toB64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64Url(s: string): string {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function codificaPreventivo(input: PreventivoInput): string {
  const pulito: PreventivoInput = {
    ...(input.progetto?{progetto:input.progetto}:{}),
    brani: (input?.brani ?? []).map((b) => ({
      servizio: b.servizio,
      ...(b.quantita ? { quantita: int(b.quantita, 1) } : {}),
      ...(b.file ? { file: int(b.file, 8) } : {}),
      ...(b.artisti_correzione_voce ? { artisti_correzione_voce: int(b.artisti_correzione_voce) } : {}),
      ...(b.revisioni_extra ? { revisioni_extra: int(b.revisioni_extra) } : {}),
      ...(b.consegna_veloce ? { consegna_veloce: true } : {}),
    })),
    ...(input?.ore_registrazione ? { ore_registrazione: int(input.ore_registrazione) } : {}),
    ...(input?.mezzore_dopo_mezzanotte ? { mezzore_dopo_mezzanotte: int(input.mezzore_dopo_mezzanotte) } : {}),
    ...(input?.beat_su_misura ? { beat_su_misura: int(input.beat_su_misura) } : {}),
    ...(input?.usa_pacchetti === false ? { usa_pacchetti: false } : {}),
  };
  return toB64Url(JSON.stringify(pulito));
}

export function decodificaPreventivo(codice: string): PreventivoInput | null {
  try {
    const dati = JSON.parse(fromB64Url(codice));
    return dati && typeof dati === "object" ? (dati as PreventivoInput) : null;
  } catch {
    return null;
  }
}

/**
 * Da usare nel CHECKOUT (lato server): dato il codice ?preventivo=..., ricalcola
 * righe e importi. Non fidarsi mai di prezzi arrivati dal browser.
 */
export function verificaPreventivo(codice: string): Preventivo | null {
  const input = decodificaPreventivo(codice);
  if (!input) return null;
  const r = calcolaPreventivo(input);
  return r.errore ? null : r;
}

// ---------- strumento per Gemini ----------

export const PREVENTIVO_TOOL = {
  name: "calcola_preventivo",
  description:
    "Calcola il prezzo esatto di qualsiasi richiesta del cliente, anche combinazioni che sul sito non esistono (EP da 6 brani, 5 master, EP di solo mix...), che vengono prezzate in proporzione ai pacchetti del sito. Sceglie in automatico la combinazione più conveniente. Usalo SEMPRE quando devi dire un prezzo totale.",
  parameters: {
    type: "OBJECT",
    properties: {
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
