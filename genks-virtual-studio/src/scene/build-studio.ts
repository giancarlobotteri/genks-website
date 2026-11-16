// Procedural, original 3D studio (three.js, MIT). No external models, textures or HDRIs:
// geometry, PBR materials and lighting are generated at runtime.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { loadPhotoAssets } from "./photo-assets.ts";
import { brushedTexture, dawTexture, fabricTexture, meshTexture, noiseTexture, shadowBlob, streakRoughness, woodTexture } from "./textures.ts";

export type Quality = "high" | "low";

export type StudioRig = {
  scene: THREE.Scene;
  anchors: { mic: THREE.Object3D; mixer: THREE.Object3D; display: THREE.Object3D; monitors: THREE.Object3D; rack: THREE.Object3D };
  /** 0..1 progressive reveal of the studio lights. */
  setReveal: (v: number) => void;
  /** Called every frame; `t` seconds, `active` = animate meters/faders. */
  tick: (t: number, active: boolean) => void;
  dispose: () => void;
};

const BLUE = new THREE.Color("#4C83FF");
const BLUE_LIGHT = new THREE.Color("#9CBFFF");
const m4 = new THREE.Matrix4();
const q4 = new THREE.Quaternion();
const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** Rasterise the GENKS symbol SVG to a square texture (never deformed). */
function symbolTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const img = new Image();
  img.onload = () => { canvas.getContext("2d")!.drawImage(img, 0, 0, 512, 512); tex.needsUpdate = true; };
  img.src = "/brand/genks-symbol.svg";
  return tex;
}

/** Small HDR "light studio" rendered into the environment map: gives metals real softbox reflections. */
function buildEnvironment(renderer: THREE.WebGLRenderer) {
  const env = new THREE.Scene();
  env.background = new THREE.Color("#02040a");
  const panel = (w: number, h: number, color: string, power: number, pos: THREE.Vector3, look: THREE.Vector3) => {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(power), side: THREE.DoubleSide });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    p.position.copy(pos); p.lookAt(look); env.add(p);
  };
  panel(5, 2.5, "#dfe8ff", 9, v3(0, 5, 1), v3());          // overhead softbox
  panel(1.2, 4, "#4C83FF", 14, v3(-6, 1.5, -2), v3());      // blue strip left
  panel(1.2, 4, "#4C83FF", 14, v3(6, 1.5, -2), v3());       // blue strip right
  panel(6, 0.5, "#9CBFFF", 10, v3(0, 0.6, -6), v3());       // low back strip
  panel(2.2, 1.4, "#ffffff", 5, v3(2.5, 2.5, 6), v3());     // front fill
  panel(0.8, 0.8, "#ffd9b0", 6, v3(-4, 3.5, 4), v3());      // small warm kicker
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.035).texture;
  env.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
  pmrem.dispose();
  return tex;
}

