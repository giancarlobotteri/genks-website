import { describe, expect, it } from "vitest";
import { demoContent } from "../src/data/fixtures.ts";
import { appointmentLabel, availableTimes, durationOptions, fromRomeWallTime, isNightOf, slotAvailable, slotState, startAllowed, type StudioDay } from "../src/lib/real-availability.ts";
import { audioPrice, totalEnding99, bundleSaving, cartLines, cartTotal, emptyFilters, filterBeats, priceFrom, upsertCart, visibleBundles } from "../src/lib/catalog.ts";
import { chordNotes, MINOR, parseKey, previewBars } from "../src/lib/music.ts";
import { validate } from "../src/lib/validate.ts";
import { encodeWav } from "../src/lib/wav.ts";
import { band, KEYS, poseAt, STOPS, type Pose } from "../src/scene/camera-path.ts";

const { beats, licenses, bundles } = demoContent;

describe("catalogo", () => {
  it("contiene almeno 6 beat demo pubblicati", () => {
    expect(filterBeats(beats, licenses, emptyFilters).length).toBeGreaterThanOrEqual(6);
  });
  it("cerca senza distinguere maiuscole e accenti", () => {
    expect(filterBeats(beats, licenses, { ...emptyFilters, query: "  CROMO " }).map(b => b.id)).toEqual(["b2"]);
  });
  it("combina genere, BPM, tonalità, mood e prezzo", () => {
    const r = filterBeats(beats, licenses, { ...emptyFilters, genre: "Trap", bpmMin: 145 });
    expect(r.map(b => b.title)).toEqual(["Segnale Zero"]);
    expect(filterBeats(beats, licenses, { ...emptyFilters, mood: "Romantico", key: "Eb maj" })).toHaveLength(1);
    expect(filterBeats(beats, licenses, { ...emptyFilters, priceMax: 1000 })).toHaveLength(0);
  });
  it("ordina per BPM e non mostra beat non pubblicati", () => {
    const sorted = filterBeats(beats, licenses, { ...emptyFilters, sort: "bpm-asc" }).map(b => b.bpm);
    expect(sorted).toEqual([...sorted].sort((a, b) => a - b));
    const hidden = [{ ...beats[0], status: "hidden" as const }];
    expect(filterBeats(hidden, licenses, emptyFilters)).toEqual([]);
  });
  it("prezzo «da» ignora le licenze su richiesta", () => {
    expect(priceFrom(beats[0], licenses)).toBe(2999);
    expect(priceFrom({ ...beats[0], licenses: ["exclusive"] }, licenses)).toBeNull();
  });
});

describe("carrello demo", () => {
  it("una licenza per beat, totale corretto", () => {
    let cart = upsertCart([], { beatId: "b1", licenseId: "mp3" });
    cart = upsertCart(cart, { beatId: "b1", licenseId: "wav" });
    cart = upsertCart(cart, { beatId: "b2", licenseId: "stems" });
    const lines = cartLines(cart, beats, licenses);
    expect(lines).toHaveLength(2);
    expect(cartTotal(lines)).toBe(14999); // 49,99 + 99,99 = 149,98 → 149,99
  });
  it("l’esclusiva non è mai acquistabile automaticamente", () => {
    expect(cartLines([{ beatId: "b1", licenseId: "exclusive" }], beats, licenses)).toEqual([]);
  });
});

describe("pacchetti", () => {
  it("risparmio solo se prezzo e valore sono configurati e reali", () => {
    // Beat & Voce: 64,99 € instead of 74,97 € (the prices of prodbygenks.com)
    expect(bundleSaving(bundles[0])).toBe(1998);
    expect(bundleSaving({ ...bundles[0], listValue: null })).toBeNull();
    expect(bundleSaving({ ...bundles[0], price: 20000 })).toBeNull();
  });
  it("i pacchetti nascosti non sono mostrati", () => {
    expect(visibleBundles([{ ...bundles[0], status: "hidden" }])).toEqual([]);
  });
});

