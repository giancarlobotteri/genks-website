/**
 * Reproducible, original synthesized audio fixtures, NOT GENKS releases.
 * Run with Node.js and ffmpeg installed: node scripts/generate-demo-audio.mjs
 * No third-party samples, network calls or audio libraries are used.
 */
import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const destination = fileURLToPath(new URL("../public/audio/", import.meta.url));
mkdirSync(destination, { recursive: true });
const sampleRate = 44100;
const tracks = [
  ["blue-hour", 140, 29, 42],
  ["chrome-hearts", 142, 25, 57],
  ["afterimage", 96, 31, 83],
  ["no-signal", 150, 24, 97],
  ["low-tide", 112, 26, 131],
  ["night-drive", 132, 33, 173],
];

for (const [slug, bpm, root, initialSeed] of tracks) {
  const beat = 60 / bpm;
  const seconds = 32 * beat + 0.3;
  const length = Math.ceil(seconds * sampleRate);
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  let seed = initialSeed;
  const random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const frequency = (note) => 440 * 2 ** ((note - 69) / 12);
  const add = (start, duration, render, level = 1, pan = 0) => {
    const offset = Math.round(start * sampleRate);
    const samples = Math.min(Math.ceil(duration * sampleRate), length - offset);
    for (let i = 0; i < samples; i++) {
      const sound = render(i / sampleRate) * level;
      left[offset + i] += sound * (1 - Math.max(0, pan));
      right[offset + i] += sound * (1 + Math.min(0, pan));
    }
  };
  const kick = (start) =>
    add(
      start,
      0.5,
      (t) =>
        Math.sin(2 * Math.PI * (46 * t + 2.8 * (1 - Math.exp(-t / 0.025)))) *
        Math.exp(-t * 13),
      0.75,
    );
  const snare = (start) =>
    add(
      start,
      0.2,
      (t) =>
        ((random() * 2 - 1) * 0.8 + Math.sin(2 * Math.PI * 185 * t) * 0.2) *
        Math.exp(-t * 25),
      0.28,
    );
  const hat = (start, open = false, pan = 0) =>
    add(
      start,
      open ? 0.15 : 0.055,
      (t) => (random() * 2 - 1) * Math.exp(-t * (open ? 28 : 80)),
      0.09,
      pan,
    );
  const notes = [0, 7, 10, 3, 7, 12, 10, 7];
  for (let bar = 0; bar < 8; bar++) {
    const beginning = bar * 4 * beat;
    const chordRoot = root + [0, -5, 3, -2][Math.floor(bar / 2) % 4];
    [0, 1.75, 3.25].forEach((step) => kick(beginning + step * beat));
    snare(beginning + 2 * beat);
    for (let step = 0; step < 16; step++) {
      if (step % 2 === 0 || random() > 0.55)
        hat(beginning + (step * beat) / 4, step === 14, (random() - 0.5) * 0.4);
    }
    for (const [step, duration] of [
      [0, 1.5],
      [1.75, 0.75],
      [3.25, 0.65],
    ]) {
      const hz = frequency(chordRoot);
      add(
        beginning + step * beat,
        duration * beat,
        (t) =>
          Math.tanh(Math.sin(2 * Math.PI * hz * t) * 1.3) *
          Math.min(t * 100, 1) *
          Math.exp(-t * 1.8),
        0.34,
      );
    }
    for (let step = 0; step < 8; step++) {
      const hz = frequency(chordRoot + 24 + notes[(step + bar) % notes.length]);
      const start = beginning + (step * beat) / 2;
      const tone = (t) =>
        (Math.sin(2 * Math.PI * hz * t) +
          0.25 * Math.sin(2 * Math.PI * hz * 2 * t)) *
        Math.min(t * 170, 1) *
        Math.exp(-t * 7);
      add(start, 0.85, tone, 0.11, step % 2 ? 0.2 : -0.2);
      add(start + beat * 0.75, 0.6, tone, 0.025, step % 2 ? -0.3 : 0.3);
    }
    for (const interval of [0, 3, 7]) {
      const hz = frequency(chordRoot + 24 + interval);
      add(
        beginning,
        4 * beat,
        (t) =>
          Math.sin(2 * Math.PI * hz * t) *
          Math.min(t * 3, 1) *
          Math.max(0, 1 - t / (4 * beat)) *
          (0.6 + 0.4 * Math.min((t % beat) * 8, 1)),
        0.035,
        interval === 0 ? -0.25 : 0.25,
      );
    }
  }
  let peak = 0;
  for (let i = 0; i < length; i++)
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  const dataSize = length * 4;
  const wave = Buffer.alloc(44 + dataSize);
  wave.write("RIFF", 0);
  wave.writeUInt32LE(36 + dataSize, 4);
  wave.write("WAVEfmt ", 8);
  wave.writeUInt32LE(16, 16);
  wave.writeUInt16LE(1, 20);
  wave.writeUInt16LE(2, 22);
  wave.writeUInt32LE(sampleRate, 24);
  wave.writeUInt32LE(sampleRate * 4, 28);
  wave.writeUInt16LE(4, 32);
  wave.writeUInt16LE(16, 34);
  wave.write("data", 36);
  wave.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < length; i++) {
    const fade = Math.min(1, i / 400, (length - i) / (sampleRate * 0.3));
    wave.writeInt16LE(
      Math.round((left[i] / peak) * 0.75 * fade * 32767),
      44 + i * 4,
    );
    wave.writeInt16LE(
      Math.round((right[i] / peak) * 0.75 * fade * 32767),
      46 + i * 4,
    );
  }
  const wavPath = path.join(destination, `${slug}.wav`);
  const mp3Path = path.join(destination, `${slug}.mp3`);
  writeFileSync(wavPath, wave);
  const result = spawnSync("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    wavPath,
    "-codec:a",
    "libmp3lame",
    "-b:a",
    "128k",
    "-metadata",
    "artist=GENKS website demo fixtures",
    "-metadata",
    "comment=Synthesized test audio, not a GENKS release",
    mp3Path,
  ]);
  if (result.status !== 0)
    throw new Error(result.stderr?.toString() || "ffmpeg is required");
  unlinkSync(wavPath);
  console.log(`${slug}: ${seconds.toFixed(2)}s, ${bpm} BPM`);
}
