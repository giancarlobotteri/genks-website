// Procedural PBR textures drawn on canvases at runtime: original, no downloads, no licences.
import * as THREE from "three";
import { FILM } from "../lib/film.ts";
import { rng } from "../lib/music.ts";

type Draw = (ctx: CanvasRenderingContext2D, size: number, r: () => number) => void;

function canvasTex(size: number, seed: number, draw: Draw, srgb = true, repeat?: [number, number]) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  draw(ctx, size, rng(seed));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  return t;
}

/** Fine value noise over the whole canvas. */
function speckle(ctx: CanvasRenderingContext2D, size: number, r: () => number, amount: number, alpha: number) {
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amount;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
  void alpha;
}

function grain(ctx: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, r: () => number, dark: string, light: string, vertical: boolean) {
  const lines = Math.floor((vertical ? w : h) * 0.9);
  for (let i = 0; i < lines; i++) {
    const p = r();
    ctx.strokeStyle = r() > 0.5 ? dark : light;
    ctx.globalAlpha = 0.04 + r() * 0.16;
    ctx.lineWidth = 0.5 + r() * 1.6;
    ctx.beginPath();
    const wob = 2 + r() * 6, ph = r() * 6.28, fr = 0.004 + r() * 0.012;
    const steps = 24;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const off = Math.sin(t * (vertical ? h : w) * fr + ph) * wob;
      const x = vertical ? x0 + p * w + off : x0 + t * w;
      const y = vertical ? y0 + t * h : y0 + p * h + off;
      if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** Dark walnut with long grain. `planks` > 0 draws floorboards with seams. */
export function woodTexture(size: number, seed: number, base = "#3a2a22", planks = 0, repeat?: [number, number]) {
  return canvasTex(size, seed, (ctx, s, r) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, s, s);
    if (planks > 0) {
      const pw = s / planks;
      for (let i = 0; i < planks; i++) {
        const shade = 0.82 + r() * 0.36;
        ctx.fillStyle = `rgba(${shade > 1 ? "255,235,210" : "0,0,0"},${Math.abs(shade - 1) * 0.5})`;
        ctx.fillRect(i * pw, 0, pw, s);
        ctx.save(); ctx.beginPath(); ctx.rect(i * pw, 0, pw, s); ctx.clip();
        grain(ctx, i * pw, 0, pw, s, r, "#120b08", "#7a5a44", true);
        ctx.restore();
        ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(i * pw, 0, 1.5, s);
        const joint = r() * s;
        ctx.fillRect(i * pw, joint, pw, 1.5);
      }
    } else {
      grain(ctx, 0, 0, s, s, r, "#140c08", "#80604a", false);
      for (let k = 0; k < 3; k++) {
        const x = r() * s, y = r() * s;
        const g = ctx.createRadialGradient(x, y, 1, x, y, 26 + r() * 30);
        g.addColorStop(0, "rgba(15,8,5,.5)"); g.addColorStop(1, "rgba(15,8,5,0)");
        ctx.fillStyle = g; ctx.fillRect(x - 60, y - 60, 120, 120);
      }
    }
    speckle(ctx, s, r, 10, 1);
  }, true, repeat);
}

/** Roughness companion for wood/floor: mid-grey with streaks. */
export function streakRoughness(size: number, seed: number, base = 150, vertical = false, repeat?: [number, number]) {
  return canvasTex(size, seed, (ctx, s, r) => {
    ctx.fillStyle = `rgb(${base},${base},${base})`; ctx.fillRect(0, 0, s, s);
    grain(ctx, 0, 0, s, s, r, "#404040", "#e0e0e0", vertical);
    speckle(ctx, s, r, 26, 1);
  }, false, repeat);
}

/** Brushed aluminium: fine horizontal streaks, used as roughness + subtle colour map. */
export function brushedTexture(size: number, seed: number, base = "#8f9bb2") {
  return canvasTex(size, seed, (ctx, s, r) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y++) {
      ctx.globalAlpha = 0.05 + r() * 0.22;
      ctx.fillStyle = r() > 0.5 ? "#ffffff" : "#000000";
      ctx.fillRect(0, y, s, 1);
    }
    ctx.globalAlpha = 1;
  });
}

/** Woven acoustic fabric: colour + reusable as bump map. */
export function fabricTexture(size: number, seed: number, base = "#16213f", repeat?: [number, number]) {
  return canvasTex(size, seed, (ctx, s, r) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, s, s);
    const step = 4;
    for (let y = 0; y < s; y += step) {
      for (let x = 0; x < s; x += step) {
        const over = ((x + y) / step) % 2 === 0;
        ctx.fillStyle = over ? `rgba(255,255,255,${0.05 + r() * 0.06})` : `rgba(0,0,0,${0.12 + r() * 0.12})`;
        ctx.fillRect(x, y, step - 1, step - 1);
      }
    }
    speckle(ctx, s, r, 14, 1);
  }, true, repeat);
}

/** Fine metal mesh (microphone grille, speaker grille, pop filter): colour/alpha/bump in one. */
export function meshTexture(size: number, cells: number, bg = "#0a0d14", wire = "#c9d4ea") {
  return canvasTex(size, 1, (ctx, s) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, s, s);
    const st = s / cells;
    ctx.strokeStyle = wire; ctx.lineWidth = st * 0.34;
    for (let i = 0; i <= cells; i++) {
      ctx.beginPath(); ctx.moveTo(i * st, 0); ctx.lineTo(i * st, s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * st); ctx.lineTo(s, i * st); ctx.stroke();
    }
  });
}

