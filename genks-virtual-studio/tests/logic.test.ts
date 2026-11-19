import { describe, expect, it } from "vitest";
import { demoContent } from "../src/data/fixtures.ts";
import { demoAvailability } from "../src/lib/availability.ts";
import { audioPrice, bundleSaving, cartLines, cartTotal, emptyFilters, filterBeats, priceFrom, upsertCart, visibleBundles } from "../src/lib/catalog.ts";
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
    expect(cartTotal(lines)).toBe(4999 + 9999);
  });
  it("l’esclusiva non è mai acquistabile automaticamente", () => {
    expect(cartLines([{ beatId: "b1", licenseId: "exclusive" }], beats, licenses)).toEqual([]);
  });
});

describe("pacchetti", () => {
  it("risparmio solo se prezzo e valore sono configurati e reali", () => {
    // Beat & Voce: 64,99 € instead of 74,97 € (the prices of prodbygenks.com)
    expect(bundleSaving(bundles[0])).toBe(998);
    expect(bundleSaving({ ...bundles[0], listValue: null })).toBeNull();
    expect(bundleSaving({ ...bundles[0], price: 20000 })).toBeNull();
  });
  it("i pacchetti nascosti non sono mostrati", () => {
    expect(visibleBundles([{ ...bundles[0], status: "hidden" }])).toEqual([]);
  });
});

describe("listino mix e master", () => {
  it("mix 70 €, master 30 €, mix + master 100 €", () => {
    expect([audioPrice("mix"), audioPrice("master"), audioPrice("mixmaster")]).toEqual([7000, 3000, 10000]);
    expect(demoContent.mix.map(m => m.price)).toEqual([7000, 3000, 10000]);
    expect(demoContent.recording[0].price).toBe(1999);
    expect(demoContent.customBeat.priceFrom).toBe(3499);
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

describe("disponibilità", () => {
  it("segue gli orari dello studio: lun–gio dalle 19:30, sabato e domenica dalle 10:00", () => {
    const from = new Date(2026, 10, 16);
    const a = demoAvailability(from), b = demoAvailability(from);
    expect(a).toEqual(b);
    expect(a).toHaveLength(14);
    const at = (wd: number) => a.find(d => new Date(d.iso + "T12:00").getDay() === wd)!.slots.map(x => x.start);
    expect(at(1)[0]).toBe("19:30");
    expect(at(6)[0]).toBe("10:00");
    expect(at(0)[0]).toBe("10:00");
    // preferences only: the real availability is confirmed by email, nothing is shown as taken
    expect(a.every(d => d.slots.every(x => x.free))).toBe(true);
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
