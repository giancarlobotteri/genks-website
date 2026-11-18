// Printed details of the mixing console and the microphone grille, drawn by code (original artwork).
import * as THREE from "three";

export const CONSOLE = {
  CH: 20, PITCH: 0.056, X0: -0.67,
  /** knob rows (z, mixer space) and their legends */
  KNOB_Z: [-0.055, -0.107, -0.159, -0.211],
  KNOB_LABELS: ["LOW", "MID", "HIGH", "GAIN"],
  FADER_Z: 0.175, FADER_TRAVEL: 0.085,
  MASTER_X: 0.61,
  W: 1.46, D: 0.58,
};
export const chX = (i: number) => CONSOLE.X0 + i * CONSOLE.PITCH + (i >= 10 ? 0.02 : 0);
export const TRACKS = ["KICK", "SNARE", "HATS", "PERC", "808", "BASS", "KEYS", "PAD", "GTR", "FX", "VOX", "DBL", "ADLIB", "HARM", "CHOIR", "STR", "BUS A", "BUS B", "VERB", "DLY"];

/** Top plate of the console: anodised metal, knob scales, fader dB scales, legends, channel numbers. */
export function consoleSilkscreen(width: number) {
  const { W, D } = CONSOLE;
  const h = Math.round(width * (D / W) / 4) * 4;
  const c = document.createElement("canvas");
  c.width = width; c.height = h;
  const ctx = c.getContext("2d")!;
  const k = width / W; // px per metre
  const X = (x: number) => (x + W / 2) * k, Z = (z: number) => (z + D / 2) * k;
  ctx.fillStyle = "#121722"; ctx.fillRect(0, 0, width, h);
  // brushed anodising
  for (let i = 0; i < h; i += 1) {
    ctx.fillStyle = `rgba(${i % 3 ? 255 : 0},${i % 3 ? 255 : 0},${i % 3 ? 255 : 0},${0.012 + ((i * 7919) % 13) / 900})`;
    ctx.fillRect(0, i, width, 1);
  }
  // section panels
  ctx.fillStyle = "rgba(76,131,255,0.05)";
  ctx.fillRect(X(-0.72), Z(-0.245), X(0.45) - X(-0.72), Z(-0.03) - Z(-0.245));
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(X(0.5), Z(-0.28), X(0.72) - X(0.5), Z(0.28) - Z(-0.28));
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const px = (m: number) => Math.max(6, Math.round(m * k));
  for (let i = 0; i < CONSOLE.CH; i++) {
    const x = chX(i);
    // strip separators
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.fillRect(X(x + CONSOLE.PITCH / 2) - 0.5, Z(-0.25), 1, Z(0.28) - Z(-0.25));
    // knob scales: 11 ticks from 7 to 5 o'clock
    CONSOLE.KNOB_Z.forEach((kz, row) => {
      ctx.strokeStyle = row === 3 ? "rgba(156,191,255,0.75)" : "rgba(220,228,245,0.6)";
      ctx.lineWidth = Math.max(1, k * 0.0009);
      for (let t = 0; t <= 10; t++) {
        const a = -Math.PI * 0.75 + (t / 10) * Math.PI * 1.5 - Math.PI / 2;
        const r0 = 0.0158, r1 = t % 5 === 0 ? 0.0198 : 0.018;
        ctx.beginPath();
        ctx.moveTo(X(x + Math.cos(a) * r0), Z(kz + Math.sin(a) * r0));
        ctx.lineTo(X(x + Math.cos(a) * r1), Z(kz + Math.sin(a) * r1));
        ctx.stroke();
      }
    });
    // fader dB scale
    ctx.fillStyle = "rgba(220,228,245,0.55)";
    [10, 5, 0, -5, -10, -20, -30, -50].forEach((db, j) => {
      const z = CONSOLE.FADER_Z - CONSOLE.FADER_TRAVEL + (j / 7) * CONSOLE.FADER_TRAVEL * 2;
      const long = db === 0;
      ctx.fillStyle = long ? "rgba(76,131,255,0.95)" : "rgba(220,228,245,0.5)";
      ctx.fillRect(X(x - 0.0115), Z(z) - 0.5, (long ? 0.008 : 0.005) * k, Math.max(1, k * 0.0008));
      if (i === 0 || i === 10) {
        ctx.fillStyle = "rgba(220,228,245,0.55)";
        ctx.font = `600 ${px(0.0042)}px "Space Grotesk", sans-serif`;
        ctx.fillText(db > 0 ? `+${db}` : String(db), X(x - 0.022), Z(z));
      }
    });
    // MUTE / SOLO legends and channel number
    ctx.fillStyle = "rgba(220,228,245,0.5)";
    ctx.font = `600 ${px(0.0034)}px "Space Grotesk", sans-serif`;
    ctx.fillText("M", X(x - 0.01), Z(0.058));
    ctx.fillText("S", X(x + 0.01), Z(0.058));
    ctx.fillStyle = "rgba(220,228,245,0.8)";
    ctx.font = `700 ${px(0.0062)}px "Space Grotesk", sans-serif`;
    ctx.fillText(String(i + 1), X(x), Z(0.282));
  }
  // row legends on the left edge
  ctx.font = `700 ${px(0.0044)}px "Space Grotesk", sans-serif`;
  CONSOLE.KNOB_Z.forEach((kz, row) => { ctx.fillStyle = row === 3 ? "rgba(156,191,255,0.9)" : "rgba(220,228,245,0.6)"; ctx.fillText(CONSOLE.KNOB_LABELS[row], X(-0.705), Z(kz)); });
  // master section
  ctx.fillStyle = "rgba(156,191,255,0.9)";
  ctx.font = `700 ${px(0.0085)}px "Space Grotesk", sans-serif`;
  ctx.fillText("MASTER", X(CONSOLE.MASTER_X), Z(0.07));
  ctx.fillStyle = "rgba(220,228,245,0.55)";
  ctx.font = `600 ${px(0.0045)}px "Space Grotesk", sans-serif`;
  ctx.fillText("STUDIO CONSOLE · 20 CH", X(CONSOLE.MASTER_X), Z(0.272));
  ctx.fillText("MONITOR", X(CONSOLE.MASTER_X), Z(-0.165));
  ctx.strokeStyle = "rgba(220,228,245,0.55)"; ctx.lineWidth = Math.max(1, k * 0.0009);
  for (let t = 0; t <= 20; t++) {
    const a = -Math.PI * 0.75 + (t / 20) * Math.PI * 1.5 - Math.PI / 2, r0 = 0.04, r1 = t % 5 === 0 ? 0.047 : 0.044;
    ctx.beginPath(); ctx.moveTo(X(CONSOLE.MASTER_X + Math.cos(a) * r0), Z(-0.12 + Math.sin(a) * r0)); ctx.lineTo(X(CONSOLE.MASTER_X + Math.cos(a) * r1), Z(-0.12 + Math.sin(a) * r1)); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** Back-lit scribble strips with the track names. */
export function scribbleTexture() {
  const n = CONSOLE.CH, cw = 96, ch = 28;
  const c = document.createElement("canvas");
  c.width = n * cw; c.height = ch;
  const ctx = c.getContext("2d")!;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = `700 15px "Space Grotesk", sans-serif`;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = "#030712"; ctx.fillRect(i * cw, 0, cw, ch);
    ctx.fillStyle = i >= 16 ? "#16306e" : "#0d1f4a"; ctx.fillRect(i * cw + 6, 3, cw - 12, ch - 6);
    ctx.fillStyle = "#cfe0ff"; ctx.fillText(TRACKS[i], i * cw + cw / 2, ch / 2 + 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Woven wire for alpha maps: white wire, black holes; tiles seamlessly. */
export function wireTexture(size: number, cells: number, wire = 0.34) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, size, size);
  const st = size / cells;
  ctx.fillStyle = "#fff";
  for (let i = 0; i < cells; i++) {
    ctx.fillRect(i * st - (st * wire) / 2, 0, st * wire, size);
    ctx.fillRect(0, i * st - (st * wire) / 2, size, st * wire);
  }
  // wrap the half-wires of the first row/column so the tile is seamless
  ctx.fillRect(size - (st * wire) / 2, 0, (st * wire) / 2, size);
  ctx.fillRect(0, size - (st * wire) / 2, size, (st * wire) / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

/** Fluted knob body (one geometry shared by every knob). */
export function flutedKnob(rTop: number, rBottom: number, height: number, flutes = 18) {
  const g = new THREE.CylinderGeometry(rTop, rBottom, height, flutes * 3, 1);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z);
    if (r < Math.min(rTop, rBottom) * 0.7) continue;
    const a = Math.atan2(z, x), f = 1 - 0.06 * Math.max(0, Math.cos(a * flutes));
    p.setX(i, x * f); p.setZ(i, z * f);
  }
  g.computeVertexNormals();
  return g;
}

/** Fader cap with two ridges and a finger groove, centred on X, bottom at y = 0. */
export function faderCap() {
  const s = new THREE.Shape();
  s.moveTo(-0.022, 0);
  s.lineTo(0.022, 0);
  s.lineTo(0.022, 0.0135);
  s.quadraticCurveTo(0.021, 0.0192, 0.017, 0.0192);
  s.quadraticCurveTo(0.0, 0.0125, -0.017, 0.0192);
  s.quadraticCurveTo(-0.021, 0.0192, -0.022, 0.0135);
  s.lineTo(-0.022, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.021, bevelEnabled: true, bevelThickness: 0.0016, bevelSize: 0.0012, bevelSegments: 2, curveSegments: 10 });
  g.translate(0, 0, -0.0105);
  g.rotateY(Math.PI / 2);
  g.computeVertexNormals();
  return g;
}
