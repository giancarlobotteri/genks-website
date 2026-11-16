// Procedural, original 3D studio built from three.js primitives (MIT).
// No external models, textures or HDRIs: everything is generated at runtime.
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";


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

function std(color: string, metalness = 0.2, roughness = 0.6, extra: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });
}

function box(w: number, h: number, d: number, m: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  return mesh;
}

function cyl(rt: number, rb: number, h: number, m: THREE.Material, seg = 24) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
}

/** Rasterise the GENKS symbol SVG to a texture (square: never deformed). */
function symbolTexture(onReady: () => void) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const img = new Image();
  img.onload = () => {
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, 512, 512);
    tex.needsUpdate = true;
    onReady();
  };
  img.src = "/brand/genks-symbol.svg";
  return tex;
}

export function buildStudio(renderer: THREE.WebGLRenderer, quality: Quality): StudioRig {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#060B17");
  scene.fog = new THREE.FogExp2("#060B17", 0.085);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  // three r186: environment intensity on the scene
  (scene as THREE.Scene & { environmentIntensity?: number }).environmentIntensity = 0.35;

  const disposables: { dispose: () => void }[] = [env, pmrem];
  const track = <T extends { dispose: () => void }>(o: T) => { disposables.push(o); return o; };

  /* ---------- materials ---------- */
  const matFloor = track(std("#0a1122", 0.4, 0.55));
  const matWall = track(std("#0b1428", 0.05, 0.95));
  const matPanel = track(std("#101c38", 0.0, 1));
  const matPanelAlt = track(std("#0d1730", 0.0, 1));
  const matMetal = track(std("#b7c5de", 1, 0.22));
  const matDarkMetal = track(std("#1b2438", 0.9, 0.35));
  const matBlack = track(std("#05080f", 0.4, 0.5));
  const matDesk = track(std("#0c1324", 0.6, 0.35));
  const matGrille = track(std("#c9d4ea", 1, 0.35, { wireframe: false }));
  const matLed = track(new THREE.MeshBasicMaterial({ color: BLUE, toneMapped: false }));
  const matLedSoft = track(new THREE.MeshBasicMaterial({ color: BLUE_LIGHT, toneMapped: false, transparent: true, opacity: 0.9 }));
  const symbolMat = track(new THREE.MeshStandardMaterial({ map: symbolTexture(() => {}), metalness: 0.3, roughness: 0.4, emissive: new THREE.Color("#1b3a9a"), emissiveIntensity: 0.35 }));
  disposables.push(symbolMat.map!);

  /* ---------- room ---------- */
  const floor = new THREE.Mesh(track(new THREE.PlaneGeometry(14, 12)), matFloor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const back = new THREE.Mesh(track(new THREE.PlaneGeometry(14, 4)), matWall);
  back.position.set(0, 2, -3.6);
  scene.add(back);
  const left = back.clone(); left.rotation.y = Math.PI / 2; left.position.set(-5, 2, 0); scene.add(left);
  const right = back.clone(); right.rotation.y = -Math.PI / 2; right.position.set(5, 2, 0); scene.add(right);

  // acoustic panels (back wall grid + side diffusers)
  const panelGeo = track(new THREE.BoxGeometry(0.62, 0.62, 0.08));
  for (let x = -4; x <= 4; x++) {
    for (let y = 0; y < 4; y++) {
      if (Math.abs(x) <= 1 && y === 0) continue;
      const p = new THREE.Mesh(panelGeo, (x + y) % 2 ? matPanel : matPanelAlt);
      p.position.set(x * 0.7, 0.75 + y * 0.7, -3.54);
      p.scale.z = 1 + ((x * 7 + y * 3) % 3) * 0.5;
      scene.add(p);
    }
  }
  const diffGeo = track(new THREE.BoxGeometry(0.1, 0.1, 0.1));
  for (const side of [-1, 1]) {
    for (let i = 0; i < 64; i++) {
      const d = new THREE.Mesh(diffGeo, matPanelAlt);
      d.position.set(side * 4.95, 0.9 + Math.floor(i / 8) * 0.12, -2.4 + (i % 8) * 0.12);
      d.scale.x = 1 + ((i * 13) % 5) * 0.6;
      scene.add(d);
    }
  }

  // LED strips — they switch on with the reveal
  const strips: THREE.Mesh[] = [];
  const stripGeo = track(new THREE.BoxGeometry(12, 0.02, 0.02));
  const stripMat = track(matLed.clone());
  for (const y of [0.02, 3.4]) {
    const st = new THREE.Mesh(stripGeo, stripMat);
    st.position.set(0, y, -3.5);
    scene.add(st);
    strips.push(st);
  }
  const vStripGeo = track(new THREE.BoxGeometry(0.02, 3.4, 0.02));
  for (const x of [-3.15, 3.15]) {
    const st = new THREE.Mesh(vStripGeo, stripMat);
    st.position.set(x, 1.7, -3.48);
    scene.add(st);
  }

  // Big wall emblem (symbol, square)
  const emblem = new THREE.Mesh(track(new THREE.CircleGeometry(0.42, 64)), symbolMat);
  emblem.position.set(0, 2.55, -3.45);
  scene.add(emblem);

  /* ---------- desk ---------- */
  const desk = new THREE.Group();
  desk.position.set(0, 0, -1.6);
  const top = box(3.2, 0.06, 1.05, matDesk); top.position.y = 0.78; desk.add(top);
  const edge = box(3.2, 0.012, 0.012, matLedSoft); edge.position.set(0, 0.765, 0.53); desk.add(edge);
  for (const x of [-1.5, 1.5]) { const leg = box(0.06, 0.78, 0.95, matDarkMetal); leg.position.set(x, 0.39, 0); desk.add(leg); }
  const shelf = box(3.0, 0.04, 0.32, matDesk); shelf.position.set(0, 1.04, -0.38); desk.add(shelf);
  scene.add(desk);

  /* ---------- mixer ---------- */
  const mixer = new THREE.Group();
  mixer.position.set(0, 0.81, -1.42);
  mixer.rotation.x = 0.16;
  const body = box(1.5, 0.07, 0.62, matBlack); mixer.add(body);
  const bezel = box(1.52, 0.012, 0.64, matDarkMetal); bezel.position.y = -0.03; mixer.add(bezel);
  const faders: THREE.Mesh[] = [];
  const meters: THREE.Mesh[] = [];
  const faderGeo = track(new THREE.BoxGeometry(0.035, 0.03, 0.05));
  const slotGeo = track(new THREE.BoxGeometry(0.008, 0.005, 0.2));
  const knobGeo = track(new THREE.CylinderGeometry(0.014, 0.016, 0.025, 16));
  const meterGeo = track(new THREE.BoxGeometry(0.018, 0.004, 0.12));
  const meterMat = track(new THREE.MeshBasicMaterial({ color: BLUE, toneMapped: false }));
  for (let i = 0; i < 16; i++) {
    const x = -0.66 + i * 0.075 + (i >= 8 ? 0.06 : 0);
    const slot = new THREE.Mesh(slotGeo, matLed); slot.position.set(x, 0.037, 0.16); mixer.add(slot);
    const f = new THREE.Mesh(faderGeo, matMetal); f.position.set(x, 0.05, 0.16); mixer.add(f); faders.push(f);
    for (let k = 0; k < 3; k++) { const kn = new THREE.Mesh(knobGeo, matDarkMetal); kn.position.set(x, 0.045, -0.07 - k * 0.06); mixer.add(kn); }
    const m = new THREE.Mesh(meterGeo, meterMat); m.position.set(x, 0.037, -0.25); m.scale.z = 0.4; mixer.add(m); meters.push(m);
  }
  // meter bridge with central display
  const bridge = box(1.5, 0.2, 0.06, matBlack); bridge.position.set(0, 0.1, -0.3); bridge.rotation.x = -0.35; mixer.add(bridge);
  const dispCanvas = document.createElement("canvas");
  dispCanvas.width = 512; dispCanvas.height = 192;
  const dispTex = track(new THREE.CanvasTexture(dispCanvas));
  dispTex.colorSpace = THREE.SRGBColorSpace;
  const display = new THREE.Mesh(track(new THREE.PlaneGeometry(0.5, 0.17)), track(new THREE.MeshBasicMaterial({ map: dispTex, toneMapped: false })));
  display.position.set(0, 0.105, -0.268);
  display.rotation.x = -0.35;
  mixer.add(display);
  const plate = new THREE.Mesh(track(new THREE.CircleGeometry(0.035, 48)), symbolMat);
  plate.position.set(0.62, 0.105, -0.268); plate.rotation.x = -0.35; mixer.add(plate);
  scene.add(mixer);
  const dctx = dispCanvas.getContext("2d")!;
  const drawDisplay = (t: number) => {
    const w = dispCanvas.width, h = dispCanvas.height;
    dctx.fillStyle = "#040a1a"; dctx.fillRect(0, 0, w, h);
    dctx.strokeStyle = "rgba(156,191,255,.18)"; dctx.lineWidth = 1;
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

  /* ---------- monitors (speakers) ---------- */
  const monitors = new THREE.Group();
  for (const side of [-1, 1]) {
    const spk = new THREE.Group();
    spk.position.set(side * 1.15, 1.06 + 0.24, -1.95);
    spk.rotation.y = -side * 0.28;
    const cab = box(0.3, 0.46, 0.32, matBlack); spk.add(cab);
    const woof = new THREE.Mesh(track(new THREE.CircleGeometry(0.105, 48)), symbolMat); woof.position.set(0, -0.07, 0.162); spk.add(woof);
    const ring = new THREE.Mesh(track(new THREE.TorusGeometry(0.11, 0.008, 12, 48)), matMetal); ring.position.set(0, -0.07, 0.163); spk.add(ring);
    const tw = new THREE.Mesh(track(new THREE.CircleGeometry(0.035, 32)), matDarkMetal); tw.position.set(0, 0.13, 0.162); spk.add(tw);
    const led = box(0.012, 0.012, 0.004, matLed); led.position.set(0.11, -0.2, 0.162); spk.add(led);
    monitors.add(spk);
  }
  scene.add(monitors);

  /* ---------- computer screen ---------- */
  const screen = box(1.1, 0.5, 0.03, matBlack); screen.position.set(0, 1.42, -2.05); scene.add(screen);
  const scrCanvas = document.createElement("canvas"); scrCanvas.width = 512; scrCanvas.height = 232;
  const sctx = scrCanvas.getContext("2d")!;
  sctx.fillStyle = "#050b1c"; sctx.fillRect(0, 0, 512, 232);
  for (let tr = 0; tr < 6; tr++) {
    sctx.fillStyle = "rgba(76,131,255,.12)"; sctx.fillRect(70, 14 + tr * 36, 430, 28);
    sctx.fillStyle = tr % 2 ? "#4C83FF" : "#9CBFFF";
    for (let x = 0; x < 420; x += 3) { const a = Math.abs(Math.sin(x * 0.05 + tr) * Math.sin(x * 0.011 * (tr + 1))); sctx.fillRect(74 + x, 28 + tr * 36 - a * 12, 2, a * 24 + 1); }
    sctx.fillStyle = "rgba(183,197,222,.5)"; sctx.fillRect(10, 20 + tr * 36, 48, 14);
  }
  const scrTex = track(new THREE.CanvasTexture(scrCanvas)); scrTex.colorSpace = THREE.SRGBColorSpace;
  const scr = new THREE.Mesh(track(new THREE.PlaneGeometry(1.06, 0.46)), track(new THREE.MeshBasicMaterial({ map: scrTex, toneMapped: false })));
  scr.position.set(0, 1.42, -2.034); scene.add(scr);
  const stand = cyl(0.02, 0.02, 0.28, matDarkMetal); stand.position.set(0, 1.12, -2.07); scene.add(stand);

  /* ---------- keyboard / synth on desk ---------- */
  const keys = new THREE.Group();
  keys.position.set(-1.02, 0.83, -1.45); keys.rotation.y = 0.12;
  keys.add(box(0.62, 0.04, 0.2, matBlack));
  const whiteMat = track(std("#c7d3ea", 0.1, 0.4));
  for (let i = 0; i < 14; i++) { const k = box(0.038, 0.012, 0.11, whiteMat); k.position.set(-0.27 + i * 0.042, 0.026, 0.035); keys.add(k); }
  for (let i = 0; i < 6; i++) { const p = box(0.05, 0.01, 0.05, i % 2 ? matLed : matLedSoft); p.position.set(-0.24 + i * 0.07, 0.025, -0.065); keys.add(p); }
  scene.add(keys);

  /* ---------- rack ---------- */
  const rack = new THREE.Group();
  rack.position.set(2.35, 0, -2.4); rack.rotation.y = -0.5;
  const rackBody = box(0.62, 1.5, 0.6, matBlack); rackBody.position.set(0, 0.75, 0); rack.add(rackBody);
  const rackLeds: THREE.Mesh[] = [];
  for (let u = 0; u < 7; u++) {
    const unit = box(0.56, 0.15, 0.02, matDarkMetal); unit.position.set(0, 0.2 + u * 0.18, 0.305); rack.add(unit);
    for (let l = 0; l < 5; l++) { const led = box(0.02, 0.02, 0.01, matLed.clone()); led.position.set(-0.22 + l * 0.05, 0.2 + u * 0.18, 0.318); rack.add(led); rackLeds.push(led); }
    const kn = cyl(0.02, 0.02, 0.02, matMetal, 16); kn.rotation.x = Math.PI / 2; kn.position.set(0.18, 0.2 + u * 0.18, 0.32); rack.add(kn);
  }
  scene.add(rack);
  // left side: second rack + couch silhouette for depth
  const sideRack = rack.clone(); sideRack.position.set(-2.4, 0, -2.4); sideRack.rotation.y = 0.5; scene.add(sideRack);

  /* ---------- microphone ---------- */
  const mic = new THREE.Group();
  mic.position.set(-1.3, 0, 0.95);
  const base = cyl(0.22, 0.24, 0.03, matDarkMetal, 32); base.position.y = 0.015; mic.add(base);
  const pole = cyl(0.014, 0.014, 1.32, matMetal, 16); pole.position.y = 0.68; mic.add(pole);
  const boom = cyl(0.01, 0.01, 0.5, matMetal, 12); boom.rotation.z = Math.PI / 2.4; boom.position.set(0.17, 1.36, 0); mic.add(boom);
  const head = new THREE.Group(); head.position.set(0.36, 1.44, 0); head.rotation.z = -0.1; mic.add(head);
  const profile = [
    new THREE.Vector2(0.0, -0.2), new THREE.Vector2(0.03, -0.2), new THREE.Vector2(0.042, -0.17), new THREE.Vector2(0.048, -0.05),
    new THREE.Vector2(0.05, 0.02),
  ];
  const bodyM = new THREE.Mesh(track(new THREE.LatheGeometry(profile, 40)), matDarkMetal); head.add(bodyM);
  const grille = new THREE.Mesh(track(new THREE.SphereGeometry(0.056, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.62)), matGrille);
  grille.position.y = 0.035; head.add(grille);
  const grilleCage = new THREE.Mesh(track(new THREE.SphereGeometry(0.058, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.62)), track(new THREE.MeshBasicMaterial({ color: "#6f87b8", wireframe: true, transparent: true, opacity: 0.45 })));
  grilleCage.position.y = 0.035; head.add(grilleCage);
  const band = new THREE.Mesh(track(new THREE.TorusGeometry(0.05, 0.006, 10, 40)), matMetal); band.rotation.x = Math.PI / 2; band.position.y = 0.02; head.add(band);
  const badge = new THREE.Mesh(track(new THREE.CircleGeometry(0.018, 32)), symbolMat); badge.position.set(0, -0.06, 0.049); head.add(badge);
  const shock = new THREE.Mesh(track(new THREE.TorusGeometry(0.085, 0.004, 8, 48)), matMetal); shock.rotation.x = Math.PI / 2; shock.position.y = -0.09; head.add(shock);
  const shock2 = shock.clone(); shock2.position.y = -0.15; head.add(shock2);
  const pop = new THREE.Mesh(track(new THREE.CircleGeometry(0.09, 40)), track(new THREE.MeshStandardMaterial({ color: "#2a3b66", transparent: true, opacity: 0.28, side: THREE.DoubleSide, roughness: 1 })));
  pop.position.set(0.0, 0.02, 0.17); head.add(pop);
  const popRing = new THREE.Mesh(track(new THREE.TorusGeometry(0.09, 0.005, 8, 48)), matDarkMetal); popRing.position.copy(pop.position); head.add(popRing);
  scene.add(mic);

  /* ---------- lights ---------- */
  const ambient = new THREE.AmbientLight("#1a2a55", 0.25); scene.add(ambient);
  const hemi = new THREE.HemisphereLight("#33507f", "#05070d", 0.15); scene.add(hemi);
  const micKey = new THREE.SpotLight("#bcd0ff", 14, 6, 0.42, 0.6, 1.4);
  micKey.position.set(-0.4, 2.8, 2.2); micKey.target = head; scene.add(micKey);
  const micRim = new THREE.PointLight(BLUE, 3, 3, 1.6); micRim.position.set(-1.4, 1.7, 0.3); scene.add(micRim);
  const deskLight = new THREE.SpotLight("#7ea4ff", 0, 6, 0.7, 0.7, 1.3);
  deskLight.position.set(0, 3.0, -0.4); deskLight.target = mixer; scene.add(deskLight);
  const wallWash = new THREE.PointLight(BLUE, 0, 9, 1.4); wallWash.position.set(0, 2.2, -2.6); scene.add(wallWash);
  const rackGlowL = new THREE.PointLight(BLUE_LIGHT, 0, 3, 1.8); rackGlowL.position.set(-2.1, 1.0, -1.9); scene.add(rackGlowL);
  const rackGlowR = rackGlowL.clone(); rackGlowR.position.x = 2.1; scene.add(rackGlowR);
  if (quality === "high") {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    micKey.castShadow = true; micKey.shadow.mapSize.set(1024, 1024);
    mic.traverse(o => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  }

  const anchorAt = (parent: THREE.Object3D, x: number, y: number, z: number) => { const a = new THREE.Object3D(); a.position.set(x, y, z); parent.add(a); return a; };
  const anchors = {
    mic: anchorAt(head, 0, 0.03, 0),
    mixer: anchorAt(mixer, 0, 0.05, 0.12),
    display: anchorAt(mixer, 0, 0.105, -0.268),
    monitors: anchorAt(monitors.children[1], 0, 0.3, 0),
    rack: anchorAt(rack, 0, 1.55, 0.3),
  };

  anchors.display.rotation.x = -0.35;

  let reveal = 0;
  const setReveal = (v: number) => {
    reveal = THREE.MathUtils.clamp(v, 0, 1);
    const k = (a: number, b: number) => THREE.MathUtils.smoothstep(reveal, a, b);
    deskLight.intensity = 9 * k(0.15, 0.55);
    wallWash.intensity = 6 * k(0.05, 0.45);
    rackGlowL.intensity = rackGlowR.intensity = 2.2 * k(0.35, 0.75);
    ambient.intensity = 0.18 + 0.5 * k(0, 0.8);
    stripMat.color.copy(BLUE).multiplyScalar(0.15 + 0.85 * k(0.1, 0.5));
    (scene.fog as THREE.FogExp2).density = 0.16 - 0.1 * k(0, 0.7);
  };
  setReveal(0);

  let lastDisplay = 0;
  const tick = (t: number, active: boolean) => {
    if (!active) return;
    faders.forEach((f, i) => { f.position.z = 0.16 + Math.sin(t * 0.6 + i * 0.7) * 0.06 * (0.3 + 0.7 * reveal); });
    meters.forEach((m, i) => { m.scale.z = 0.2 + Math.abs(Math.sin(t * 3.1 + i * 1.3) * Math.sin(t * 1.7 + i)) * 0.8; });
    rackLeds.forEach((l, i) => { ((l.material as THREE.MeshBasicMaterial).color).copy(((Math.sin(t * 2 + i * 1.7) > 0.3) ? BLUE_LIGHT : BLUE)); });
    if (t - lastDisplay > 1 / 24) { drawDisplay(t); lastDisplay = t; }
  };

  return {
    scene, anchors, setReveal, tick,
    dispose() {
      scene.traverse(o => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.geometry?.dispose();
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          mats.forEach(mm => mm?.dispose());
        }
      });
      disposables.forEach(d => d.dispose());
    },
  };
}
