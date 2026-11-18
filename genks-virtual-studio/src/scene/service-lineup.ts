// "The services under the spotlights": a small showroom in the dark studio. Four display plinths,
// each in its own cone of light, each with the object of its service floating and turning above it:
// a microphone (recording), a pad controller playing a pattern (custom beat), a fader module whose
// faders move (mix & master), a spinning vinyl record (Beat Store). Original geometry, drawn by code.
import * as THREE from "three";
import { addSweep, beamMaterial, type SweepUniforms } from "./cinema-shaders.ts";

export type LineupId = "recording" | "custom" | "mix" | "store";
export const LINEUP: { id: LineupId; accent: string }[] = [
  { id: "recording", accent: "#4C83FF" },
  { id: "custom", accent: "#7fa6ff" },
  { id: "mix", accent: "#9CBFFF" },
  { id: "store", accent: "#5b6ee8" },
];

function poolTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, "rgba(170,200,255,0.9)"); g.addColorStop(0.35, "rgba(76,131,255,0.35)"); g.addColorStop(1, "rgba(76,131,255,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

/** Vinyl: fine grooves catching the light, a blue centre label (no logo redrawn). */
function vinylTexture() {
  const s = 1024, c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#050608"; ctx.fillRect(0, 0, s, s);
  for (let r = s * 0.17; r < s * 0.49; r += 1.6) {
    ctx.strokeStyle = `rgba(255,255,255,${0.025 + 0.05 * Math.abs(Math.sin(r * 0.37))})`;
    ctx.lineWidth = 0.7; ctx.beginPath(); ctx.arc(s / 2, s / 2, r, 0, Math.PI * 2); ctx.stroke();
  }
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s * 0.16);
  g.addColorStop(0, "#9CBFFF"); g.addColorStop(0.5, "#4C83FF"); g.addColorStop(1, "#1d3a8f");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s / 2, s / 2, s * 0.16, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#e8efff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = `700 ${s * 0.04}px "Space Grotesk", sans-serif`; ctx.fillText("GENKS", s / 2, s / 2 - s * 0.06);
  ctx.font = `600 ${s * 0.022}px "Space Grotesk", sans-serif`; ctx.fillText("BEAT STORE · 33⅓", s / 2, s / 2 + s * 0.065);
  ctx.fillStyle = "#050608"; ctx.beginPath(); ctx.arc(s / 2, s / 2, s * 0.008, 0, Math.PI * 2); ctx.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export type Lineup = ReturnType<typeof buildLineup>;

export function buildLineup(scene: THREE.Scene, opts: { envMap: THREE.Texture; metal: THREE.Material; sweep: SweepUniforms; track: <T extends { dispose: () => void }>(o: T) => T; hi: boolean }) {
  const { track } = opts;
  const C = new THREE.Vector3(0.35, 1.1, 0.45);
  const root = new THREE.Group(); root.visible = false; scene.add(root);
  const std = (p: THREE.MeshStandardMaterialParameters, sweep = false) => {
    const m = track(new THREE.MeshStandardMaterial({ envMap: opts.envMap, envMapIntensity: 0.8, ...p }));
    if (sweep) addSweep(m, opts.sweep);
    return m;
  };
  const glow = (c: THREE.ColorRepresentation) => track(new THREE.MeshBasicMaterial({ color: c, toneMapped: false }));
  const add = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(track(g), m); o.position.set(x, y, z); parent.add(o); return o;
  };
  const V = (r: number, y: number) => new THREE.Vector2(r, y);
  const mBlack = std({ color: "#07090f", metalness: 0.4, roughness: 0.22 });
  const mPlinth = std({ color: "#0a0d16", metalness: 0.6, roughness: 0.3 }, true);
  const mDark = std({ color: "#11151f", metalness: 0.5, roughness: 0.4 });
  const mChrome = std({ color: "#e3e9f6", metalness: 1, roughness: 0.12 }, true);
  const mVinyl = std({ map: track(vinylTexture()), metalness: 0.2, roughness: 0.28 }, true);
  const ledRing = glow(new THREE.Color("#4C83FF").multiplyScalar(opts.hi ? 2.2 : 1));

  // ---------- the objects ----------
  type Anim = (t: number, hov: number) => void;
  const makeMic = (g: THREE.Group): Anim => {
    const m = new THREE.Group(); m.rotation.z = 0.12; g.add(m);
    add(new THREE.LatheGeometry([V(0, -0.11), V(0.016, -0.11), V(0.022, -0.1), V(0.024, -0.02), V(0.022, -0.012), V(0, -0.012)], 48), mChrome, m);
    const basket: THREE.Vector2[] = [V(0.025, -0.014), V(0.027, 0.02)];
    for (let i = 1; i <= 10; i++) { const a = (i / 10) * Math.PI / 2; basket.push(V(0.027 * Math.cos(a), 0.02 + 0.03 * Math.sin(a))); }
    add(new THREE.LatheGeometry(basket, 48), std({ color: "#c9d3e6", metalness: 1, roughness: 0.35 }, true), m);
    add(new THREE.TorusGeometry(0.0275, 0.0016, 8, 48), mChrome, m, 0, 0.004, 0).rotation.x = Math.PI / 2;
    add(new THREE.CircleGeometry(0.008, 24), ledRing, m, 0, -0.055, 0.0242);
    return () => {};
  };
  const makePads = (g: THREE.Group): Anim => {
    const m = new THREE.Group(); m.rotation.x = 0.75; g.add(m);
    add(new THREE.BoxGeometry(0.2, 0.026, 0.2), mBlack, m);
    const pads = new THREE.InstancedMesh(track(new THREE.BoxGeometry(0.036, 0.008, 0.036)), track(new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false })), 16);
    const mm = new THREE.Matrix4();
    for (let i = 0; i < 16; i++) { mm.makeTranslation(-0.066 + (i % 4) * 0.044, 0.016, -0.066 + Math.floor(i / 4) * 0.044); pads.setMatrixAt(i, mm); pads.setColorAt(i, new THREE.Color("#0b1530")); }
    m.add(pads);
    const col = new THREE.Color(), on = new THREE.Color("#4C83FF"), hot = new THREE.Color("#cfe0ff"), off = new THREE.Color("#0b1530");
    const pattern = [0, 5, 10, 15, 3, 6, 9, 12, 1, 7, 8, 14, 2, 4, 11, 13];
    return (t, hov) => {
      // a pattern plays on the pads (faster when pointed at)
      const step = Math.floor(t * (3 + 3 * hov)) % 16;
      for (let i = 0; i < 16; i++) {
        const hit = pattern[step] === i || pattern[(step + 8) % 16] === i;
        col.copy(hit ? hot : (i + step) % 5 === 0 ? on : off).multiplyScalar(hit ? (opts.hi ? 2.4 : 1) : 1);
        pads.setColorAt(i, col);
      }
      pads.instanceColor!.needsUpdate = true;
    };
  };
  const makeFaders = (g: THREE.Group): Anim => {
    const m = new THREE.Group(); m.rotation.x = 0.8; g.add(m);
    add(new THREE.BoxGeometry(0.2, 0.03, 0.17), mBlack, m);
    const caps: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) {
      const x = -0.066 + i * 0.044;
      add(new THREE.BoxGeometry(0.006, 0.004, 0.13), mDark, m, x, 0.016, 0);
      caps.push(add(new THREE.BoxGeometry(0.026, 0.016, 0.03), i === 3 ? mChrome : std({ color: "#20252f", metalness: 0.3, roughness: 0.35 }), m, x, 0.024, 0));
      add(new THREE.BoxGeometry(0.004, 0.003, 0.012), ledRing, m, x + 0.018, 0.017, -0.075);
    }
    return (t, hov) => caps.forEach((c, i) => { c.position.z = Math.sin(t * (0.9 + i * 0.37 + hov) + i * 1.3) * 0.045; });
  };
  const makeVinyl = (g: THREE.Group): Anim => {
    const m = new THREE.Group(); m.rotation.x = 1.05; g.add(m);
    const disc = add(new THREE.CylinderGeometry(0.105, 0.105, 0.003, 96), [mBlack, mVinyl, mVinyl] as unknown as THREE.Material, m);
    return (t, hov) => { disc.rotation.y = -t * (1.2 + 2.5 * hov); };
  };
  const makers: Record<LineupId, (g: THREE.Group) => Anim> = { recording: makeMic, custom: makePads, mix: makeFaders, store: makeVinyl };

  const tPool = track(poolTexture());
  const poolMat = track(new THREE.MeshBasicMaterial({ map: tPool, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  const items = LINEUP.map((it, k) => {
    const x = (k - 1.5) * 0.34;
    const base = new THREE.Vector3(C.x + x, C.y, C.z + 0.1 - 0.16 * (x / 0.51) ** 2);
    // display plinth: glossy black column with a blue LED ring under the top
    const plinth = new THREE.Group(); plinth.position.set(base.x, 0, base.z); root.add(plinth);
    add(new THREE.CylinderGeometry(0.095, 0.11, 0.86, 48), mPlinth, plinth, 0, 0.43, 0);
    add(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 48), mChrome, plinth, 0, 0.87, 0);
    add(new THREE.TorusGeometry(0.097, 0.003, 8, 64), ledRing, plinth, 0, 0.855, 0).rotation.x = Math.PI / 2;
    const g = new THREE.Group(); g.position.copy(base); root.add(g);
    const anim = makers[it.id](g);
    // its own spotlight: a cone of light from the ceiling and a pool of light on the floor
    const top = 3.3, len = top - 0.02;
    const beamMat = track(beamMaterial(it.accent));
    const beam = new THREE.Mesh(track(new THREE.ConeGeometry(0.21, len, 40, 1, true)), beamMat);
    beam.position.set(base.x, top - len / 2, base.z); beam.renderOrder = 3; beam.frustumCulled = false; root.add(beam);
    const pool = new THREE.Mesh(track(new THREE.PlaneGeometry(0.62, 0.62)), poolMat);
    pool.rotation.x = -Math.PI / 2; pool.position.set(base.x, 0.007, base.z); pool.renderOrder = 2; root.add(pool);
    const anchor = new THREE.Object3D(); anchor.position.set(base.x, 0.9, base.z + 0.13); root.add(anchor);
    const hit = new THREE.Object3D(); hit.position.copy(base); root.add(hit);
    void k;
    return { id: it.id, g, plinth, anim, beamMat, base, anchor, hit, hov: 0 };
  });
  const spot = new THREE.SpotLight("#dfe7ff", 0, 6, 0.5, 0.85, 1.4);
  // one more light per pixel only where the GPU can afford it
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
      // one after another the plinths rise from the floor into their light, the object follows
      const kk = THREE.MathUtils.smoothstep(amount * 1.45 - k * 0.13, 0, 1);
      it.hov += ((hover === it.id ? 1 : 0) - it.hov) * e;
      const bob = active ? Math.sin(t * 0.9 + k * 1.7) * 0.01 : 0;
      it.plinth.position.y = -(1 - kk) * 0.9;
      it.g.position.set(it.base.x, it.base.y - (1 - kk) * 0.9 + bob + it.hov * 0.035, it.base.z + it.hov * 0.05);
      // turning slowly left and right, always showing its face; pointed at, it faces the camera
      it.g.rotation.y = active ? Math.sin(t * 0.5 + k * 1.3) * 0.55 * (1 - it.hov) : 0;
      it.g.scale.setScalar(1.45 * (1 + 0.12 * it.hov));
      if (active) it.anim(t, it.hov);
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