/** Soft noise (leather, rubber, powder-coated metal) for bump/roughness. */
export function noiseTexture(size: number, seed: number, base = 128, amount = 60, repeat?: [number, number]) {
  return canvasTex(size, seed, (ctx, s, r) => {
    ctx.fillStyle = `rgb(${base},${base},${base})`; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < s * 6; i++) {
      const x = r() * s, y = r() * s, rad = 1 + r() * 3;
      ctx.fillStyle = `rgba(${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 255 : 0},${0.03 + r() * 0.06})`;
      ctx.beginPath(); ctx.arc(x, y, rad, 0, 6.28); ctx.fill();
    }
    speckle(ctx, s, r, amount, 1);
  }, false, repeat);
}

/** Soft round blob used for fake contact shadows under objects. */
export function shadowBlob() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, "rgba(0,0,0,.85)"); g.addColorStop(0.55, "rgba(0,0,0,.35)"); g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/** A believable DAW arrangement window for the computer screen. */
export function dawTexture() {
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 512;
  const ctx = c.getContext("2d")!;
  const r = rng(91);
  ctx.fillStyle = "#070c1a"; ctx.fillRect(0, 0, 1024, 512);
  ctx.fillStyle = "#0e1730"; ctx.fillRect(0, 0, 1024, 30);
  ctx.fillStyle = "#9CBFFF"; ctx.font = "600 13px sans-serif"; ctx.fillText(FILM ? "Sessione" : "GENKS · Sessione", 12, 20);
  for (let i = 0; i < 5; i++) { ctx.fillStyle = i === 1 ? "#4C83FF" : "#22335e"; ctx.fillRect(470 + i * 26, 8, 18, 14); }
  ctx.fillStyle = "#b7c5de"; ctx.font = "12px monospace"; ctx.fillText("142.00 BPM   4/4   F#m   00:01:24.310", 700, 20);
  // ruler
  ctx.fillStyle = "#0b1226"; ctx.fillRect(150, 30, 874, 18);
  ctx.fillStyle = "#56699a"; ctx.font = "10px monospace";
  for (let b = 0; b < 22; b++) { ctx.fillRect(150 + b * 40, 30, 1, 18); ctx.fillText(String(b + 1), 154 + b * 40, 43); }
  const rows = 11, rh = 34, top = 50;
  const cols = ["#4C83FF", "#9CBFFF", "#5b6ee8", "#3fa7ff", "#7f8cff", "#4C83FF"];
  for (let t = 0; t < rows; t++) {
    const y = top + t * rh;
    ctx.fillStyle = t % 2 ? "#0a1124" : "#0c142a"; ctx.fillRect(0, y, 1024, rh - 1);
    ctx.fillStyle = "#101b38"; ctx.fillRect(0, y, 148, rh - 1);
    ctx.fillStyle = cols[t % cols.length]; ctx.fillRect(0, y, 4, rh - 1);
    ctx.fillStyle = "#b7c5de"; ctx.font = "11px sans-serif";
    ctx.fillText(["Kick", "808", "Snare", "Hi-hat", "Perc", "Pad", "Keys", "Lead Vox", "Doppie", "Ad-lib", "FX"][t], 12, y + 20);
    ctx.fillStyle = "#1c2b55"; ctx.fillRect(96, y + 10, 44, 6);
    ctx.fillStyle = "#4C83FF"; ctx.fillRect(96, y + 10, 12 + r() * 30, 6);
    let x = 150 + Math.floor(r() * 3) * 40;
    while (x < 1000) {
      const w = (1 + Math.floor(r() * 5)) * 40;
      if (r() > 0.22) {
        ctx.fillStyle = cols[t % cols.length]; ctx.globalAlpha = 0.28; ctx.fillRect(x + 1, y + 3, w - 2, rh - 7); ctx.globalAlpha = 1;
        ctx.fillStyle = cols[t % cols.length];
        ctx.fillRect(x + 1, y + 3, w - 2, 3);
        for (let px = 3; px < w - 3; px += 2) {
          const a = Math.abs(Math.sin(px * 0.21 + t) * Math.sin(px * 0.037 * (t + 2))) * (0.35 + r() * 0.65);
          ctx.fillRect(x + px, y + 19 - a * 10, 1, a * 20 + 1);
        }
      }
      x += w;
    }
  }
  ctx.fillStyle = "#ffffff"; ctx.fillRect(486, 30, 1.5, 482);
  // mixer strip at the bottom
  ctx.fillStyle = "#0b1226"; ctx.fillRect(0, 426, 1024, 86);
  for (let i = 0; i < 26; i++) {
    const x = 10 + i * 39;
    ctx.fillStyle = "#16234a"; ctx.fillRect(x, 434, 30, 70);
    const lv = 10 + r() * 52;
    ctx.fillStyle = lv > 52 ? "#9CBFFF" : "#4C83FF"; ctx.fillRect(x + 20, 500 - lv, 6, lv);
    ctx.fillStyle = "#b7c5de"; ctx.fillRect(x + 6, 448 + r() * 36, 10, 5);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
