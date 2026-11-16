// Browser-only: renders an ORIGINAL short beat preview with the Web Audio API.
// No samples, no third-party music, no network: every sound is synthesised.
import type { Beat, BeatStyle } from "../types.ts";
import { chordNotes, MAJOR, midiToHz, MINOR, parseKey, previewBars, progression, rng } from "./music.ts";
import { encodeWav } from "./wav.ts";

type Pattern = { kick: number[]; snare: number[]; hat: number[]; hatRoll?: boolean; bass: "follow" | "offbeat" | "roots"; keys: "pad" | "piano" | "pluck" | "rhodes"; swing: number; lofi?: boolean };

const PATTERNS: Record<BeatStyle, Pattern> = {
  trap: { kick: [0, 7, 10], snare: [8], hat: [0, 2, 4, 6, 8, 10, 12, 14], hatRoll: true, bass: "follow", keys: "pad", swing: 0 },
  drill: { kick: [0, 11], snare: [6, 14], hat: [0, 3, 6, 8, 11, 14], bass: "follow", keys: "pluck", swing: 0.04 },
  rnb: { kick: [0, 7, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], bass: "roots", keys: "rhodes", swing: 0.12 },
  boombap: { kick: [0, 3, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], bass: "roots", keys: "piano", swing: 0.16 },
  afro: { kick: [0, 8], snare: [3, 6, 11, 14], hat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], bass: "offbeat", keys: "pluck", swing: 0.08 },
  lofi: { kick: [0, 9], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], bass: "roots", keys: "rhodes", swing: 0.18, lofi: true },
};

let noiseCache: AudioBuffer | null = null;
function noise(ctx: BaseAudioContext) {
  if (noiseCache && noiseCache.sampleRate === ctx.sampleRate) return noiseCache;
  const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  noiseCache = b;
  return b;
}

export function kick(ctx: BaseAudioContext, out: AudioNode, t: number, level = 1) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.9 * level, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
  o.connect(g).connect(out);
  o.start(t); o.stop(t + 0.4);
}

export function snare(ctx: BaseAudioContext, out: AudioNode, t: number, level = 1) {
  const n = ctx.createBufferSource();
  n.buffer = noise(ctx);
  const f = ctx.createBiquadFilter();
  f.type = "bandpass"; f.frequency.value = 1900; f.Q.value = 0.7;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.55 * level, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  n.connect(f).connect(g).connect(out);
  n.start(t, Math.random() * 0.5); n.stop(t + 0.25);
  const o = ctx.createOscillator();
  const og = ctx.createGain();
  o.type = "triangle"; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(160, t + 0.08);
  og.gain.setValueAtTime(0.3 * level, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  o.connect(og).connect(out); o.start(t); o.stop(t + 0.14);
}

export function hat(ctx: BaseAudioContext, out: AudioNode, t: number, level = 1, open = false) {
  const n = ctx.createBufferSource();
  n.buffer = noise(ctx);
  const f = ctx.createBiquadFilter();
  f.type = "highpass"; f.frequency.value = 7600;
  const g = ctx.createGain();
  const len = open ? 0.18 : 0.045;
  g.gain.setValueAtTime(0.22 * level, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  n.connect(f).connect(g).connect(out);
  n.start(t, Math.random() * 0.5); n.stop(t + len + 0.01);
}

export function bassNote(ctx: BaseAudioContext, out: AudioNode, t: number, dur: number, hz: number, glideTo?: number, level = 1) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 2.2); }
  shaper.curve = curve;
  o.type = "sine";
  o.frequency.setValueAtTime(hz, t);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + Math.min(0.12, dur * 0.5));
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.55 * level, t + 0.01);
  g.gain.setValueAtTime(0.5 * level, t + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(shaper).connect(g).connect(out);
  o.start(t); o.stop(t + dur + 0.02);
}

function keysNote(ctx: BaseAudioContext, out: AudioNode, t: number, dur: number, hz: number, kind: Pattern["keys"], level: number) {
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  const voices: OscillatorType[] = kind === "pad" ? ["sawtooth", "sawtooth"] : kind === "rhodes" ? ["sine", "triangle"] : kind === "piano" ? ["triangle", "sine"] : ["square"];
  const attack = kind === "pad" ? 0.25 : 0.006;
  const decay = kind === "pluck" ? 0.25 : kind === "piano" ? 0.9 : dur;
  f.frequency.setValueAtTime(kind === "pad" ? 900 : kind === "pluck" ? 2600 : 1800, t);
  if (kind === "pluck") f.frequency.exponentialRampToValueAtTime(500, t + 0.25);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(level, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(attack + 0.05, decay));
  voices.forEach((type, i) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = hz;
    o.detune.value = i === 0 ? -6 : 6;
    o.connect(f);
    o.start(t); o.stop(t + Math.max(attack + 0.06, decay) + 0.05);
  });
  f.connect(g).connect(out);
}

