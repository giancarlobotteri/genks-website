/**
 * The film as a sequence of sharp stills (like the product pages that scrub through footage): every
 * frame is its own WebP, downloaded in the order the visit needs them and decoded ahead of the
 * position, so moving through the studio is instant at any speed (a <video> has to seek, and every
 * seek costs tens of milliseconds: that was the stutter). It also plays, for the preview.
 * The interface is the part of HTMLMediaElement the site uses, so the preview drives it like a video.
 */
export type FilmLike = {
  currentTime: number;
  readonly duration: number;
  readonly paused: boolean;
  readonly ended: boolean;
  muted: boolean;
  readonly seeking: boolean;
  readonly readyState: number;
  play(): Promise<void>;
  pause(): void;
  addEventListener(type: string, f: () => void): void;
  removeEventListener(type: string, f: () => void): void;
};

const FPS = 24;

export class FilmSeq extends EventTarget implements FilmLike {
  readonly count: number;
  readonly duration: number;
  muted = true;
  readonly seeking = false;
  private t = 0;
  private playing = false;
  private done = false;
  private last = -1;
  private blobs: (Blob | null)[];
  private bitmaps = new Map<number, ImageBitmap>();
  private decoding = new Set<number>();
  private ready = false;
  private failed = false;
  private disposed = false;
  private focus = 0;
  private waitFrom = 0;

  constructor(private base: string, count: number, private priority: number[] = [], private cache = 72) {
    super();
    this.count = count;
    this.duration = count / FPS;
    this.blobs = new Array(count).fill(null);
    void this.load();
  }

  get readyState() { return this.ready ? 4 : 0; }
  get paused() { return !this.playing; }
  get ended() { return this.done; }
  get currentTime() { return this.t; }
  set currentTime(v: number) {
    this.t = Math.max(0, Math.min(this.duration - 1 / FPS, v));
    this.done = false;
    this.want(this.frame());
  }
  play() { this.playing = true; this.done = false; this.last = -1; return Promise.resolve(); }
  pause() { this.playing = false; }

  /** index of the frame for the current time */
  frame() { return Math.max(0, Math.min(this.count - 1, Math.round(this.t * FPS))); }

  /** Advance the clock (while playing): never past a frame that isn't there yet (buffering). */
  tick(now: number) {
    if (!this.playing) { this.last = -1; return; }
    const dt = this.last < 0 ? 0 : Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const next = Math.min(this.count - 1, Math.round((this.t + dt) * FPS));
    // still downloading, or not decoded yet (for a moment): wait on this frame rather than skip or jump
    if (this.blobs[next] == null) { this.waitFrom = 0; return; }
    if (!this.bitmaps.has(next)) {
      this.want(next);
      if (!this.waitFrom) this.waitFrom = now;
      if (now - this.waitFrom < 140) return;
    }
    this.waitFrom = 0;
    this.t += dt;
    if (this.t >= this.duration - 1 / FPS) { this.t = this.duration - 1 / FPS; this.playing = false; this.done = true; }
    this.want(this.frame());
  }

  /** The decoded frame closest to `i` (exact when available), or null before anything is decoded. */
  bitmapNear(i: number): { bmp: ImageBitmap; i: number } | null {
    for (let d = 0; d < this.count; d++) {
      const a = this.bitmaps.get(i - d); if (a) return { bmp: a, i: i - d };
      const b = this.bitmaps.get(i + d); if (b) return { bmp: b, i: i + d };
      if (d > 40) break;
    }
    return null;
  }

  /** Decode the frames around `i` (more ahead than behind), let go of the far ones. */
  want(i: number) {
    this.focus = i;
    for (let d = -6; d <= 16; d++) this.decode(i + d);
    if (this.bitmaps.size > this.cache) {
      const far = [...this.bitmaps.keys()].sort((a, b) => Math.abs(b - i) - Math.abs(a - i));
      for (const k of far.slice(0, this.bitmaps.size - this.cache)) { this.bitmaps.get(k)?.close(); this.bitmaps.delete(k); }
    }
  }

  private decode(i: number) {
    if (i < 0 || i >= this.count || this.bitmaps.has(i) || this.decoding.has(i) || this.decoding.size > 5) return;
    const blob = this.blobs[i];
    if (!blob) return;
    this.decoding.add(i);
    createImageBitmap(blob).then(bmp => {
      this.decoding.delete(i);
      if (this.disposed) { bmp.close(); return; }
      this.bitmaps.set(i, bmp);
      if (!this.ready && Math.abs(i - this.focus) < 20) { this.ready = true; this.dispatchEvent(new Event("loadeddata")); }
      // keep the window filling up
      if (Math.abs(i - this.focus) < 18) this.want(this.focus);
    }, () => { this.decoding.delete(i); });
  }

  private async load() {
    // first the moments the visit starts on, then a coarse pass over the whole take, then the rest
    const order: number[] = [];
    const seen = new Set<number>();
    const add = (i: number) => { if (i >= 0 && i < this.count && !seen.has(i)) { seen.add(i); order.push(i); } };
    for (let i = 0; i < 30; i++) add(i);
    this.priority.forEach(p => { for (let d = -3; d <= 3; d++) add(p + d); });
    for (let step = 8; step >= 1; step = Math.floor(step / 2)) for (let i = 0; i < this.count; i += step) add(i);
    let next = 0, errors = 0;
    const asked = new Set<number>();
    const pick = () => {
      // playing (the preview): the next two seconds of the take before anything else
      if (this.playing) for (let i = this.frame(); i < Math.min(this.count, this.frame() + 48); i++) if (!asked.has(i)) return i;
      while (next < order.length && asked.has(order[next])) next++;
      return next < order.length ? order[next++] : -1;
    };
    const worker = async () => {
      while (!this.disposed) {
        const i = pick();
        if (i < 0) break;
        asked.add(i);
        try {
          const r = await fetch(`${this.base}/${String(i + 1).padStart(3, "0")}.webp`);
          if (!r.ok || !(r.headers.get("content-type") ?? "").includes("image")) throw new Error(String(r.status));
          this.blobs[i] = await r.blob();
          if (Math.abs(i - this.focus) <= 16) this.decode(i);
        } catch {
          errors++;
          if (!this.ready && errors > 4 && !this.failed) { this.failed = true; this.dispatchEvent(new Event("error")); return; }
        }
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
  }

  dispose() { this.disposed = true; this.bitmaps.forEach(b => b.close()); this.bitmaps.clear(); }
}
