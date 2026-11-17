// Extra set dressing and cue-driven animations for the procedural studio:
// payment corner (sideboard, POS terminal, card/phone, cash box, desk lamp, vinyls), wall clock,
// ON AIR sign, guitar on a stand, floor lamp, reflection filter, coffee mug with steam,
// dust motes and a volumetric cone under the vocal key light.
// Everything is generated at runtime (no external models), same as build-studio.ts.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { ShotId } from "../cinema.ts";

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (a: number, b: number, v: number) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeOut = (t: number) => 1 - (1 - clamp01(t)) ** 3;
const easeInOut = (t: number) => { t = clamp01(t); return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2; };

export type ExtrasKit = {
  scene: THREE.Scene;
  hi: boolean;
  track: <T extends { dispose: () => void }>(o: T) => T;
  std: (p: THREE.MeshStandardMaterialParameters) => THREE.MeshStandardMaterial;
  phys: (p: THREE.MeshPhysicalMaterialParameters) => THREE.MeshStandardMaterial;
  basic: (c: THREE.ColorRepresentation, extra?: THREE.MeshBasicMaterialParameters) => THREE.MeshBasicMaterial;
  mesh: (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, x?: number, y?: number, z?: number) => THREE.Mesh;
  contact: (x: number, z: number, sx: number, sz: number, y?: number, parent?: THREE.Object3D) => THREE.Mesh;
  mats: {
    walnut: THREE.Material; walnutV: THREE.Material; blackMetal: THREE.Material; gunmetal: THREE.Material; chrome: THREE.Material;
    satin: THREE.Material; plastic: THREE.Material; rubber: THREE.Material; gloss: THREE.Material; leather: THREE.Material; foam: THREE.Material;
    symbol: THREE.Material; led: THREE.Material;
  };
  micHead: THREE.Object3D;
  micKeyFrom: THREE.Vector3;
};

const rbox = (w: number, h: number, d: number, r = 0.01, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2));
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt: number, rb: number, h: number, seg = 28) => new THREE.CylinderGeometry(rt, rb, h, seg);

