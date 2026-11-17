/**
 * Music level for the 3D studio: meters, LEDs and lights follow what is playing.
 * Beat previews carry a precomputed loudness envelope (no extra audio graph, so playback can
 * never be muted by a suspended AudioContext); the sequencer sends short pulses on its hits.
 */
const envs = new Map<string, Float32Array>();
const byBlob = new WeakMap<Blob, Float32Array>();
let el: HTMLAudioElement | null = null;
let pulse = 0, pulseAt = 0;
export const ENV_RATE = 30;

export function envelopeFrom(chans: Float32Array[], sampleRate: number) {
  const hop = Math.floor(sampleRate / ENV_RATE);
  const n = Math.ceil(chans[0].length / hop);
  const env = new Float32Array(n);
  let max = 1e-6;
  for (let i = 0; i < n; i++) {
    let sum = 0, cnt = 0;
    for (let k = i * hop; k < Math.min(chans[0].length, (i + 1) * hop); k += 4) { const v = chans[0][k]; sum += v * v; cnt++; }
    env[i] = Math.sqrt(sum / Math.max(1, cnt));
    if (env[i] > max) max = env[i];
  }
  for (let i = 0; i < n; i++) env[i] = Math.min(1, env[i] / max);
  return env;
}
export const attachEnvelope = (b: Blob, env: Float32Array) => { byBlob.set(b, env); };
export const envelopeOf = (b: Blob) => byBlob.get(b);
export const registerEnvelope = (url: string, env: Float32Array | undefined) => { if (env) envs.set(url, env); };
export const bindAudio = (a: HTMLAudioElement) => { el = a; };
export function pulseLevel(v: number) { const now = performance.now(); pulse = Math.max(v, currentPulse(now)); pulseAt = now; }
const currentPulse = (now: number) => pulse * Math.exp(-(now - pulseAt) / 160);

/** 0..1 level right now. */
export function musicLevel(now: number) {
  let lv = 0;
  if (el && !el.paused) {
    const e = envs.get(el.src);
    if (e) lv = e[Math.min(e.length - 1, Math.floor(el.currentTime * ENV_RATE))] ?? 0;
  }
  return Math.max(lv, currentPulse(now));
}