describe("listino mix e master", () => {
  it("mix 69,99, master 29,99, mix & master 89,99 with any number of tracks", () => {
    expect([audioPrice("mix"), audioPrice("master"), audioPrice("mixmaster")]).toEqual([6999, 2999, 8999]);
    expect([audioPrice("mix", 8), audioPrice("mix", 40), audioPrice("master", 40), audioPrice("mixmaster", 24)]).toEqual([6999, 6999, 2999, 8999]);
    expect(demoContent.mix.map(m => m.price)).toEqual([6999, 2999, 8999]);
    expect([3998, 2000, 7997, 2999, 4020].map(totalEnding99)).toEqual([3999, 1999, 7999, 2999, 4099]);
    for (const b of demoContent.bundles) expect((b.listValue! - b.price!) / b.listValue!).toBeLessThanOrEqual(0.25);
    expect(demoContent.recording[0].price).toBe(1999);
    expect(demoContent.customBeat.priceFrom).toBe(7999);
  });
});

describe("validazione moduli", () => {
  const rules = { name: { required: true, label: "Nome" }, email: { required: true, email: true, label: "Email" }, ref: { url: true, label: "Link" }, n: { min: 1, max: 10, label: "Numero" } };
  it("segnala campi obbligatori, email, link e numeri", () => {
    expect(Object.keys(validate({ name: "", email: "x", ref: "ftp://a", n: "0" }, rules))).toEqual(["name", "email", "ref", "n"]);
    expect(validate({ name: "A", email: "a@b.it", ref: "https://a.it", n: "3" }, rules)).toEqual({});
    expect(validate({ name: "A", email: "a@b.it" }, rules)).toEqual({});
  });
});

describe("calendario reale", () => {
  const quarters = (max: number) => Array.from({ length: max * 4 }, (_, k) => (k + 1) / 4);
  // shape of GET /api/availability?calendar=1: a Friday evening where 21:00–22:00 is booked
  const fri: StudioDay = {
    date: "2026-11-20",
    allSlots: ["19:30", "20:00", "20:30", "21:00", "21:30", "22:00", "22:30", "23:00", "23:30"],
    durationsBySlot: { "19:30": quarters(1.5), "20:00": quarters(1), "20:30": quarters(0.5), "22:00": quarters(8), "22:30": quarters(8), "23:00": quarters(8), "23:30": quarters(8) },
  };
  const before = fromRomeWallTime("2026-11-20", "12:00").getTime();

  it("ora di Roma, anche al cambio dell'ora", () => {
    expect(new Date(fromRomeWallTime("2026-11-20", "19:30")).toISOString()).toBe("2026-11-20T18:30:00.000Z");
    expect(new Date(fromRomeWallTime("2027-06-05", "19:30")).toISOString()).toBe("2027-06-05T17:30:00.000Z");
    expect(Number.isNaN(fromRomeWallTime("2027-03-28", "02:30").getTime())).toBe(true); // ora che non esiste
    expect(new Date(fromRomeWallTime("2026-10-25", "02:30")).toISOString()).toBe("2026-10-25T01:30:00.000Z"); // ora ripetuta: ora solare
  });
  it("un orario vale solo se c'è spazio per tutta la durata", () => {
    expect(availableTimes(fri, 1, before)).toEqual(["19:30", "20:00", "22:00", "22:30", "23:00", "23:30"]);
    expect(availableTimes(fri, 1.5, before)).toEqual(["19:30", "22:00", "22:30", "23:00", "23:30"]);
    expect(slotAvailable(fri, "20:00", 2, before)).toBe(false);
    expect(slotState(fri, "21:00", 1, before)).toBe("busy");
    expect(slotState(fri, "20:30", 1, before)).toBe("short");
    // venerdì oltre mezzanotte: 23:30 per 6 ore
    expect(slotAvailable(fri, "23:30", 6, before)).toBe(true);
    expect(appointmentLabel("2026-11-20", "23:30", 6)).toMatch(/ven 20 nov.*23:30.*sab 21 nov.*05:30/);
  });
  it("preavviso minimo di 65 minuti", () => {
    const at = fromRomeWallTime("2026-11-20", "19:30").getTime();
    expect(startAllowed("2026-11-20", "19:30", at - 66 * 60000)).toBe(true);
    expect(startAllowed("2026-11-20", "19:30", at - 64 * 60000)).toBe(false);
    expect(slotState(fri, "19:30", 1, at - 30 * 60000)).toBe("past");
  });
  it("durate da 1 ora a mezz'ore, notti del fine settimana", () => {
    expect(durationOptions()).toEqual([1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8]);
    expect(durationOptions(5).at(-1)).toBe(5);
    expect(isNightOf("2026-11-21", "03:00")).toBe(true); // sabato 03:00 = notte di venerdì
    expect(isNightOf("2026-11-22", "09:30")).toBe(true);
    expect(isNightOf("2026-11-21", "10:00")).toBe(false);
    expect(isNightOf("2026-11-20", "01:00")).toBe(false);
  });
});