export function buildStudio(renderer: THREE.WebGLRenderer, quality: Quality): StudioRig {
  const hi = quality === "high";
  const TS = hi ? 1024 : 512;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#060B17");
  scene.fog = new THREE.FogExp2("#060B17", 0.085);
  const envTex = buildEnvironment(renderer);
  scene.environment = envTex;
  scene.environmentIntensity = 0.55;
  if (hi) RectAreaLightUniformsLib.init();

  const disposables: { dispose: () => void }[] = [envTex];
  const track = <T extends { dispose: () => void }>(o: T) => { disposables.push(o); return o; };
  const std = (p: THREE.MeshStandardMaterialParameters) => track(new THREE.MeshStandardMaterial(p));
  // clearcoat only where the GPU can afford it
  const phys = (p: THREE.MeshPhysicalMaterialParameters) => {
    if (hi) return track(new THREE.MeshPhysicalMaterial(p));
    const { clearcoat, clearcoatRoughness, ...rest } = p;
    void clearcoat; void clearcoatRoughness;
    return track(new THREE.MeshStandardMaterial(rest));
  };
  const basic = (color: THREE.ColorRepresentation, extra: THREE.MeshBasicMaterialParameters = {}) => track(new THREE.MeshBasicMaterial({ color, toneMapped: false, ...extra }));
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(track(g), m); o.position.set(x, y, z); parent.add(o); return o;
  };
  const rbox = (w: number, h: number, d: number, r = 0.01, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2));
  const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
  const cyl = (rt: number, rb: number, h: number, seg = 28) => new THREE.CylinderGeometry(rt, rb, h, seg);
  /** One draw call for many copies. */
  const instanced = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, items: { p: THREE.Vector3; s?: THREE.Vector3; r?: THREE.Euler; c?: THREE.Color }[]) => {
    const im = new THREE.InstancedMesh(track(g), m, items.length);
    items.forEach((it, i) => {
      q4.setFromEuler(it.r ?? new THREE.Euler());
      im.setMatrixAt(i, m4.compose(it.p, q4, it.s ?? v3(1, 1, 1)));
      if (it.c) im.setColorAt(i, it.c);
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    parent.add(im);
    return im;
  };

  /* ---------- textures ---------- */
  const tWalnut = track(woodTexture(TS, 5, "#3b2a21"));
  const tWalnutR = track(streakRoughness(TS / 2, 6, 120));
  const tFloor = track(woodTexture(TS, 9, "#2a2019", 8, [4, 3]));
  const tFloorR = track(streakRoughness(TS / 2, 10, 105, true, [4, 3]));
  const tFabric = track(fabricTexture(TS / 2, 3, "#151f3c", [3, 3]));
  const tFabricDark = track(fabricTexture(TS / 2, 4, "#0c1226", [3, 3]));
  const tRug = track(fabricTexture(TS / 2, 8, "#101a36", [8, 6]));
  const tBrushed = track(brushedTexture(TS / 2, 2));
  const tBrushedDark = track(brushedTexture(TS / 2, 12, "#2a3144"));
  const tNoise = track(noiseTexture(256, 7, 128, 70, [3, 3]));
  const tGrille = track(meshTexture(256, 26)); tGrille.repeat.set(3, 2);
  const tPop = track(meshTexture(512, 90, "#000000", "#ffffff"));
  const tSymbol = track(symbolTexture());
  const tBlob = track(shadowBlob());

  /* ---------- materials ---------- */
  const mWalnut = std({ map: tWalnut, roughnessMap: tWalnutR, roughness: 0.75, metalness: 0 });
  const mWalnutV = std({ map: tWalnut, roughnessMap: tWalnutR, roughness: 0.75, metalness: 0 }); // vertical grain (slats, frames)
  const mFloor = std({ map: tFloor, roughnessMap: tFloorR, roughness: 0.62, metalness: 0.05 });
  const mWall = std({ color: "#0c1326", roughness: 0.95, bumpMap: tNoise, bumpScale: 0.4 });
  const mCeil = std({ color: "#070b16", roughness: 1 });
  const mFabric = std({ map: tFabric, bumpMap: tFabric, bumpScale: 0.6, roughness: 1 });
  const mFabricDark = std({ map: tFabricDark, bumpMap: tFabricDark, bumpScale: 0.6, roughness: 1 });
  const mRug = std({ map: tRug, bumpMap: tRug, bumpScale: 1, roughness: 1 });
  const mFoam = std({ color: "#111a33", roughness: 1 });
  const mChrome = std({ color: "#dfe6f5", metalness: 1, roughness: 0.12 });
  const mSatin = std({ color: "#aeb9cf", metalness: 1, roughness: 0.42, roughnessMap: tBrushed, map: tBrushed });
  const mGunmetal = std({ color: "#3a4256", metalness: 0.95, roughness: 0.5, roughnessMap: tBrushedDark });
  const mBlackMetal = std({ color: "#0b0e16", metalness: 0.7, roughness: 0.55, bumpMap: tNoise, bumpScale: 0.15 });
  const mPlastic = std({ color: "#090b12", metalness: 0.1, roughness: 0.6, bumpMap: tNoise, bumpScale: 0.12 });
  const mRubber = std({ color: "#07080c", metalness: 0, roughness: 0.92 });
  const mGloss = phys({ color: "#05070c", metalness: 0.2, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.12 });
  const mLeather = std({ color: "#0a0d16", roughness: 0.55, bumpMap: tNoise, bumpScale: 0.5 });
  const mCone = std({ color: "#0d1018", roughness: 0.7, metalness: 0.1, bumpMap: tNoise, bumpScale: 0.2 });
  const mGrille = std({ map: tGrille, bumpMap: tGrille, bumpScale: 1.2, metalness: 1, roughness: 0.38, color: "#ffffff" });
  const mKeyWhite = std({ color: "#dfe5f0", roughness: 0.3, metalness: 0 });
  const mKeyBlack = std({ color: "#07080c", roughness: 0.28, metalness: 0 });
  const mKnob = std({ color: "#11141d", roughness: 0.45, metalness: 0.3 });
  const mCap = std({ color: "#ffffff", roughness: 0.4, metalness: 0.2 }); // tinted per instance
  const mSymbol = std({ map: tSymbol, metalness: 0.35, roughness: 0.35, emissive: new THREE.Color("#2444b0"), emissiveMap: tSymbol, emissiveIntensity: 0.55 });
  const mLed = basic(BLUE);
  const mLedSoft = basic(BLUE_LIGHT);
  const mStrip = basic(BLUE);
  const mShadow = basic("#000000", { map: tBlob, transparent: true, depthWrite: false, toneMapped: true, opacity: 0.9 });

  const contact = (x: number, z: number, sx: number, sz: number, y = 0.004, parent: THREE.Object3D = scene) => {
    const p = mesh(new THREE.PlaneGeometry(1, 1), mShadow, parent, x, y, z);
    p.rotation.x = -Math.PI / 2; p.scale.set(sx, sz, 1); p.renderOrder = 1;
    return p;
  };

  /* ====================== ROOM ====================== */
  const floor = mesh(new THREE.PlaneGeometry(12, 10), mFloor, scene); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  const rug = mesh(new THREE.PlaneGeometry(4.6, 3.2), mRug, scene, 0, 0.006, -1.0); rug.rotation.x = -Math.PI / 2; rug.receiveShadow = true;
  mesh(new THREE.PlaneGeometry(12, 3.6), mWall, scene, 0, 1.8, -3.6);
  const wl = mesh(new THREE.PlaneGeometry(10, 3.6), mWall, scene, -5, 1.8, 0); wl.rotation.y = Math.PI / 2;
  const wr = mesh(new THREE.PlaneGeometry(10, 3.6), mWall, scene, 5, 1.8, 0); wr.rotation.y = -Math.PI / 2;
  const ceil = mesh(new THREE.PlaneGeometry(12, 10), mCeil, scene, 0, 3.6, 0); ceil.rotation.x = Math.PI / 2;
  mesh(box(12, 0.09, 0.02), mBlackMetal, scene, 0, 0.045, -3.58); // baseboard

  // slat wall (centre of the back wall) with LED lines glowing between the slats
  const slats: { p: THREE.Vector3 }[] = [];
  for (let i = 0; i < 58; i++) slats.push({ p: v3(-2.85 + i * 0.1, 1.75, -3.53) });
  instanced(rbox(0.055, 3.3, 0.05, 0.006, 1), mWalnutV, scene, slats);
  mesh(box(5.9, 3.3, 0.02), std({ color: "#05070d", roughness: 1 }), scene, 0, 1.75, -3.575);
  const stripsH = [0.12, 3.38].map(y => mesh(box(5.8, 0.025, 0.02), mStrip, scene, 0, y, -3.545));
  const stripsV = [-2.98, 2.98].map(x => mesh(box(0.03, 3.3, 0.03), mStrip, scene, x, 1.75, -3.53));
  void stripsH; void stripsV;

  // fabric acoustic panels (framed) on the back wall sides and on the side walls
  const panelGeo = rbox(0.9, 1.5, 0.09, 0.02, 2);
  const frameGeo = rbox(0.96, 1.56, 0.05, 0.01, 1);
  const addPanel = (x: number, y: number, z: number, ry: number, dark: boolean) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; scene.add(g);
    mesh(frameGeo, mWalnutV, g, 0, 0, 0);
    mesh(panelGeo, dark ? mFabricDark : mFabric, g, 0, 0, 0.03);
  };
  [-4.3, -3.3, 3.3, 4.3].forEach((x, i) => addPanel(x, 1.75, -3.55, 0, i % 2 === 0));
  [-2.2, -1.0, 0.3, 1.6].forEach((z, i) => { addPanel(-4.95, 1.75, z, Math.PI / 2, i % 2 === 1); addPanel(4.95, 1.75, z, -Math.PI / 2, i % 2 === 0); });

  // pyramid foam tiles above the side panels (real geometry, one draw call)
  const pyr: { p: THREE.Vector3; r: THREE.Euler }[] = [];
  for (const side of [-1, 1]) {
    for (let a = 0; a < 44; a++) for (let b = 0; b < 5; b++) {
      pyr.push({ p: v3(side * 4.96, 2.78 + b * 0.1, -2.75 + a * 0.1), r: new THREE.Euler(0, Math.PI / 4, side * Math.PI / 2) });
    }
  }
  instanced(new THREE.ConeGeometry(0.0707, 0.09, 4, 1), mFoam, scene, pyr);

  // corner bass traps
  for (const side of [-1, 1]) {
    const bt = mesh(new THREE.CylinderGeometry(0.42, 0.42, 3.5, 3), mFabricDark, scene, side * 4.72, 1.76, -3.32);
    bt.rotation.y = side > 0 ? Math.PI / 12 * 7 : Math.PI / 12 * 5;
  }

  // ceiling cloud with a soft light panel
  mesh(rbox(2.6, 0.1, 1.5, 0.03, 2), mFabricDark, scene, 0, 3.2, -1.2);
  const cloudGlow = mesh(new THREE.PlaneGeometry(2.3, 0.06), basic("#cdd9ff"), scene, 0, 3.145, -0.47); cloudGlow.rotation.x = Math.PI / 2;
  const cloudGlowMat = cloudGlow.material as THREE.MeshBasicMaterial;

  // wall emblem with a backlit halo
  mesh(new THREE.CircleGeometry(0.4, 72), mSymbol, scene, 0, 2.62, -3.49);
  const halo = mesh(new THREE.TorusGeometry(0.43, 0.012, 12, 72), mStrip, scene, 0, 2.62, -3.5);
  void halo;

  /* ====================== DESK ====================== */
  const desk = new THREE.Group(); desk.position.set(0, 0, -1.6); scene.add(desk);
  const deskTop = mesh(rbox(3.2, 0.05, 1.08, 0.015, 3), mWalnut, desk, 0, 0.78, 0); deskTop.castShadow = deskTop.receiveShadow = true;
  mesh(box(3.16, 0.012, 0.012), mLedSoft, desk, 0, 0.752, 0.535);                    // under-edge LED
  const bridge = mesh(rbox(3.0, 0.035, 0.36, 0.012, 2), mWalnut, desk, 0, 1.045, -0.36); bridge.castShadow = bridge.receiveShadow = true;
  for (const x of [-1.46, -0.52, 0.52, 1.46]) mesh(rbox(0.035, 0.24, 0.34, 0.008, 1), mWalnut, desk, x, 0.915, -0.36);
  for (const x of [-1.5, 1.5]) {
    mesh(rbox(0.05, 0.75, 0.05, 0.01, 1), mBlackMetal, desk, x, 0.378, 0.46);
    mesh(rbox(0.05, 0.75, 0.05, 0.01, 1), mBlackMetal, desk, x, 0.378, -0.46);
    mesh(rbox(0.05, 0.05, 0.97, 0.01, 1), mBlackMetal, desk, x, 0.03, 0);
    mesh(rbox(0.05, 0.05, 0.97, 0.01, 1), mBlackMetal, desk, x, 0.72, 0);
  }
  mesh(box(2.96, 0.3, 0.02), mBlackMetal, desk, 0, 0.5, -0.47);                      // modesty panel
  contact(0, -1.6, 4.2, 2.0);
  // rack bays under the bridge
  for (const x of [-0.99, 0.99]) {
    mesh(box(0.86, 0.21, 0.3), mPlastic, desk, x, 0.915, -0.38);
    for (let u = 0; u < 2; u++) {
      mesh(rbox(0.84, 0.085, 0.012, 0.004, 1), mGunmetal, desk, x, 0.865 + u * 0.1, -0.226);
      instanced(cyl(0.011, 0.012, 0.016, 16), mKnob, desk, Array.from({ length: 6 }, (_, i) => ({ p: v3(x - 0.3 + i * 0.075, 0.865 + u * 0.1, -0.212), r: new THREE.Euler(Math.PI / 2, 0, 0) })));
      instanced(box(0.012, 0.012, 0.004), mLed, desk, Array.from({ length: 4 }, (_, i) => ({ p: v3(x + 0.2 + i * 0.04, 0.865 + u * 0.1, -0.218) })));
    }
  }

  /* ====================== MIXER ====================== */
  const mixer = new THREE.Group(); mixer.position.set(0, 0.812, -1.42); mixer.rotation.x = 0.16; scene.add(mixer);
  const mxBody = mesh(rbox(1.5, 0.07, 0.62, 0.012, 3), mBlackMetal, mixer); mxBody.castShadow = true;
  mesh(rbox(1.46, 0.004, 0.58, 0.002, 1), mGunmetal, mixer, 0, 0.0352, 0);            // brushed top plate
  for (const x of [-0.765, 0.765]) mesh(rbox(0.03, 0.1, 0.66, 0.01, 2), mWalnut, mixer, x, 0.008, 0);
  mesh(rbox(1.5, 0.03, 0.07, 0.015, 3), mLeather, mixer, 0, 0.03, 0.335);             // padded armrest

  const CH = 20, PITCH = 0.056, X0 = -0.67;
  const chX = (i: number) => X0 + i * PITCH + (i >= 10 ? 0.02 : 0);
  const slotsI = [], knobsI = [], capsI = [], btnI = [], ledI: { p: THREE.Vector3; c: THREE.Color }[] = [];
  const capCols = [new THREE.Color("#4C83FF"), new THREE.Color("#9CBFFF"), new THREE.Color("#c9d2e4"), new THREE.Color("#2b4fc0")];
  const faders: THREE.Mesh[] = [];
  const faderGeo = track(rbox(0.026, 0.022, 0.044, 0.005, 2));
  for (let i = 0; i < CH; i++) {
    const x = chX(i);
    slotsI.push({ p: v3(x, 0.0375, 0.175) });
    const f = new THREE.Mesh(faderGeo, mSatin); f.position.set(x, 0.049, 0.175); f.castShadow = true; mixer.add(f); faders.push(f);
    for (let k = 0; k < 4; k++) {
      const z = -0.055 - k * 0.052;
      knobsI.push({ p: v3(x, 0.047, z) });
      capsI.push({ p: v3(x, 0.0585, z), c: capCols[k] });
    }
    btnI.push({ p: v3(x - 0.01, 0.0395, 0.045) }, { p: v3(x + 0.01, 0.0395, 0.045) });
    ledI.push({ p: v3(x - 0.01, 0.04, 0.02), c: i % 5 === 0 ? BLUE_LIGHT.clone() : BLUE.clone() });
  }
  instanced(box(0.006, 0.003, 0.2), mPlastic, mixer, slotsI);
  instanced(cyl(0.0125, 0.0145, 0.02, 20), mKnob, mixer, knobsI);
  instanced(cyl(0.0105, 0.0105, 0.004, 20), mCap, mixer, capsI);
  instanced(rbox(0.014, 0.006, 0.014, 0.002, 1), mKnob, mixer, btnI);
  const chLeds = instanced(box(0.005, 0.002, 0.005), basic("#ffffff"), mixer, ledI);
  // master section
  const MX = 0.61;
  mesh(cyl(0.032, 0.036, 0.03, 40), mSatin, mixer, MX, 0.05, -0.12).castShadow = true;
  mesh(cyl(0.02, 0.02, 0.006, 32), mChrome, mixer, MX, 0.068, -0.12);
  instanced(rbox(0.026, 0.008, 0.018, 0.003, 1), mKnob, mixer, Array.from({ length: 5 }, (_, i) => ({ p: v3(MX - 0.06 + i * 0.03, 0.04, 0.0) })));
  instanced(box(0.016, 0.002, 0.004), mLed, mixer, Array.from({ length: 5 }, (_, i) => ({ p: v3(MX - 0.06 + i * 0.03, 0.0445, -0.004) })));
  for (const dx of [-0.03, 0.03]) {
    mesh(box(0.006, 0.003, 0.2), mPlastic, mixer, MX + dx, 0.0375, 0.175);
    const f = new THREE.Mesh(faderGeo, mChrome); f.position.set(MX + dx, 0.049, 0.16); mixer.add(f); faders.push(f);
  }
  // meter bridge
  const mb = new THREE.Group(); mb.position.set(0, 0.105, -0.29); mb.rotation.x = -0.35; mixer.add(mb);
  mesh(rbox(1.5, 0.2, 0.06, 0.012, 3), mBlackMetal, mb).castShadow = true;
  mesh(rbox(0.54, 0.185, 0.008, 0.004, 1), mGloss, mb, 0, 0, 0.031);                  // display bezel
  const dispCanvas = document.createElement("canvas"); dispCanvas.width = 512; dispCanvas.height = 176;
  const dispTex = track(new THREE.CanvasTexture(dispCanvas)); dispTex.colorSpace = THREE.SRGBColorSpace;
  mesh(new THREE.PlaneGeometry(0.5, 0.17), basic("#ffffff", { map: dispTex }), mb, 0, 0, 0.0356);
  mesh(new THREE.CircleGeometry(0.032, 48), mSymbol, mb, 0.66, 0, 0.0312);
  // LED meters: 12 channels × 10 segments on each side of the display
  const SEG = 10;
  const meterCh: number[] = [];
  const meterItems: { p: THREE.Vector3; c: THREE.Color }[] = [];
  for (let c = 0; c < 12; c++) {
    const x = c < 6 ? -0.6 + c * 0.052 : 0.3 + (c - 6) * 0.052;
    meterCh.push(x);
    for (let k = 0; k < SEG; k++) meterItems.push({ p: v3(x, -0.07 + k * 0.0155, 0.0312), c: new THREE.Color("#0a1430") });
  }
  const meters = instanced(box(0.03, 0.011, 0.003), basic("#ffffff"), mb, meterItems);
  const dctx = dispCanvas.getContext("2d")!;
  const drawDisplay = (t: number) => {
    const w = dispCanvas.width, h = dispCanvas.height;
    dctx.fillStyle = "#040a1a"; dctx.fillRect(0, 0, w, h);
    dctx.strokeStyle = "rgba(156,191,255,.16)"; dctx.lineWidth = 1;
    for (let x = 0; x < w; x += 32) { dctx.beginPath(); dctx.moveTo(x, 0); dctx.lineTo(x, h); dctx.stroke(); }
    const n = 64;
    for (let i = 0; i < n; i++) {
      const a = 0.25 + 0.75 * Math.abs(Math.sin(i * 0.42 + t * 1.3) * Math.cos(i * 0.13 - t * 0.7));
      const bh = a * h * 0.78;
      dctx.fillStyle = i % 6 === 0 ? "#9CBFFF" : "#4C83FF";
      dctx.fillRect(8 + i * ((w - 16) / n), (h - bh) / 2, (w - 16) / n - 3, bh);
    }
    dispTex.needsUpdate = true;
  };
  drawDisplay(0);

  /* ====================== STUDIO MONITORS ====================== */
  const monitors = new THREE.Group(); scene.add(monitors);
  const coneProfile = [new THREE.Vector2(0.03, -0.035), new THREE.Vector2(0.05, -0.028), new THREE.Vector2(0.075, -0.014), new THREE.Vector2(0.092, -0.002)];
  for (const side of [-1, 1]) {
    const spk = new THREE.Group(); spk.position.set(side * 1.15, 1.0625 + 0.25, -1.95); spk.rotation.y = -side * 0.3; monitors.add(spk);
    mesh(rbox(0.26, 0.02, 0.28, 0.006, 1), mRubber, spk, 0, -0.24, 0);                          // isolation pad
    const cab = mesh(rbox(0.3, 0.46, 0.32, 0.022, 4), mPlastic, spk); cab.castShadow = true;
    mesh(rbox(0.285, 0.445, 0.01, 0.018, 3), mGloss, spk, 0, 0, 0.158);                          // front baffle
    const cone = mesh(new THREE.LatheGeometry(coneProfile, 48), mCone, spk, 0, -0.07, 0.165); cone.rotation.x = Math.PI / 2;
    mesh(new THREE.TorusGeometry(0.1, 0.011, 16, 56), mRubber, spk, 0, -0.07, 0.163);            // surround
    mesh(new THREE.TorusGeometry(0.114, 0.004, 10, 56), mSatin, spk, 0, -0.07, 0.164);           // trim ring
    mesh(new THREE.CircleGeometry(0.034, 48), mSymbol, spk, 0, -0.07, 0.1335);                   // dust cap = symbol
    const wg = mesh(new THREE.LatheGeometry([new THREE.Vector2(0.016, -0.018), new THREE.Vector2(0.03, -0.01), new THREE.Vector2(0.05, 0)], 40), mPlastic, spk, 0, 0.135, 0.164); wg.rotation.x = Math.PI / 2;
    mesh(new THREE.SphereGeometry(0.016, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), std({ color: "#1a1e2a", metalness: 0.6, roughness: 0.3 }), spk, 0, 0.135, 0.146).rotation.x = Math.PI / 2;
    mesh(rbox(0.12, 0.018, 0.004, 0.008, 2), mRubber, spk, 0, -0.205, 0.164);                    // bass port
    mesh(box(0.008, 0.008, 0.003), mLed, spk, 0.118, 0.2, 0.164);
  }

  /* ====================== COMPUTER SCREEN ====================== */
  const scr = new THREE.Group(); scr.position.set(0, 1.44, -2.02); scene.add(scr);
  mesh(rbox(1.16, 0.53, 0.022, 0.012, 3), mPlastic, scr).castShadow = true;
  mesh(new THREE.PlaneGeometry(1.13, 0.5), basic("#ffffff", { map: track(dawTexture()) }), scr, 0, 0.004, 0.0116);
  const glassM = phys({ color: "#000000", roughness: 0.05, metalness: 0, transparent: true, opacity: 0.08, clearcoat: 1 });
  mesh(new THREE.PlaneGeometry(1.13, 0.5), glassM, scr, 0, 0.004, 0.0122);
  mesh(rbox(0.05, 0.26, 0.03, 0.008, 1), mSatin, scr, 0, -0.3, -0.03);
  mesh(rbox(0.3, 0.012, 0.18, 0.006, 1), mSatin, scr, 0, -0.372, -0.01);

  /* ====================== MIDI KEYBOARD ====================== */
  const keys = new THREE.Group(); keys.position.set(-1.02, 0.826, -1.47); keys.rotation.y = 0.12; scene.add(keys);
  mesh(rbox(0.66, 0.04, 0.22, 0.01, 2), mPlastic, keys).castShadow = true;
  instanced(rbox(0.0235, 0.012, 0.115, 0.002, 1), mKeyWhite, keys, Array.from({ length: 25 }, (_, i) => ({ p: v3(-0.305 + i * 0.0254, 0.024, 0.045) })));
  const blacks: { p: THREE.Vector3 }[] = [];
  for (let i = 0; i < 24; i++) if ([0, 1, 3, 4, 5].includes(i % 7)) blacks.push({ p: v3(-0.2923 + i * 0.0254, 0.033, 0.022) });
  instanced(rbox(0.013, 0.014, 0.07, 0.002, 1), mKeyBlack, keys, blacks);
  instanced(cyl(0.009, 0.01, 0.014, 16), mKnob, keys, Array.from({ length: 8 }, (_, i) => ({ p: v3(-0.29 + i * 0.03, 0.027, -0.075) })));
  instanced(rbox(0.03, 0.006, 0.03, 0.004, 1), basic("#ffffff"), keys, Array.from({ length: 8 }, (_, i) => ({ p: v3(0.02 + (i % 4) * 0.036, 0.021, -0.058 - Math.floor(i / 4) * 0.036), c: (i % 3 ? BLUE : BLUE_LIGHT).clone().multiplyScalar(0.8) })));

  /* ====================== HEADPHONES ====================== */
  const hp = new THREE.Group(); hp.position.set(1.02, 0.84, -1.38); hp.rotation.set(-Math.PI / 2 + 0.25, 0, 0.5); scene.add(hp);
  mesh(new THREE.TorusGeometry(0.085, 0.009, 12, 40, Math.PI), mLeather, hp);
  for (const sx of [-1, 1]) {
    const cup = mesh(cyl(0.042, 0.042, 0.03, 32), mPlastic, hp, sx * 0.085, -0.02, 0); cup.rotation.z = Math.PI / 2; cup.castShadow = true;
    const pad = mesh(new THREE.TorusGeometry(0.036, 0.012, 12, 32), mLeather, hp, sx * 0.068, -0.02, 0); pad.rotation.y = Math.PI / 2;
    const disc = mesh(new THREE.CircleGeometry(0.03, 32), mSatin, hp, sx * 0.1005, -0.02, 0); disc.rotation.y = sx * Math.PI / 2;
  }
  contact(1.02, -1.38, 0.3, 0.3, 0.807);

  /* ====================== FLOOR RACKS ====================== */
  const rackLedItems: { p: THREE.Vector3; c: THREE.Color }[] = [];
  const buildRack = () => {
    const g = new THREE.Group();
    mesh(rbox(0.62, 1.5, 0.6, 0.015, 3), mPlastic, g, 0, 0.77, 0).castShadow = true;
    for (const x of [-0.325, 0.325]) mesh(rbox(0.03, 1.52, 0.62, 0.008, 1), mWalnutV, g, x, 0.77, 0);
    instanced(cyl(0.03, 0.03, 0.03, 20), mRubber, g, [[-0.25, 0.25], [0.25, 0.25], [-0.25, -0.25], [0.25, -0.25]].map(([x, z]) => ({ p: v3(x, 0.012, z) })));
    const units: { p: THREE.Vector3 }[] = [], knobs: { p: THREE.Vector3; r: THREE.Euler }[] = [], handles: { p: THREE.Vector3 }[] = [];
    for (let u = 0; u < 8; u++) {
      const y = 0.16 + u * 0.172;
      units.push({ p: v3(0, y, 0.302) });
      for (let k = 0; k < 5; k++) knobs.push({ p: v3(-0.2 + k * 0.062, y - 0.012, 0.316), r: new THREE.Euler(Math.PI / 2, 0, 0) });
      handles.push({ p: v3(-0.265, y, 0.318) }, { p: v3(0.265, y, 0.318) });
    }
    instanced(rbox(0.56, 0.158, 0.012, 0.004, 1), mGunmetal, g, units);
    instanced(cyl(0.013, 0.015, 0.02, 18), mKnob, g, knobs);
    instanced(rbox(0.012, 0.11, 0.018, 0.005, 1), mChrome, g, handles);
    return g;
  };
  const rack = buildRack(); rack.position.set(2.35, 0, -2.4); rack.rotation.y = -0.5; scene.add(rack);
  const rack2 = buildRack(); rack2.position.set(-2.4, 0, -2.4); rack2.rotation.y = 0.5; scene.add(rack2);
  for (let u = 0; u < 8; u++) for (let l = 0; l < 5; l++) rackLedItems.push({ p: v3(0.13 + l * 0.022, 0.19 + u * 0.172, 0.31), c: BLUE.clone() });
  const rackLedsA = instanced(box(0.012, 0.012, 0.004), basic("#ffffff"), rack, rackLedItems);
  const rackLedsB = instanced(box(0.012, 0.012, 0.004), basic("#ffffff"), rack2, rackLedItems);
  contact(2.35, -2.4, 1.3, 1.3); contact(-2.4, -2.4, 1.3, 1.3);

  /* ====================== CHAIR ====================== */
  const chair = new THREE.Group(); chair.position.set(1.25, 0, -0.55); chair.rotation.y = -0.9; scene.add(chair);
  const seat = mesh(rbox(0.5, 0.09, 0.48, 0.04, 4), mLeather, chair, 0, 0.5, 0); seat.castShadow = true;
  const back = mesh(rbox(0.46, 0.62, 0.07, 0.035, 4), mLeather, chair, 0, 0.9, -0.24); back.rotation.x = -0.12; back.castShadow = true;
  mesh(cyl(0.028, 0.028, 0.34, 20), mChrome, chair, 0, 0.29, 0);
  mesh(rbox(0.05, 0.3, 0.03, 0.008, 1), mBlackMetal, chair, 0, 0.62, -0.24);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const leg = mesh(rbox(0.3, 0.03, 0.045, 0.01, 1), mChrome, chair, Math.cos(a) * 0.15, 0.09, Math.sin(a) * 0.15); leg.rotation.y = -a;
    mesh(new THREE.SphereGeometry(0.03, 16, 12), mRubber, chair, Math.cos(a) * 0.3, 0.03, Math.sin(a) * 0.3);
  }
  contact(1.25, -0.55, 0.95, 0.95);

  /* ====================== MICROPHONE ====================== */
  const mic = new THREE.Group(); mic.position.set(-1.3, 0, 0.95); scene.add(mic);
  // tripod stand
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const leg = mesh(cyl(0.011, 0.011, 0.5, 14), mBlackMetal, mic, Math.cos(a) * 0.2, 0.09, Math.sin(a) * 0.2);
    leg.rotation.set(0, -a, Math.PI / 2 - 0.36, "YXZ"); leg.castShadow = true;
    mesh(new THREE.SphereGeometry(0.018, 14, 10), mRubber, mic, Math.cos(a) * 0.43, 0.018, Math.sin(a) * 0.43);
  }
  mesh(cyl(0.03, 0.036, 0.07, 24), mBlackMetal, mic, 0, 0.19, 0);
  mesh(cyl(0.016, 0.016, 0.72, 20), mBlackMetal, mic, 0, 0.56, 0).castShadow = true;
  mesh(cyl(0.022, 0.022, 0.06, 20), mGunmetal, mic, 0, 0.93, 0);                               // height clutch
  mesh(cyl(0.012, 0.012, 0.46, 20), mChrome, mic, 0, 1.16, 0).castShadow = true;
  mesh(cyl(0.024, 0.024, 0.05, 20), mGunmetal, mic, 0, 1.39, 0);                               // boom swivel
  const knob = mesh(cyl(0.016, 0.016, 0.05, 16), mPlastic, mic, 0, 1.39, 0.04); knob.rotation.x = Math.PI / 2;
  // boom arm from (-0.32, 1.47) to (0.36, 1.29)
  const bA = v3(-0.32, 1.47, 0), bB = v3(0.36, 1.285, 0);
  const boom = mesh(cyl(0.009, 0.009, bA.distanceTo(bB), 16), mChrome, mic, (bA.x + bB.x) / 2, (bA.y + bB.y) / 2, 0);
  boom.rotation.z = Math.atan2(bB.y - bA.y, bB.x - bA.x) + Math.PI / 2; boom.castShadow = true;
  const cw = mesh(cyl(0.03, 0.03, 0.09, 24), mBlackMetal, mic, -0.3, 1.465, 0); cw.rotation.z = boom.rotation.z;
  contact(-1.3, 0.95, 1.2, 1.2);

  // head: large-diaphragm condenser in a shock mount (origin = grille centre region)
  const head = new THREE.Group(); head.position.set(0.36, 1.44, 0); mic.add(head);
  const bodyM = mesh(cyl(0.027, 0.027, 0.115, 40), mSatin, head, 0, -0.078, 0); bodyM.castShadow = true;
  mesh(cyl(0.027, 0.019, 0.022, 40), mSatin, head, 0, -0.1465, 0);
  mesh(cyl(0.013, 0.013, 0.02, 24), mGunmetal, head, 0, -0.166, 0);                            // XLR connector
  mesh(new THREE.TorusGeometry(0.0275, 0.003, 12, 48), mChrome, head, 0, -0.02, 0).rotation.x = Math.PI / 2;
  mesh(new THREE.TorusGeometry(0.0275, 0.002, 12, 48), mChrome, head, 0, -0.03, 0).rotation.x = Math.PI / 2;
  const basket = mesh(cyl(0.0285, 0.0285, 0.05, 40, ), mGrille, head, 0, 0.006, 0); basket.castShadow = true;
  mesh(new THREE.SphereGeometry(0.0285, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), mGrille, head, 0, 0.031, 0).castShadow = true;
  mesh(new THREE.TorusGeometry(0.0287, 0.0022, 10, 48), mChrome, head, 0, 0.031, 0).rotation.x = Math.PI / 2;
  mesh(new THREE.CircleGeometry(0.013, 40), mSymbol, head, 0, -0.07, 0.0272);                  // badge
  instanced(box(0.006, 0.01, 0.003), mKnob, head, [{ p: v3(-0.012, -0.11, 0.0265) }, { p: v3(0.012, -0.11, 0.0265) }]);
  // shock mount: two rings, outer cage, elastic cords
  for (const y of [-0.045, -0.125]) {
    mesh(new THREE.TorusGeometry(0.032, 0.0035, 10, 40), mBlackMetal, head, 0, y, 0).rotation.x = Math.PI / 2;
    mesh(new THREE.TorusGeometry(0.066, 0.004, 10, 48), mBlackMetal, head, 0, y, 0).rotation.x = Math.PI / 2;
  }
  const struts: { p: THREE.Vector3 }[] = [], cords: { p: THREE.Vector3; r: THREE.Euler; s: THREE.Vector3 }[] = [];
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; struts.push({ p: v3(Math.cos(a) * 0.066, -0.085, Math.sin(a) * 0.066) }); }
  instanced(cyl(0.0035, 0.0035, 0.08, 10), mBlackMetal, head, struts);
  for (const y of [-0.045, -0.125]) for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, b = a + (i % 2 ? 0.5 : -0.5);
    const p1 = v3(Math.cos(a) * 0.032, y, Math.sin(a) * 0.032), p2 = v3(Math.cos(b) * 0.066, y, Math.sin(b) * 0.066);
    const dir = p2.clone().sub(p1);
    q4.setFromUnitVectors(v3(0, 1, 0), dir.clone().normalize());
    cords.push({ p: p1.clone().add(p2).multiplyScalar(0.5), r: new THREE.Euler().setFromQuaternion(q4), s: v3(1, dir.length(), 1) });
  }
  instanced(cyl(0.0016, 0.0016, 1, 6), mRubber, head, cords);
  mesh(cyl(0.008, 0.008, 0.04, 12), mBlackMetal, head, 0, -0.165, 0.066);
  // pop filter on a gooseneck
  const popMat = std({ color: "#1b2233", alphaMap: tPop, transparent: true, opacity: 0.38, side: THREE.DoubleSide, roughness: 0.9, depthWrite: false });
  mesh(new THREE.CircleGeometry(0.072, 48), popMat, head, 0, 0.0, 0.13);
  mesh(new THREE.TorusGeometry(0.073, 0.0045, 10, 56), mPlastic, head, 0, 0.0, 0.13).castShadow = true;
  const goose = new THREE.CatmullRomCurve3([v3(0, -0.073, 0.13), v3(0.01, -0.14, 0.14), v3(0.0, -0.2, 0.09), v3(-0.03, -0.185, 0.02)]);
  mesh(new THREE.TubeGeometry(goose, 24, 0.004, 8), mBlackMetal, head);
  // XLR cable drooping along the boom to the floor
  const cable = new THREE.CatmullRomCurve3([v3(0.36, 1.265, 0), v3(0.35, 1.2, 0.01), v3(0.2, 1.24, 0.02), v3(0.03, 1.33, 0.02), v3(0.03, 0.9, 0.03), v3(0.05, 0.3, 0.05), v3(0.2, 0.02, 0.12), v3(0.7, 0.012, 0.0), v3(1.2, 0.012, -0.5)]);
  mesh(new THREE.TubeGeometry(cable, 64, 0.0035, 6), mRubber, mic);

  /* ====================== LIGHTS ====================== */
  const ambient = new THREE.AmbientLight("#1a2a55", 0.2); scene.add(ambient);
  const hemi = new THREE.HemisphereLight("#35548c", "#05070d", 0.12); scene.add(hemi);
  const micKey = new THREE.SpotLight("#cfdcff", 22, 7, 0.36, 0.7, 1.4);
  micKey.position.set(-0.2, 2.9, 2.4); micKey.target = head; scene.add(micKey);
  // Low quality (phones, weak GPUs) keeps a handful of cheap lights; the full rig is high-quality only.
  const micRim = new THREE.PointLight(BLUE, 5, 4, 1.6);
  micRim.position.set(-1.9, 1.8, 0.2); scene.add(micRim);
  if (hi) { const micFill = new THREE.PointLight("#8fb0ff", 0.8, 3, 1.8); micFill.position.set(-0.5, 1.2, 1.9); scene.add(micFill); }
  const deskKey = new THREE.SpotLight("#dbe5ff", 0, 7, 0.75, 0.8, 1.2);
  deskKey.position.set(0.3, 3.1, -0.2); deskKey.target = mixer; scene.add(deskKey);
  const wallWash = new THREE.PointLight(BLUE, 0, 9, 1.3); wallWash.position.set(0, 1.9, -3.1); scene.add(wallWash);
  const extra: { light: THREE.Light; max: number; from: number; to: number }[] = [];
  if (hi) {
    const cloud = new THREE.RectAreaLight("#cdd9ff", 0, 2.3, 1.2); cloud.position.set(0, 3.14, -1.2); cloud.rotation.x = -Math.PI / 2;
    const screenGlow = new THREE.RectAreaLight("#6f9dff", 0, 1.1, 0.5); screenGlow.position.set(0, 1.44, -2.0); screenGlow.rotation.y = Math.PI;
    const sideL = new THREE.PointLight(BLUE, 0, 6, 1.5); sideL.position.set(-3.6, 2.4, -1.6);
    const sideR = sideL.clone(); sideR.position.x = 3.6;
    const underDesk = new THREE.PointLight(BLUE_LIGHT, 0, 2.5, 1.8); underDesk.position.set(0, 0.5, -1.0);
    extra.push({ light: cloud, max: 5, from: 0.25, to: 0.7 }, { light: screenGlow, max: 5, from: 0.1, to: 0.5 }, { light: sideL, max: 5, from: 0.3, to: 0.75 }, { light: sideR, max: 5, from: 0.3, to: 0.75 }, { light: underDesk, max: 1.6, from: 0.2, to: 0.6 });
    extra.forEach(e => scene.add(e.light));
  }
  if (hi) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    for (const l of [micKey, deskKey]) {
      l.castShadow = true; l.shadow.mapSize.set(2048, 2048); l.shadow.bias = -0.0004; l.shadow.radius = 5; l.shadow.camera.near = 0.5; l.shadow.camera.far = 8;
    }
  }

  const anchorAt = (parent: THREE.Object3D, x: number, y: number, z: number) => { const a = new THREE.Object3D(); a.position.set(x, y, z); parent.add(a); return a; };
  const anchors = {
    mic: anchorAt(head, 0, 0.02, 0),
    mixer: anchorAt(mixer, 0, 0.05, 0.12),
    display: anchorAt(mb, 0, 0, 0.0356),
    monitors: anchorAt(monitors.children[1], 0, 0.3, 0),
    rack: anchorAt(rack, 0, 1.6, 0.3),
  };

  let reveal = 0;
  const setReveal = (v: number) => {
    reveal = THREE.MathUtils.clamp(v, 0, 1);
    const k = (a: number, b: number) => THREE.MathUtils.smoothstep(reveal, a, b);
    deskKey.intensity = 26 * k(0.2, 0.6);
    extra.forEach(e => { e.light.intensity = e.max * k(e.from, e.to); });
    cloudGlowMat.color.set("#cdd9ff").multiplyScalar(0.05 + 0.95 * k(0.25, 0.7));
    wallWash.intensity = 9 * k(0.05, 0.45);
    ambient.intensity = (hi ? 0.14 : 0.3) + (hi ? 0.4 : 0.9) * k(0, 0.8);
    mStrip.color.copy(BLUE).multiplyScalar(0.12 + 0.88 * k(0.08, 0.5));
    (scene.fog as THREE.FogExp2).density = 0.15 - 0.105 * k(0, 0.7);
  };
  setReveal(0);

  const col = new THREE.Color();
  const OFF = new THREE.Color("#0a1430"), ON = BLUE.clone(), PEAK = BLUE_LIGHT.clone(), HOT = new THREE.Color("#ffffff");
  const paintMeters = (t: number) => {
    for (let c = 0; c < meterCh.length; c++) {
      const lv = 0.25 + Math.abs(Math.sin(t * 2.6 + c * 1.3) * Math.sin(t * 1.3 + c * 0.7)) * 0.75;
      for (let k = 0; k < SEG; k++) {
        const on = k / SEG < lv;
        meters.setColorAt(c * SEG + k, on ? (k >= SEG - 1 ? HOT : k >= SEG - 3 ? PEAK : ON) : OFF);
      }
    }
    meters.instanceColor!.needsUpdate = true;
  };
  paintMeters(0.7);
  let last = 0;
  const tick = (t: number, active: boolean) => {
    if (!active) return;
    faders.forEach((f, i) => { f.position.z = 0.175 + Math.sin(t * 0.55 + i * 0.7) * 0.06 * (0.3 + 0.7 * reveal); });
    if (t - last > 1 / 20) {
      last = t;
      drawDisplay(t);
      paintMeters(t);
      for (let i = 0; i < rackLedItems.length; i++) {
        col.copy(Math.sin(t * 2 + i * 1.7) > 0.3 ? BLUE_LIGHT : BLUE).multiplyScalar(Math.sin(t * 5 + i * 3.1) > -0.6 ? 1 : 0.15);
        rackLedsA.setColorAt(i, col); rackLedsB.setColorAt((i * 7) % rackLedItems.length, col);
      }
      rackLedsA.instanceColor!.needsUpdate = true; rackLedsB.instanceColor!.needsUpdate = true;
      for (let i = 0; i < CH; i++) chLeds.setColorAt(i, col.copy(i % 5 === 0 ? BLUE_LIGHT : BLUE).multiplyScalar(Math.sin(t * 3 + i * 2.3) > 0 ? 1 : 0.2));
      chLeds.instanceColor!.needsUpdate = true;
    }
  };

  /* ---------- photographic textures + scanned models (CC0), loaded progressively ---------- */
  let alive = true;
  loadPhotoAssets(scene, [
    { material: mFloor, name: "parquet", repeat: [5, 4], tint: "#7d6a60", roughness: 0.85 },
    { material: mWalnut, name: "walnut", repeat: [1, 1], tint: "#7a5a4c", normalScale: 0.6 },
    { material: mWalnutV, name: "walnut", repeat: [1, 1], tint: "#6e5145", rotate: true, normalScale: 0.6 },
    { material: mFabric, name: "linen", repeat: [3, 5], tint: "#33467f" },
    { material: mFabricDark, name: "linen", repeat: [3, 5], tint: "#1b2545" },
    { material: mRug, name: "wool", repeat: [7, 5], tint: "#2b3c74" },
    { material: mWall, name: "plaster", repeat: [5, 2], tint: "#1a2748", normalScale: 1.4 },
    { material: mLeather, name: "leather", repeat: [1, 1], tint: "#2b2420", normalScale: 0.8, roughness: 0.8 },
  ], [
    { name: "sofa_03", position: [-4.1, 0, -0.7], rotationY: Math.PI / 2, tint: "#8f97b4" },
    { name: "potted_plant_04", position: [1.33, 0.806, -1.22], rotationY: 0.6 },
  ], hi, () => alive, d => disposables.push(d));

  return {
    scene, anchors, setReveal, tick,
    dispose() { alive = false; disposables.forEach(d => d.dispose()); },
  };
}
