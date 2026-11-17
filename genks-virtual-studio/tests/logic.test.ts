import { describe, expect, it } from "vitest";
import { demoContent } from "../src/data/fixtures.ts";
import { demoAvailability } from "../src/lib/availability.ts";
import { bundleSaving, cartLines, cartTotal, emptyFilters, filterBeats, priceFrom, upsertCart, visibleBundles } from "../src/lib/catalog.ts";
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
    expect(bundleSaving(bundles[0])).toBe(1500);
    expect(bundleSaving(bundles[2])).toBeNull();
    expect(bundleSaving({ ...bundles[0], price: 20000 })).toBeNull();
  });
  it("i pacchetti nascosti non sono mostrati", () => {
    expect(visibleBundles([{ ...bundles[0], status: "hidden" }])).toEqual([]);
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

describe("disponibilità demo", () => {
  it("è deterministica e chiusa la domenica", () => {
    const from = new Date(2026, 10, 16);
    const a = demoAvailability(from), b = demoAvailability(from);
    expect(a).toEqual(b);
    expect(a).toHaveLength(14);
    expect(a.filter(d => new Date(d.iso + "T12:00").getDay() === 0).every(d => d.slots.length === 0)).toBe(true);
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
    expect(poseAt(1, end)).toEqual(end);
    expect(poseAt(2, end)).toEqual(end);
  });
  it("si ferma esattamente su ogni tappa: microfono, DAW, tre servizi, display", () => {
    for (const st of STOPS.slice(0, -1)) {
      const k = KEYS.find(x => x.p === st.p)!;
      expect(k).toBeTruthy();
      poseAt(st.p, end).pos.forEach((v, i) => expect(v).toBeCloseTo(k.pos[i], 6));
    }
  });
  it("arretra per rivelare lo studio tra microfono e monitor DAW", () => {
    expect(poseAt(0.11, end).pos[2]).toBeGreaterThan(poseAt(0, end).pos[2]);
    expect(poseAt(0.22, end).pos[2]).toBeLessThan(0);
  });
  it("motion ridotto: nessun movimento continuo, solo pose chiave", () => {
    expect(poseAt(0.21, end, true).pos).toEqual(KEYS[2].pos);
    expect(poseAt(0.24, end, true).pos).toEqual(KEYS[2].pos);
  });
  it("visibilità degli hotspot per fascia di scroll", () => {
    expect(band(0.1, 0, 0.2)).toBe(1);
    expect(band(0.5, 0, 0.2)).toBe(0);
    expect(band(0.225, 0, 0.2, 0.05)).toBeCloseTo(0.5);
  });
});