describe("audio", () => {
  it("WAV PCM 16 bit con intestazione corretta", () => {
    const buf = encodeWav([new Float32Array([0, 1, -1]), new Float32Array([0, 0.5, -0.5])], 32000);
    const v = new DataView(buf);
    expect(buf.byteLength).toBe(44 + 3 * 2 * 2);
    expect(String.fromCharCode(v.getUint8(0), v.getUint8(1), v.getUint8(2), v.getUint8(3))).toBe("RIFF");
    expect(v.getUint16(22, true)).toBe(2);
    expect(v.getUint32(24, true)).toBe(32000);
    expect(v.getInt16(48, true)).toBe(32767);
    expect(v.getInt16(52, true)).toBe(-32768);
  });
  it("tonalità, accordi e durata anteprima", () => {
    expect(parseKey("F# min")).toEqual({ root: 6, minor: true });
    expect(parseKey("Eb maj")).toEqual({ root: 3, minor: false });
    expect(chordNotes(60, MINOR, 0)).toEqual([60, 63, 67, 70]);
    for (const bpm of [78, 92, 142, 150]) {
      const sec = previewBars(bpm) * (240 / bpm);
      expect(sec).toBeGreaterThan(9);
      expect(sec).toBeLessThan(22);
    }
  });
});

describe("percorso camera", () => {
  const end: Pose = { pos: [0, 1, -1.2], target: [0, 0.95, -1.7] };
  it("parte dal microfono e arriva al display", () => {
    expect(poseAt(0, end).pos).toEqual(KEYS[0].pos);
    expect(poseAt(1, end)).toEqual({ ...end, lens: 1 });
    expect(poseAt(2, end)).toEqual({ ...end, lens: 1 });
  });
  it("si ferma esattamente su ogni tappa: microfono, studio, DAW, tre servizi, i quattro servizi, display", () => {
    expect(STOPS.map(x => x.id)).toEqual(["mic", "studio", "daw", "mix", "master", "mixmaster", "services", "display"]);
    for (const st of STOPS.slice(0, -1)) {
      const k = KEYS.find(x => x.p === st.p)!;
      expect(k).toBeTruthy();
      poseAt(st.p, end).pos.forEach((v, i) => expect(v).toBeCloseTo(k.pos[i], 6));
    }
  });
  it("rivelazione: dal microfono la camera arretra e sale, poi va verso la DAW", () => {
    const mic = poseAt(0, end), studio = poseAt(0.15, end);
    expect(studio.pos[2]).toBeGreaterThan(mic.pos[2]);
    expect(studio.pos[1]).toBeGreaterThan(mic.pos[1]);
    expect(poseAt(0.28, end).pos[2]).toBeLessThan(0);
  });
  it("focale: lunga sul microfono, aperta sullo studio, cambia senza scatti", () => {
    expect(poseAt(0, end).lens).toBeLessThan(0.7);
    expect(poseAt(0.15, end).lens).toBe(1);
    let prev = poseAt(0, end).lens!;
    for (let p = 0.002; p <= 0.15; p += 0.002) {
      const l = poseAt(p, end).lens!;
      expect(l).toBeGreaterThanOrEqual(prev - 1e-9);
      expect(l - prev).toBeLessThan(0.03);
      prev = l;
    }
  });
  it("le transizioni narrative hanno tempi propri (la rivelazione è la più lenta)", () => {
    expect(STOPS[1].glide).toBeGreaterThan(STOPS[4].glide);
  });
  it("motion ridotto: nessun movimento continuo, solo pose chiave", () => {
    expect(poseAt(0.27, end, true).pos).toEqual(KEYS[3].pos);
    expect(poseAt(0.3, end, true).pos).toEqual(KEYS[3].pos);
  });
  it("visibilità degli hotspot per fascia di scroll", () => {
    expect(band(0.1, 0, 0.2)).toBe(1);
    expect(band(0.5, 0, 0.2)).toBe(0);
    expect(band(0.225, 0, 0.2, 0.05)).toBeCloseTo(0.5);
  });
});