export async function renderBeatPreview(beat: Pick<Beat, "bpm" | "key" | "style" | "seed">, sampleRate = 32000): Promise<Blob> {
  const p = PATTERNS[beat.style];
  const bars = previewBars(beat.bpm);
  const step = 60 / beat.bpm / 4;
  const length = bars * 16 * step + 1.2;
  const ctx = new OfflineAudioContext(2, Math.ceil(length * sampleRate), sampleRate);
  const r = rng(beat.seed);
  const { root, minor } = parseKey(beat.key);
  const scale = minor ? MINOR : MAJOR;
  const prog = progression(beat.seed, minor);

  const master = ctx.createDynamicsCompressor();
  master.threshold.value = -14; master.ratio.value = 3; master.attack.value = 0.01; master.release.value = 0.2;
  const out = ctx.createGain();
  out.gain.value = 0.9;
  master.connect(out);
  let dest: AudioNode = ctx.destination;
  if (p.lofi) {
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 5200;
    lp.connect(ctx.destination);
    dest = lp;
    const hiss = ctx.createBufferSource();
    hiss.buffer = noise(ctx); hiss.loop = true;
    const hg = ctx.createGain(); hg.gain.value = 0.012;
    hiss.connect(hg).connect(lp); hiss.start(0); hiss.stop(length);
  }
  out.connect(dest);

  const drums = ctx.createGain(); drums.gain.value = 0.9; drums.connect(master);
  const bassBus = ctx.createGain(); bassBus.gain.value = 0.85; bassBus.connect(master);
  const keysBus = ctx.createGain(); keysBus.gain.value = 0.32;
  const pan = ctx.createStereoPanner(); pan.pan.value = 0;
  // simple stereo widening delay for the keys
  const delay = ctx.createDelay(1); delay.delayTime.value = step * 3;
  const fb = ctx.createGain(); fb.gain.value = 0.22;
  const wet = ctx.createStereoPanner(); wet.pan.value = 0.6;
  keysBus.connect(pan).connect(master);
  keysBus.connect(delay); delay.connect(fb).connect(delay); delay.connect(wet).connect(master);

  const time = (bar: number, s: number) => 0.05 + (bar * 16 + s) * step + (s % 2 === 1 ? p.swing * step : 0);
  const bassRoot = 36 + root; // C2-based
  const keysRoot = 60 + root - (root > 6 ? 12 : 0);

  for (let bar = 0; bar < bars; bar++) {
    const degree = prog[bar % prog.length];
    const intro = bar === 0;
    // drums (first bar: hats + keys only for a softer start)
    if (!intro) {
      p.kick.forEach(s => kick(ctx, drums, time(bar, s)));
      if (r() > 0.5) kick(ctx, drums, time(bar, 14), 0.7);
      p.snare.forEach(s => snare(ctx, drums, time(bar, s), 0.9));
    }
    p.hat.forEach(s => {
      hat(ctx, drums, time(bar, s), s % 4 === 0 ? 1 : 0.6);
      if (p.hatRoll && !intro && (s === 6 || s === 14) && r() > 0.45) {
        for (let k = 1; k < 4; k++) hat(ctx, drums, time(bar, s) + (k * step) / 3 * 2, 0.5);
      }
    });
    if (bar % 2 === 1) hat(ctx, drums, time(bar, 15), 0.6, true);
    // bass
    if (!intro) {
      const hz = midiToHz(bassRoot + scale[degree % 7]);
      if (p.bass === "follow") {
        p.kick.forEach((s, i) => {
          const next = p.kick[i + 1] ?? 16;
          const glide = r() > 0.7 ? hz * (r() > 0.5 ? 2 : 0.75) : undefined;
          bassNote(ctx, bassBus, time(bar, s), (next - s) * step * 0.95, hz, glide);
        });
      } else if (p.bass === "offbeat") {
        [2, 6, 10, 14].forEach(s => bassNote(ctx, bassBus, time(bar, s), step * 1.6, hz, undefined, 0.8));
      } else {
        bassNote(ctx, bassBus, time(bar, 0), step * 7, hz, undefined, 0.8);
        bassNote(ctx, bassBus, time(bar, 8), step * 6, midiToHz(bassRoot + scale[(degree + 4) % 7]), undefined, 0.7);
      }
    }
    // keys
    const notes = chordNotes(keysRoot, scale, degree);
    if (p.keys === "pad" || p.keys === "rhodes") {
      notes.forEach(n => keysNote(ctx, keysBus, time(bar, 0), 16 * step, midiToHz(n), p.keys, 0.16));
    } else if (p.keys === "piano") {
      [0, 6, 10].forEach(s => notes.forEach(n => keysNote(ctx, keysBus, time(bar, s), 4 * step, midiToHz(n), "piano", 0.14)));
    } else {
      for (let s = 0; s < 16; s += 2) {
        if (r() > 0.35) keysNote(ctx, keysBus, time(bar, s), step * 2, midiToHz(notes[Math.floor(r() * notes.length)] + 12), "pluck", 0.22);
      }
    }
  }

  const rendered = await ctx.startRendering();
  const chans = [rendered.getChannelData(0), rendered.getChannelData(1)];
  // gentle fade out at the end of the preview
  const fade = Math.floor(sampleRate * 0.8);
  for (const c of chans) for (let i = 0; i < fade; i++) c[c.length - 1 - i] *= i / fade;
  return new Blob([encodeWav(chans, sampleRate)], { type: "audio/wav" });
}
