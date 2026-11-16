// Pure music helpers shared by the preview synth and the step sequencer.

const NOTE: Record<string, number> = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };

export function parseKey(key: string): { root: number; minor: boolean } {
  const [note = "C", mode = "min"] = key.trim().split(/\s+/);
  return { root: NOTE[note] ?? 0, minor: !/^maj/i.test(mode) };
}

export const midiToHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

export const MINOR = [0, 2, 3, 5, 7, 8, 10];
export const MAJOR = [0, 2, 4, 5, 7, 9, 11];

/** Deterministic PRNG (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bars rendered for a preview so that it lasts roughly 12–20 seconds. */
export function previewBars(bpm: number) {
  const bar = 240 / bpm;
  return Math.max(4, Math.min(8, Math.round(16 / bar)));
}

/** Chord degrees (scale indexes) for a four-chord progression chosen by seed. */
export function progression(seed: number, minor: boolean): number[] {
  const minorProgs = [[0, 5, 2, 6], [0, 3, 5, 4], [0, 6, 5, 6], [0, 2, 3, 4]];
  const majorProgs = [[0, 4, 5, 3], [0, 5, 3, 4], [1, 4, 0, 5], [0, 3, 1, 4]];
  const list = minor ? minorProgs : majorProgs;
  return list[seed % list.length];
}

/** MIDI notes of a 4-voice chord built on a scale degree. */
export function chordNotes(rootMidi: number, scale: number[], degree: number, size = 4) {
  const notes: number[] = [];
  for (let i = 0; i < size; i++) {
    const idx = degree + i * 2;
    notes.push(rootMidi + scale[idx % 7] + 12 * Math.floor(idx / 7));
  }
  return notes;
}