function canvasTex(w: number, h: number, track: ExtrasKit["track"]) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const t = track(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return { c, ctx: c.getContext("2d")!, t };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export function buildExtras(k: ExtrasKit) {
  const { scene, hi, track, std, phys, basic, mesh, contact, mats } = k;
  const lights: { light: THREE.Light; max: number; from: number; to: number }[] = [];

  /* ====================== PAYMENT CORNER (right wall) ====================== */
  const corner = new THREE.Group(); corner.position.set(4.6, 0, -0.25); corner.rotation.y = -Math.PI / 2; scene.add(corner);
  const TOP = 0.76;
  mesh(rbox(1.7, 0.6, 0.46, 0.012, 2), mats.walnut, corner, 0, 0.42, 0).castShadow = true;
  mesh(rbox(1.76, 0.04, 0.5, 0.01, 2), mats.walnut, corner, 0, TOP - 0.02, 0).receiveShadow = true;
  for (const x of [-0.567, 0, 0.567]) {
    mesh(rbox(0.55, 0.54, 0.012, 0.006, 1), mats.walnutV, corner, x, 0.42, 0.232);
    mesh(rbox(0.012, 0.16, 0.02, 0.005, 1), mats.chrome, corner, x + 0.2, 0.5, 0.245);
  }
  mesh(box(1.66, 0.008, 0.008), mats.led, corner, 0, 0.115, 0.226);
  for (const [x, z] of [[-0.8, -0.18], [0.8, -0.18], [-0.8, 0.18], [0.8, 0.18]]) mesh(cyl(0.016, 0.01, 0.12, 12), mats.blackMetal, corner, x, 0.06, z);
  contact(4.6, -0.25, 0.8, 2.1);

  // --- POS terminal on a tilted dock ---
  const pos = new THREE.Group(); pos.position.set(-0.5, TOP + 0.012, 0.04); corner.add(pos);
  mesh(rbox(0.11, 0.024, 0.14, 0.008, 2), mats.plastic, pos, 0, 0, 0);
  const term = new THREE.Group(); term.position.set(0, 0.03, 0); term.rotation.x = 0.38; pos.add(term);
  mesh(rbox(0.088, 0.024, 0.185, 0.012, 3), mats.gloss, term).castShadow = true;
  const posScr = canvasTex(256, 256, track);
  const screenMat = basic("#ffffff", { map: posScr.t });
  const scrMesh = mesh(new THREE.PlaneGeometry(0.07, 0.07), screenMat, term, 0, 0.0136, -0.045); scrMesh.rotation.x = -Math.PI / 2;
  mesh(rbox(0.078, 0.002, 0.08, 0.004, 1), basic("#05070c"), term, 0, 0.0121, -0.045);
  const keyItems: THREE.Vector3[] = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) keyItems.push(v3(-0.024 + c * 0.024, 0.0125, 0.012 + r * 0.016));
  const keyMat = std({ color: "#c9d2e4", roughness: 0.35, metalness: 0.1 });
  const keyGeo = track(rbox(0.018, 0.004, 0.011, 0.002, 1));
  const keyMeshes = keyItems.map(p => { const m = new THREE.Mesh(keyGeo, keyMat); m.position.copy(p); term.add(m); return m; });
  const fnCols = ["#d9534f", "#e6c34a", "#4cbf7a"];
  fnCols.forEach((c, i) => mesh(rbox(0.018, 0.004, 0.011, 0.002, 1), std({ color: c, roughness: 0.4 }), term, -0.024 + i * 0.024, 0.0125, 0.078));
  mesh(box(0.06, 0.006, 0.006), basic("#000000"), term, 0, 0.006, -0.093);                 // receipt slot
  const posLed = mesh(new THREE.CircleGeometry(0.003, 16), basic("#4C83FF"), term, 0.034, 0.0126, -0.084); posLed.rotation.x = -Math.PI / 2;
  const receipt = mesh(new THREE.PlaneGeometry(0.05, 0.08), std({ color: "#f3f1ea", roughness: 0.9, side: THREE.DoubleSide }), term, 0, 0.006, -0.093);
  receipt.rotation.x = 0; receipt.scale.y = 0.001; receipt.position.y = 0.006;

  // payment card (brand-blue, original artwork)
  const cardFace = canvasTex(512, 324, track);
  {
    const g = cardFace.ctx; const W = 512, H = 324;
    const grd = g.createLinearGradient(0, 0, W, H); grd.addColorStop(0, "#2b4fc0"); grd.addColorStop(0.55, "#4C83FF"); grd.addColorStop(1, "#0b1838");
    roundRect(g, 0, 0, W, H, 28); g.fillStyle = grd; g.fill();
    g.globalAlpha = 0.18; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(W * 0.85, H * 0.2, 40 + i * 34, 0, Math.PI * 2); g.strokeStyle = "#ffffff"; g.lineWidth = 2; g.stroke(); } g.globalAlpha = 1;
    roundRect(g, 46, 112, 70, 54, 9); g.fillStyle = "#d8c27a"; g.fill(); g.strokeStyle = "#a8924a"; g.lineWidth = 2; g.stroke();
    g.fillStyle = "#EEF3FF"; g.font = "600 34px 'Space Grotesk', sans-serif"; g.fillText("•••• •••• •••• 2026", 46, 230);
    g.font = "700 30px 'Space Grotesk', sans-serif"; g.fillText("GENKS", 46, 68);
    g.font = "500 20px 'Space Grotesk', sans-serif"; g.globalAlpha = 0.8; g.fillText("STUDIO CARD · DEMO", 46, 282); g.globalAlpha = 1;
    cardFace.t.needsUpdate = true;
  }
  const card = new THREE.Group(); term.add(card);
  mesh(rbox(0.054, 0.0009, 0.0856, 0.003, 1), std({ color: "#1f3c99", roughness: 0.35, metalness: 0.4 }), card);
  const cardTop = mesh(new THREE.PlaneGeometry(0.054, 0.0856), std({ map: cardFace.t, roughness: 0.3, metalness: 0.25 }), card, 0, 0.0006, 0);
  cardTop.rotation.x = -Math.PI / 2; cardTop.rotation.z = Math.PI / 2;
  card.visible = false;
  // phone (wallet payments)
  const phone = new THREE.Group(); term.add(phone);
  mesh(rbox(0.072, 0.008, 0.148, 0.01, 3), mats.gloss, phone);
  const phoneScr = canvasTex(192, 384, track);
  const phoneMesh = mesh(new THREE.PlaneGeometry(0.066, 0.14), basic("#ffffff", { map: phoneScr.t }), phone, 0, 0.0042, 0); phoneMesh.rotation.x = -Math.PI / 2;
  phone.visible = false;
  {
    const g = phoneScr.ctx; const grd = g.createLinearGradient(0, 0, 0, 384); grd.addColorStop(0, "#0b1838"); grd.addColorStop(1, "#04070f");
    g.fillStyle = grd; g.fillRect(0, 0, 192, 384);
    roundRect(g, 24, 120, 144, 92, 12); g.fillStyle = "#4C83FF"; g.fill();
    g.fillStyle = "#EEF3FF"; g.font = "700 22px 'Space Grotesk', sans-serif"; g.textAlign = "center"; g.fillText("GENKS", 96, 172);
    g.font = "500 16px 'Space Grotesk', sans-serif"; g.fillText("Tocca per pagare", 96, 262);
    g.beginPath(); g.arc(96, 318, 18, 0, Math.PI * 2); g.strokeStyle = "#9CBFFF"; g.lineWidth = 3; g.stroke();
    phoneScr.t.needsUpdate = true;
  }

  // --- cash box ---
  const cash = new THREE.Group(); cash.position.set(0.05, TOP, 0.02); corner.add(cash);
  const boxPaint = std({ color: "#55627e", metalness: 0.75, roughness: 0.38 });
  mesh(rbox(0.27, 0.085, 0.2, 0.008, 2), boxPaint, cash, 0, 0.0425, 0).castShadow = true;
  mesh(box(0.25, 0.004, 0.18), basic("#0a0d14"), cash, 0, 0.083, 0);
  const lid = new THREE.Group(); lid.position.set(0, 0.085, -0.1); cash.add(lid);
  mesh(rbox(0.272, 0.014, 0.202, 0.006, 2), boxPaint, lid, 0, 0.007, 0.101).castShadow = true;
  mesh(rbox(0.06, 0.008, 0.012, 0.003, 1), mats.chrome, lid, 0, 0.012, 0.2);
  const noteCols = ["#6f8fd6", "#d39a64", "#6f8fd6", "#8aa7e6", "#d39a64"];
  const notes = noteCols.map((c, i) => {
    const n = new THREE.Group(); n.position.set(-0.055 + (i % 2) * 0.11, 0.06 + Math.floor(i / 2) * 0.006, 0.0); cash.add(n);
    mesh(box(0.1, 0.0025, 0.055), std({ color: c, roughness: 0.85 }), n);
    mesh(box(0.03, 0.0027, 0.03), std({ color: "#e9e4d4", roughness: 0.8 }), n, 0.025, 0, 0);
    return n;
  });
  const coins = Array.from({ length: 5 }, (_, i) => mesh(cyl(0.011, 0.011, 0.0025, 20), std({ color: i % 2 ? "#d4b86a" : "#c9ccd4", metalness: 1, roughness: 0.3 }), corner, 0.24 + (i % 3) * 0.022, TOP + 0.0013 + Math.floor(i / 3) * 0.0026, 0.1 + (i % 2) * 0.01));
  void coins;

  // --- desk lamp (warm) ---
  const lamp = new THREE.Group(); lamp.position.set(0.72, TOP, -0.06); corner.add(lamp);
  mesh(cyl(0.07, 0.08, 0.02, 32), mats.blackMetal, lamp, 0, 0.01, 0);
  const arm1 = mesh(cyl(0.007, 0.007, 0.3, 12), mats.satin, lamp, 0, 0.16, 0); arm1.rotation.z = 0.15;
  const arm2 = mesh(cyl(0.007, 0.007, 0.26, 12), mats.satin, lamp, -0.07, 0.38, 0.04); arm2.rotation.set(0.5, 0, -0.6);
  const shade = mesh(new THREE.CylinderGeometry(0.035, 0.085, 0.1, 32, 1, true), std({ color: "#11141d", metalness: 0.6, roughness: 0.4, side: THREE.DoubleSide }), lamp, -0.14, 0.43, 0.13);
  shade.rotation.x = 0.6;
  const bulbMat = basic("#ffd7a8");
  mesh(new THREE.SphereGeometry(0.022, 16, 12), bulbMat, lamp, -0.14, 0.415, 0.15);
  const lampLight = new THREE.PointLight("#ffc890", 0, 2.6, 1.6);
  lampLight.position.set(-0.14, 0.38, 0.17); lamp.add(lampLight);
  lights.push({ light: lampLight, max: 2.4, from: 0.3, to: 0.8 });
  // ceiling pin-spot over the payment corner
  const pin = new THREE.SpotLight("#e4ecff", 0, 4, 0.42, 0.65, 1.3);
  pin.position.set(3.7, 3.3, -0.25);
  const pinTarget = new THREE.Object3D(); pinTarget.position.set(4.55, TOP, -0.3); scene.add(pinTarget); pin.target = pinTarget;
  scene.add(pin);
  lights.push({ light: pin, max: 16, from: 0.25, to: 0.75 });
  if (hi) { pin.castShadow = true; pin.shadow.mapSize.set(1024, 1024); pin.shadow.bias = -0.0005; pin.shadow.radius = 4; pin.shadow.camera.near = 0.5; pin.shadow.camera.far = 5; }

  // --- vinyl records leaning on the wall ---
  const coverHues = [222, 232, 214, 240, 205];
  coverHues.forEach((h, i) => {
    const tx = canvasTex(256, 256, track); const g = tx.ctx;
    const grd = g.createLinearGradient(0, 0, 256, 256); grd.addColorStop(0, `hsl(${h} 70% ${18 + i * 4}%)`); grd.addColorStop(1, "#04070f");
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    g.globalAlpha = 0.6; for (let b = 0; b < 30; b++) { const bh = 20 + Math.abs(Math.sin(b * 0.6 + i)) * 90; g.fillStyle = b % 5 ? "#4C83FF" : "#9CBFFF"; g.fillRect(14 + b * 7.6, 150 - bh / 2, 4, bh); } g.globalAlpha = 1;
    g.fillStyle = "#EEF3FF"; g.font = "700 22px 'Space Grotesk', sans-serif"; g.fillText(["NOTTE", "BLU", "CROMO", "ONDA", "LIVE"][i], 16, 232);
    tx.t.needsUpdate = true;
    const rec = new THREE.Group(); rec.position.set(0.3 + i * 0.03, TOP + 0.155, -0.17 + i * 0.012); rec.rotation.x = -0.16 + i * 0.03; corner.add(rec);
    mesh(box(0.31, 0.31, 0.004), std({ color: "#0a0d14", roughness: 0.7 }), rec);
    mesh(new THREE.PlaneGeometry(0.305, 0.305), std({ map: tx.t, roughness: 0.55 }), rec, 0, 0, 0.0022);
  });
  // a record half out of its sleeve
  const disc = mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.002, 64), std({ color: "#050608", roughness: 0.25, metalness: 0.3 }), corner, 0.43, TOP + 0.17, -0.2);
  disc.rotation.x = Math.PI / 2 - 0.16; disc.position.x = 0.58;

  /* ====================== WALL CLOCK & ON AIR (slat wall) ====================== */
  const clock = new THREE.Group(); clock.position.set(1.95, 2.78, -3.47); scene.add(clock);
  mesh(new THREE.TorusGeometry(0.2, 0.018, 16, 64), mats.satin, clock);
  const face = canvasTex(512, 512, track);
  {
    const g = face.ctx; g.fillStyle = "#e9edf6"; g.beginPath(); g.arc(256, 256, 256, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2, big = i % 5 === 0;
      g.strokeStyle = big ? "#0b1020" : "#5a6378"; g.lineWidth = big ? 12 : 4;
      g.beginPath(); g.moveTo(256 + Math.sin(a) * (big ? 190 : 214), 256 - Math.cos(a) * (big ? 190 : 214)); g.lineTo(256 + Math.sin(a) * 236, 256 - Math.cos(a) * 236); g.stroke();
    }
    g.fillStyle = "#2b4fc0"; g.font = "700 40px 'Space Grotesk', sans-serif"; g.textAlign = "center"; g.fillText("GENKS", 256, 190);
    g.fillStyle = "#5a6378"; g.font = "500 22px 'Space Grotesk', sans-serif"; g.fillText("STUDIO TIME", 256, 340);
    face.t.needsUpdate = true;
  }
  mesh(new THREE.CircleGeometry(0.195, 64), std({ map: face.t, roughness: 0.6 }), clock, 0, 0, 0.004);
  mesh(new THREE.CircleGeometry(0.195, 64), phys({ color: "#ffffff", transparent: true, opacity: 0.06, roughness: 0.05, clearcoat: 1 }), clock, 0, 0, 0.022);
  const hand = (len: number, w: number, z: number, m: THREE.Material) => {
    const pivot = new THREE.Group(); pivot.position.z = z; clock.add(pivot);
    mesh(box(w, len, 0.004), m, pivot, 0, len / 2 - 0.02, 0); return pivot;
  };
  const hHand = hand(0.11, 0.014, 0.01, std({ color: "#0b1020", roughness: 0.4 }));
  const mHand = hand(0.16, 0.009, 0.013, std({ color: "#0b1020", roughness: 0.4 }));
  const sHand = hand(0.17, 0.003, 0.016, basic("#4C83FF"));
  mesh(cyl(0.008, 0.008, 0.012, 16), mats.chrome, clock, 0, 0, 0.018).rotation.x = Math.PI / 2;

  const onAir = new THREE.Group(); onAir.position.set(-1.95, 2.78, -3.47); scene.add(onAir);
  mesh(rbox(0.7, 0.22, 0.06, 0.02, 3), mats.blackMetal, onAir).castShadow = true;
  const airTx = canvasTex(512, 160, track);
  const drawAir = (on: number) => {
    const g = airTx.ctx; g.clearRect(0, 0, 512, 160);
    g.fillStyle = `rgb(${8 + on * 40}, ${10 + on * 30}, ${20 + on * 40})`; g.fillRect(0, 0, 512, 160);
    g.font = "700 96px 'Space Grotesk', sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    if (on > 0.05) { g.shadowColor = "#ff4d5e"; g.shadowBlur = 40 * on; }
    g.fillStyle = on > 0.05 ? `rgba(255, ${110 + (1 - on) * 80}, ${120 + (1 - on) * 80}, ${0.35 + on * 0.65})` : "#2a3044";
    g.fillText("ON AIR", 256, 84);
    airTx.t.needsUpdate = true;
  };
  drawAir(0);
  mesh(new THREE.PlaneGeometry(0.64, 0.18), basic("#ffffff", { map: airTx.t }), onAir, 0, 0, 0.031);
  const airLight = new THREE.PointLight("#ff5c6a", 0, 1.6, 1.8); airLight.position.set(0, 0, 0.25); if (hi) onAir.add(airLight);

  /* ====================== GUITAR ON A STAND ====================== */
  const guitar = new THREE.Group(); guitar.position.set(-3.35, 0, -2.55); guitar.rotation.y = 0.55; scene.add(guitar);
  const body = new THREE.Shape();
  body.moveTo(0, -0.24);
  body.bezierCurveTo(0.2, -0.25, 0.22, -0.06, 0.13, 0.0);
  body.bezierCurveTo(0.1, 0.03, 0.15, 0.12, 0.14, 0.2);
  body.bezierCurveTo(0.12, 0.25, 0.07, 0.2, 0.04, 0.12);
  body.lineTo(-0.04, 0.12);
  body.bezierCurveTo(-0.07, 0.24, -0.14, 0.22, -0.15, 0.16);
  body.bezierCurveTo(-0.16, 0.1, -0.1, 0.03, -0.13, 0.0);
  body.bezierCurveTo(-0.22, -0.06, -0.2, -0.25, 0, -0.24);
  const bodyGeo = new THREE.ExtrudeGeometry(body, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 3, curveSegments: 24 });
  const gtr = new THREE.Group(); gtr.position.set(0, 0.36, 0); gtr.rotation.x = -0.2; guitar.add(gtr);
  const paint = phys({ color: "#1d3fa8", metalness: 0.45, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.06 });
  mesh(bodyGeo, paint, gtr, 0, 0, -0.02).castShadow = true;
  mesh(new THREE.ShapeGeometry(body, 24), std({ color: "#e9edf6", roughness: 0.4 }), gtr, 0, 0, 0.0265).scale.set(0.6, 0.6, 1);
  mesh(rbox(0.05, 0.56, 0.022, 0.008, 2), mats.walnut, gtr, 0, 0.4, 0.02).castShadow = true;
  mesh(rbox(0.052, 0.5, 0.004, 0.002, 1), std({ color: "#1b120d", roughness: 0.6 }), gtr, 0, 0.42, 0.032);
  mesh(rbox(0.075, 0.17, 0.016, 0.01, 2), paint, gtr, 0.008, 0.76, 0.02);
  const frets = Array.from({ length: 16 }, (_, i) => mesh(box(0.05, 0.0018, 0.002), mats.chrome, gtr, 0, 0.18 + 0.48 * (1 - Math.pow(0.94, i + 1)) * 2.2, 0.0345));
  void frets;
  for (let s = 0; s < 6; s++) mesh(box(0.0009, 0.78, 0.0009), mats.chrome, gtr, -0.017 + s * 0.0068, 0.36, 0.037);
  for (const y of [-0.12, -0.04, 0.04]) mesh(rbox(0.07, 0.018, 0.006, 0.003, 1), std({ color: "#0b0e16", roughness: 0.4 }), gtr, 0, y, 0.03);
  for (const [x, y] of [[0.08, -0.15], [0.1, -0.1], [0.11, -0.05]]) mesh(cyl(0.01, 0.011, 0.012, 16), mats.chrome, gtr, x, y, 0.032).rotation.x = Math.PI / 2;
  for (let p = 0; p < 6; p++) mesh(cyl(0.004, 0.004, 0.02, 10), mats.chrome, gtr, (p < 3 ? -0.04 : 0.055), 0.71 + (p % 3) * 0.04, 0.02).rotation.z = Math.PI / 2;
  // A-frame stand
  for (const sx of [-1, 1]) {
    const leg = mesh(cyl(0.008, 0.008, 0.62, 10), mats.blackMetal, guitar, sx * 0.1, 0.3, -0.08); leg.rotation.z = sx * 0.18;
    const foot = mesh(cyl(0.008, 0.008, 0.3, 10), mats.blackMetal, guitar, sx * 0.14, 0.02, 0.02); foot.rotation.x = Math.PI / 2;
  }
  mesh(cyl(0.008, 0.008, 0.26, 10), mats.rubber, guitar, 0, 0.14, 0.06).rotation.z = Math.PI / 2;
  mesh(cyl(0.006, 0.006, 0.7, 10), mats.blackMetal, guitar, 0, 0.55, -0.12).rotation.x = -0.25;
  contact(-3.35, -2.55, 0.55, 0.55);

  /* ====================== FLOOR LAMP by the sofa ====================== */
  const floorLamp = new THREE.Group(); floorLamp.position.set(-4.45, 0, 0.75); scene.add(floorLamp);
  mesh(cyl(0.16, 0.18, 0.03, 32), mats.blackMetal, floorLamp, 0, 0.015, 0);
  mesh(cyl(0.012, 0.012, 1.5, 12), mats.satin, floorLamp, 0, 0.77, 0);
  mesh(new THREE.CylinderGeometry(0.17, 0.22, 0.28, 40, 1, true), std({ color: "#e8dcc6", roughness: 0.95, side: THREE.DoubleSide, emissive: new THREE.Color("#ffb070"), emissiveIntensity: 0 }), floorLamp, 0, 1.56, 0);
  const shadeMat = (floorLamp.children[2] as THREE.Mesh).material as THREE.MeshStandardMaterial;
  const floorLight = new THREE.PointLight("#ffbf80", 0, 3.5, 1.5); floorLight.position.set(0, 1.5, 0); if (hi) floorLamp.add(floorLight);
  lights.push({ light: floorLight, max: 3, from: 0.35, to: 0.85 });
  contact(-4.45, 0.75, 0.6, 0.6);

  /* ====================== REFLECTION FILTER behind the mic ====================== */
  const rf = new THREE.Group(); rf.position.set(0, -0.02, -0.03); k.micHead.add(rf);
  mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 40, 1, true, Math.PI - 1.15, 2.3), std({ color: "#121a30", roughness: 1, side: THREE.DoubleSide }), rf, 0, 0, 0);
  mesh(new THREE.CylinderGeometry(0.212, 0.212, 0.31, 40, 1, true, Math.PI - 1.15, 2.3), std({ color: "#9aa6bf", metalness: 0.9, roughness: 0.45, side: THREE.DoubleSide }), rf, 0, 0, 0);
  const ridges: THREE.Mesh[] = [];
  for (let i = 0; i < 9; i++) {
    const a = Math.PI - 1.05 + i * 0.26;
    ridges.push(mesh(box(0.012, 0.28, 0.03), std({ color: "#0d1426", roughness: 1 }), rf, Math.sin(a) * 0.188, 0, Math.cos(a) * 0.188));
    ridges[i].rotation.y = a;
  }
  mesh(cyl(0.006, 0.006, 0.16, 10), mats.blackMetal, rf, 0, -0.21, -0.2);

  /* ====================== COFFEE MUG with steam ====================== */
  const mug = new THREE.Group(); mug.position.set(-1.48, 0.805, -1.22); scene.add(mug);
  mesh(new THREE.CylinderGeometry(0.04, 0.036, 0.095, 32, 1, true), std({ color: "#e9edf6", roughness: 0.35, side: THREE.DoubleSide }), mug, 0, 0.0475, 0).castShadow = true;
  mesh(new THREE.CircleGeometry(0.036, 32), std({ color: "#e9edf6", roughness: 0.4 }), mug, 0, 0.001, 0).rotation.x = -Math.PI / 2;
  mesh(new THREE.CircleGeometry(0.037, 32), std({ color: "#2a1a10", roughness: 0.15, metalness: 0.1 }), mug, 0, 0.078, 0).rotation.x = -Math.PI / 2;
  mesh(new THREE.TorusGeometry(0.024, 0.006, 10, 24, Math.PI), std({ color: "#e9edf6", roughness: 0.35 }), mug, 0.04, 0.05, 0).rotation.z = -Math.PI / 2;
  mesh(new THREE.CircleGeometry(0.012, 24), mats.symbol, mug, 0, 0.05, 0.0405);
  contact(-1.48, -1.22, 0.15, 0.15, 0.807);

  /* ====================== PARTICLES: dust motes & steam ====================== */
  const pointsMat = (color: string, size: number, opacity: number, blending: THREE.Blending) => track(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uSize: { value: size }, uOpacity: { value: opacity }, uPR: { value: Math.min(window.devicePixelRatio, 2) } },
    vertexShader: `
      attribute vec4 aSeed; uniform float uTime; uniform float uSize; uniform float uPR; varying float vA;
      void main() {
        vec3 p = position;
        float t = uTime * aSeed.w;
        #ifdef STEAM
          float life = fract(uTime * 0.22 + aSeed.x);
          p += vec3(sin(life * 9.0 + aSeed.y * 6.28) * 0.012 * life * 3.0, life * 0.32, cos(life * 7.0 + aSeed.z * 6.28) * 0.01 * life * 3.0);
          vA = smoothstep(0.0, 0.15, life) * (1.0 - life);
          float sz = uSize * (0.6 + life * 2.4);
        #else
          p += vec3(sin(t + aSeed.x * 6.28) * 0.08, sin(t * 0.7 + aSeed.y * 6.28) * 0.06, cos(t * 0.8 + aSeed.z * 6.28) * 0.08);
          vA = 0.45 + 0.55 * sin(uTime * 1.7 * aSeed.w + aSeed.x * 20.0);
          float sz = uSize * (0.5 + aSeed.y);
        #endif
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = sz * uPR * (1.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uOpacity; varying float vA;
      void main() { float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(uColor, a * vA * uOpacity); }`,
  }));
  const makePoints = (n: number, spawn: (i: number, out: THREE.Vector3) => void, mat: THREE.ShaderMaterial) => {
    const pos = new Float32Array(n * 3), seed = new Float32Array(n * 4); const tmp = v3();
    for (let i = 0; i < n; i++) { spawn(i, tmp); pos.set([tmp.x, tmp.y, tmp.z], i * 3); seed.set([Math.random(), Math.random(), Math.random(), 0.15 + Math.random() * 0.35], i * 4); }
    const g = track(new THREE.BufferGeometry()); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 4));
    const p = new THREE.Points(g, mat); p.frustumCulled = false; scene.add(p); return p;
  };
  const dustMat = pointsMat("#cfdcff", 9, 0.55, THREE.AdditiveBlending);
  const dustN = hi ? 520 : 200;
  makePoints(dustN, (i, o) => {
    if (i < dustN * 0.45) { const t = Math.random(); o.lerpVectors(k.micKeyFrom, v3(-0.94, 1.1, 0.95), t).add(v3((Math.random() - 0.5) * t * 0.9, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * t * 0.9)); }
    else o.set((Math.random() - 0.5) * 7, 0.3 + Math.random() * 2.8, -3 + Math.random() * 4.6);
  }, dustMat);
  const steamMat = pointsMat("#e8eefc", 26, 0.22, THREE.NormalBlending);
  steamMat.defines = { STEAM: 1 };
  makePoints(hi ? 40 : 18, (_, o) => o.set(-1.48 + (Math.random() - 0.5) * 0.03, 0.89, -1.22 + (Math.random() - 0.5) * 0.03), steamMat);

  /* ====================== VOLUMETRIC CONE under the vocal key light ====================== */
  const coneTo = v3(-0.94, 1.0, 0.95);
  const coneLen = k.micKeyFrom.distanceTo(coneTo);
  const coneMat = track(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uI: { value: 0.07 }, uColor: { value: new THREE.Color("#a9c2ff") } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uI; uniform vec3 uColor; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ float f = pow(abs(dot(vN, vV)), 2.2); float a = pow(vUv.y, 1.4) * f * uI; gl_FragColor = vec4(uColor * a, a); }`,
  }));
  const cone = new THREE.Mesh(track(new THREE.CylinderGeometry(0.03, Math.tan(0.36) * coneLen, coneLen, 40, 1, true)), coneMat);
  cone.position.copy(k.micKeyFrom).add(coneTo).multiplyScalar(0.5);
  cone.quaternion.setFromUnitVectors(v3(0, 1, 0), k.micKeyFrom.clone().sub(coneTo).normalize());
  cone.renderOrder = 2;
  scene.add(cone);

  /* ====================== CUE STATE & ANIMATION ====================== */
  let cue: ShotId | null = null;
  let cueData: Record<string, string> = {};
  let cueStart = 0;
  let lastT = 0, prevT = 0;
  let airOn = 0, airTarget = 0;
  let pulse = 0;
  // clock: angles (radians, clockwise) animated towards the chosen time
  const ang = { h: 0, m: 0 };
  let clockFrom = { h: 0, m: 0 }, clockTo: { h: number; m: number } | null = null, clockStart = 0;
  const realAngles = () => {
    const d = new Date();
    const m = d.getMinutes() + d.getSeconds() / 60;
    return { h: ((d.getHours() % 12) + m / 60) / 12 * Math.PI * 2, m: (m / 60) * Math.PI * 2, s: (d.getSeconds() + d.getMilliseconds() / 1000) / 60 * Math.PI * 2 };
  };
  { const r = realAngles(); ang.h = r.h; ang.m = r.m; }

  let posDrawn = -1;
  const drawPos = (t: number) => {
    const g = posScr.ctx; const W = 256;
    const state = cue === "pos" ? "ready" : cue === "approved" ? "done" : "idle";
    const el = t - cueStart;
    g.fillStyle = "#06102a"; g.fillRect(0, 0, W, W);
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = "#9CBFFF"; g.font = "600 18px 'Space Grotesk', sans-serif"; g.fillText("GENKS · POS", W / 2, 24);
    if (state === "idle") {
      g.fillStyle = "#EEF3FF"; g.font = "700 30px 'Space Grotesk', sans-serif"; g.fillText("Pronto", W / 2, 128);
      g.fillStyle = "#4C83FF"; g.fillRect(48, 168, 160 * (0.5 + 0.5 * Math.sin(t * 2)), 4);
    } else if (state === "ready") {
      g.fillStyle = "#EEF3FF"; g.font = "700 34px 'Space Grotesk', sans-serif"; g.fillText(cueData.amount ?? (cueData.method === "cash" ? "" : "20,00 €"), W / 2, 74);
      for (let i = 0; i < 3; i++) {
        const ph = (el * 1.3 + i / 3) % 1;
        g.strokeStyle = `rgba(156,191,255,${1 - ph})`; g.lineWidth = 6;
        g.beginPath(); g.arc(W / 2 - 30, 160, 16 + ph * 46, -0.7, 0.7); g.stroke();
      }
      g.fillStyle = "#A9B8D6"; g.font = "500 17px 'Space Grotesk', sans-serif";
      g.fillText(el > 1.1 ? "Elaborazione…" : cueData.method === "wallet" ? "Avvicina il telefono" : "Avvicina la carta", W / 2, 228);
      if (el > 1.1) { g.strokeStyle = "#4C83FF"; g.lineWidth = 6; g.beginPath(); g.arc(W / 2 + 40, 160, 18, el * 6, el * 6 + 4.2); g.stroke(); }
    } else {
      const p = easeOut((el - 0.2) / 0.6);
      g.fillStyle = `rgba(46, 204, 136, ${0.15 + 0.2 * p})`; g.beginPath(); g.arc(W / 2, 118, 64 * (0.6 + 0.4 * p), 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#57e3a1"; g.lineWidth = 10; g.lineCap = "round";
      g.beginPath(); g.arc(W / 2, 118, 56, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p); g.stroke();
      const c = easeOut((el - 0.6) / 0.5);
      if (c > 0) { g.beginPath(); g.moveTo(W / 2 - 26, 120); g.lineTo(W / 2 - 26 + 18 * Math.min(1, c * 2), 120 + 18 * Math.min(1, c * 2)); if (c > 0.5) g.lineTo(W / 2 - 8 + 36 * (c - 0.5) * 2, 138 - 40 * (c - 0.5) * 2); g.stroke(); }
      g.fillStyle = "#EEF3FF"; g.font = "700 28px 'Space Grotesk', sans-serif"; g.fillText("APPROVATO", W / 2, 212);
      if (cueData.amount) { g.fillStyle = "#A9B8D6"; g.font = "500 18px 'Space Grotesk', sans-serif"; g.fillText(cueData.amount, W / 2, 240); }
    }
    posScr.t.needsUpdate = true;
  };
  drawPos(0);

  const setCue = (shot: ShotId | null, data: Record<string, string> = {}) => {
    cue = shot; cueData = data; cueStart = lastT;
    airTarget = shot === "onair" || shot === "mic" ? 1 : 0;
    if (shot === "approved" || (shot === "cash" && data.state === "done")) pulse = 1;
    if (shot === "clock" && data.time) {
      const [hh, mm] = data.time.split(":").map(Number);
      clockFrom = { ...ang };
      const mTo = (mm / 60) * Math.PI * 2;
      const hTo = (((hh % 12) + mm / 60) / 12) * Math.PI * 2;
      // spin forward: at least two full turns of the minute hand
      const fwd = (from: number, to: number, turns: number) => { let d = to - from; while (d < 0) d += Math.PI * 2; return from + d + turns * Math.PI * 2; };
      clockTo = { h: fwd(ang.h, hTo, 0), m: fwd(ang.m, mTo, 2) };
      clockStart = lastT;
    }
    posDrawn = -1;
  };

  const lampBase = bulbMat.color.clone();
  const tick = (t: number, active: boolean, reveal: number) => {
    lastT = t;
    const el = t - cueStart;
    // shader clocks
    dustMat.uniforms.uTime.value = t; steamMat.uniforms.uTime.value = t;
    coneMat.uniforms.uI.value = 0.06 + 0.05 * airOn + 0.02 * Math.sin(t * 0.7);
    // clock hands
    const real = realAngles();
    if (clockTo) {
      const u = easeInOut((t - clockStart) / 1.4);
      ang.h = clockFrom.h + (clockTo.h - clockFrom.h) * u; ang.m = clockFrom.m + (clockTo.m - clockFrom.m) * u;
      if (cue !== "clock" && t - clockStart > 1.5) { clockTo = null; }
    } else { ang.h += (real.h - ang.h) * 0.05; ang.m += (real.m - ang.m) * 0.05; }
    hHand.rotation.z = -ang.h; mHand.rotation.z = -ang.m;
    sHand.rotation.z = -(Math.floor(real.s / (Math.PI * 2) * 60) / 60) * Math.PI * 2 - (active ? 0 : 0);
    // ON AIR neon: flickers on, fades off
    const dt = Math.min(0.1, Math.max(0, t - prevT)); prevT = t;
    if (airTarget > airOn) airOn = airOn + dt * 2.2 * (Math.sin(t * 47) > -0.35 ? 1 : -3); else airOn = airOn - dt * 1.6;
    airOn = clamp01(airOn);
    if (Math.abs(airOn - (onAir.userData.drawn ?? -1)) > 0.02) { drawAir(airOn); onAir.userData.drawn = airOn; }
    airLight.intensity = airOn * 2.2;
    // lamps
    const warm = smooth(0.3, 0.8, reveal);
    bulbMat.color.copy(lampBase).multiplyScalar(0.25 + 0.75 * warm);
    shadeMat.emissiveIntensity = 0.55 * smooth(0.35, 0.85, reveal);
    lights.forEach(l => { l.light.intensity = l.max * smooth(l.from, l.to, reveal) * (l.light === lampLight && (cue === "pos" || cue === "cash" || cue === "approved") ? 1.6 : 1); });
    pulse = Math.max(0, pulse - 0.012);
    // POS: card / phone tap, receipt printing, LED
    const payShot = cue === "pos" || cue === "approved";
    const wallet = cueData.method === "wallet";
    card.visible = payShot && !wallet; phone.visible = payShot && wallet;
    const dev = wallet ? phone : card;
    if (payShot) {
      const tap = cue === "pos" ? Math.sin(Math.PI * clamp01((el - 0.5) / 1.0)) : 0;
      const enter = easeOut(el / 0.6);
      const y = cue === "pos" ? 0.16 - 0.1 * enter - 0.035 * tap : 0.06 + 0.1 * easeInOut(el / 1.4);
      dev.position.set(0.0 + (1 - enter) * 0.12, y, -0.045 + (1 - enter) * 0.05);
      dev.rotation.set(0.1 - 0.1 * tap, 0.3 * (1 - enter), 0.12);
    }
    const printing = cue === "approved" ? clamp01((el - 0.9) / 1.2) : 0;
    receipt.scale.y = Math.max(0.001, printing);
    receipt.position.set(0, 0.006 + 0.04 * printing * Math.sin(0.5), -0.093 - 0.04 * printing);
    receipt.rotation.x = -0.5 - printing * 0.3;
    keyMeshes.forEach((m, i) => { m.position.y = 0.0125 - (cue === "pos" && el > 1.2 && Math.floor((el - 1.2) * 8) % 12 === i ? 0.002 : 0); });
    ((posLed.material as THREE.MeshBasicMaterial).color).set(cue === "approved" ? "#57e3a1" : cue === "pos" ? (Math.sin(t * 10) > 0 ? "#9CBFFF" : "#2b4fc0") : "#4C83FF");
    const posFrame = Math.floor(t * 24);
    if ((payShot || posDrawn < 0 || (posFrame % 12 === 0)) && posFrame !== posDrawn) { drawPos(t); posDrawn = posFrame; }
    // cash box: lid opens, notes fan, then everything is tidied up and the lid closes
    const cashOpen = cue === "cash" ? (cueData.state === "done" ? 1 - easeInOut((el - 1.0) / 0.8) : easeOut(el / 0.9)) : Math.max(0, (lid.userData.open ?? 0) - 0.03);
    lid.userData.open = cashOpen;
    lid.rotation.x = -1.85 * cashOpen;
    notes.forEach((n, i) => {
      const fan = cue === "cash" && cueData.state !== "done" ? easeOut((el - 0.5 - i * 0.08) / 0.6) : cue === "cash" ? 1 - easeInOut((el - 0.3) / 0.6) : 0;
      n.rotation.y = fan * (i - 2) * 0.22;
      n.position.y = 0.06 + Math.floor(i / 2) * 0.006 + fan * (0.02 + i * 0.008);
      n.position.z = fan * 0.02;
    });
  };

  return {
    tick, setCue, lights,
    get pulse() { return pulse; },
    anchors: { pos: scrMesh, cash, clock, onAir, guitar, mug, lamp },
  };
}
