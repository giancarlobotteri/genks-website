// "The services under the spotlights": four floating capsules (one per service) in an arc, each in its
// own cone of light, in the dark studio, like a product line-up. Original artwork drawn by code.
import * as THREE from "three";
import { addSweep, beamMaterial, type SweepUniforms } from "./cinema-shaders.ts";

export type LineupId = "recording" | "custom" | "mix" | "store";
export const LINEUP: { id: LineupId; word: string; title: string; num: string; accent: string }[] = [
  { id: "recording", word: "VOCE", title: "REGISTRAZIONE", num: "01", accent: "#4C83FF" },
  { id: "custom", word: "BEAT", title: "BEAT SU MISURA", num: "02", accent: "#7fa6ff" },
  { id: "mix", word: "MIX", title: "MIX & MASTER", num: "03", accent: "#9CBFFF" },
  { id: "store", word: "STORE", title: "BEAT STORE", num: "04", accent: "#5b6ee8" },
];

/** Label wrapped around the capsule: the word runs vertically, like the name on a can. */
function labelTexture(item: (typeof LINEUP)[number]) {
  const w = 1024, h = 576;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, "#03060f"); g.addColorStop(0.32, "#0a1838"); g.addColorStop(0.5, "#10245a"); g.addColorStop(0.68, "#0a1838"); g.addColorStop(1, "#03060f");
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // fine brushed lines
  for (let y = 0; y < h; y += 3) { ctx.fillStyle = `rgba(255,255,255,${0.012 + ((y * 7919) % 11) / 1400})`; ctx.fillRect(0, y, w, 1); }
  // accent bands
  ctx.fillStyle = item.accent; ctx.fillRect(0, 34, w, 6); ctx.fillRect(0, h - 40, w, 6);
  // the big vertical word, centred on the front of the capsule
  ctx.save();
  ctx.translate(w / 2, h / 2); ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const size = Math.min(230, (h * 0.86) / (item.word.length * 0.62));
  ctx.font = `700 ${size}px "Space Grotesk", sans-serif`;
  ctx.fillStyle = "#eef3ff"; ctx.fillText(item.word, 0, 0);
  ctx.restore();
  // small print on the sides
  ctx.fillStyle = "rgba(220,230,250,0.75)";
  ctx.font = `700 26px "Space Grotesk", sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(item.num, w / 2 - 190, 92);
  ctx.save(); ctx.translate(w / 2 + 175, h / 2); ctx.rotate(Math.PI / 2);
  ctx.font = `600 22px "Space Grotesk", sans-serif`; ctx.fillText(item.title, 0, 0); ctx.restore();
  ctx.fillStyle = item.accent; ctx.font = `700 20px "Space Grotesk", sans-serif`;
  ctx.fillText("GENKS STUDIO", w / 2, h - 60);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function poolTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, "rgba(170,200,255,0.9)"); g.addColorStop(0.35, "rgba(76,131,255,0.35)"); g.addColorStop(1, "rgba(76,131,255,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

export type Lineup = ReturnType<typeof buildLineup>;

export function buildLineup(scene: THREE.Scene, opts: { envMap: THREE.Texture; metal: THREE.Material; sweep: SweepUniforms; track: <T extends { dispose: () => void }>(o: T) => T; hi: boolean }) {
  const { track } = opts;
  const C = new THREE.Vector3(0.35, 1.13, 0.45);
  const root = new THREE.Group(); root.visible = false; scene.add(root);
  const V = (r: number, y: number) => new THREE.Vector2(r, y);
  const R = 0.062, H = 0.27;
  const shell = track(new THREE.LatheGeometry([V(0, -H / 2), V(0.05, -H / 2), V(0.057, -H / 2 + 0.004), V(R, -H / 2 + 0.016), V(R, H / 2 - 0.016), V(0.056, H / 2 - 0.006), V(0.047, H / 2), V(0, H / 2)], 64));
  const labelGeo = track(new THREE.CylinderGeometry(R + 0.0006, R + 0.0006, H - 0.05, 64, 1, true));
  const tabGeo = track(new THREE.TorusGeometry(0.012, 0.002, 8, 24));
  const tPool = track(poolTexture());
  const poolMat = track(new THREE.MeshBasicMaterial({ map: tPool, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  const items = LINEUP.map((it, k) => {
    const x = (k - 1.5) * 0.3;
    const base = new THREE.Vector3(C.x + x, C.y, C.z + 0.1 - 0.16 * (x / 0.45) ** 2);
    const tilt = [-0.2, 0.09, -0.07, 0.17][k];
    const g = new THREE.Group(); g.position.copy(base); g.rotation.z = tilt; root.add(g);
    const body = new THREE.Mesh(shell, opts.metal); body.castShadow = false; g.add(body);
    const tex = track(labelTexture(it));
    const mat = track(new THREE.MeshStandardMaterial({ map: tex, emissive: new THREE.Color("#ffffff"), emissiveMap: tex, emissiveIntensity: 0.18, metalness: 0.55, roughness: 0.3, envMap: opts.envMap, envMapIntensity: 0.9 }));
    addSweep(mat, opts.sweep);
    const label = new THREE.Mesh(labelGeo, mat); label.rotation.y = Math.PI; g.add(label);
    const tab = new THREE.Mesh(tabGeo, opts.metal); tab.rotation.x = Math.PI / 2; tab.position.set(0, H / 2 + 0.001, 0.015); g.add(tab);
    // its own spotlight: a cone of light from the ceiling and a pool of light on the floor
    const top = 3.3, len = top - 0.02;
    const beamMat = track(beamMaterial(it.accent));
    const beam = new THREE.Mesh(track(new THREE.ConeGeometry(0.21, len, 40, 1, true)), beamMat);
    beam.position.set(base.x, top - len / 2, base.z); beam.renderOrder = 3; beam.frustumCulled = false; root.add(beam);
    const pool = new THREE.Mesh(track(new THREE.PlaneGeometry(0.62, 0.62)), poolMat);
    pool.rotation.x = -Math.PI / 2; pool.position.set(base.x, 0.007, base.z); pool.renderOrder = 2; root.add(pool);
    const anchor = new THREE.Object3D(); anchor.position.set(base.x, base.y - 0.22, base.z); root.add(anchor);
    const hit = new THREE.Object3D(); hit.position.copy(base); root.add(hit);
    return { id: it.id, g, mat, beamMat, base, tilt, anchor, hit, hov: 0, k: 0 };
  });
  const spot = new THREE.SpotLight("#dfe7ff", 0, 6, 0.5, 0.85, 1.4);
  // one more light per pixel only where the GPU can afford it; on phones the labels glow a little more instead
  spot.position.set(C.x, 3.2, C.z + 0.9); spot.target.position.copy(C);
  if (opts.hi) scene.add(spot, spot.target);

  let amount = 0, hover: LineupId | null = null;
  const setAmount = (a: number) => {
    amount = THREE.MathUtils.clamp(a, 0, 1);
    root.visible = amount > 0.005;
    spot.intensity = 26 * amount;
    poolMat.opacity = 0.55 * amount;
  };
  const tick = (t: number, dt: number, active: boolean) => {
    if (!root.visible) return;
    const e = 1 - Math.exp(-dt * 7);
    items.forEach((it, k) => {
      // one after another they rise into their light
      const kk = THREE.MathUtils.smoothstep(amount * 1.45 - k * 0.13, 0, 1);
      it.hov += ((hover === it.id ? 1 : 0) - it.hov) * e;
      const bob = active ? Math.sin(t * 0.9 + k * 1.7) * 0.012 : 0;
      it.g.position.set(it.base.x, it.base.y - (1 - kk) * 0.45 + bob + it.hov * 0.045, it.base.z + it.hov * 0.06);
      it.g.scale.setScalar(0.55 + 0.45 * kk);
      it.g.rotation.z = it.tilt * (1 - it.hov);
      it.g.rotation.y = (active ? Math.sin(t * 0.45 + k * 2.1) * 0.55 : 0) * (1 - it.hov);
      it.mat.emissiveIntensity = (opts.hi ? 0.16 : 0.32) + 0.3 * it.hov;
      it.beamMat.uniforms.intensity.value = kk * (opts.hi ? 0.15 : 0.12) * (1 + 1.4 * it.hov);
      it.beamMat.uniforms.time.value = t;
    });
  };
  return {
    items, setAmount, tick,
    setHover: (id: LineupId | null) => { hover = id; },
    get amount() { return amount; },
  };
}