import { smoothDamp } from "../src/lib/stepper.ts";
import { drift, SHOTS } from "../src/scene/shot-table.ts";

describe("virtual scroll spring", () => {
  it("glides to the target without overshooting, at any frame rate", () => {
    for (const hz of [60, 90, 120, 144]) {
      let x = 0, v = 0, max = 0;
      for (let f = 0; f < hz * 4; f++) {
        [x, v] = smoothDamp(x, 1, v, 0.5, 1 / hz);
        max = Math.max(max, x);
      }
      expect(max).toBeLessThanOrEqual(1);
      expect(x).toBeGreaterThan(0.999);
    }
  });
  it("starts gently and keeps its speed when the target moves mid-way", () => {
    let x = 0, v = 0;
    [x, v] = smoothDamp(x, 1, v, 0.5, 1 / 120);
    expect(x).toBeLessThan(0.01); // smooth start, no jump
    for (let f = 0; f < 40; f++) [x, v] = smoothDamp(x, 1, v, 0.5, 1 / 120);
    const before = v;
    const [, after] = smoothDamp(x, 2, v, 0.5, 1 / 120); // a new gesture: next stop
    expect(after).toBeGreaterThan(before * 0.9); // no stop-and-go
  });
  it("is the same curve at 60 and 120 Hz (frame-rate independent)", () => {
    const run = (hz: number) => { let x = 0, v = 0; for (let f = 0; f < hz * 0.6; f++) [x, v] = smoothDamp(x, 1, v, 0.5, 1 / hz); return x; };
    expect(Math.abs(run(60) - run(120))).toBeLessThan(0.01);
  });
});

describe("camera shots", () => {
  it("every preview shot exists and keeps moving while held", () => {
    for (const id of ["reel:intro", "reel:rec", "reel:custom", "reel:mix", "reel:choose"]) {
      const o = SHOTS[id];
      expect(o).toBeTruthy();
      const later = drift(o, 4);
      expect(later.yaw !== o.yaw || later.dist !== o.dist || later.t[0] !== o.t[0]).toBe(true);
    }
  });
  it("a held shot never collapses onto its subject", () => {
    for (const o of Object.values(SHOTS)) expect(drift(o, 600).dist).toBeGreaterThan(o.dist * 0.5);
  });
});

import { goToStop, stopPos, tickStepper } from "../src/lib/stepper.ts";

describe("virtual scroll timing", () => {
  it("reaches the next stop in the same time whether the device renders 120, 30 or 5 frames per second", () => {
    for (const fps of [120, 30, 5]) {
      void goToStop(0, true);
      void goToStop(1);
      for (let t = 0; t < 2.5; t += 1 / fps) tickStepper(1 / fps);
      expect(stopPos()).toBeGreaterThan(0.999);
    }
  });
});

import { parseBrief } from "../src/lib/brief.ts";

describe("beat su misura: il brief in una frase", () => {
  const MOODS = ["Notturno", "Energico", "Malinconico", "Solare", "Cupo", "Morbido"];
  it("legge genere, BPM e mood", () => {
    expect(parseBrief("trap cupa a 140 BPM, 808 pesanti, atmosfera notturna", MOODS)).toEqual({ genre: "Trap", bpm: 140, moods: ["Notturno", "Cupo"] });
  });
  it("non scambia l'808 per i BPM", () => {
    expect(parseBrief("808 pesanti, drill a 142 bpm", MOODS).bpm).toBe(142);
    expect(parseBrief("808 pesanti e basta", MOODS).bpm).toBeNull();
  });
  it("frase senza indicazioni: nessun campo inventato", () => {
    expect(parseBrief("qualcosa di bello", MOODS)).toEqual({ genre: null, bpm: null, moods: [] });
  });
});
