// The Beat Store has its own place: a dark record vault beyond the mixer display.
// A long corridor of vertical light bars reflected in a black glossy floor, a slow helix of vinyl
// records turning in the depth, dust in the air. The camera travels through it with the catalogue:
// every page moves it further in, the "Pacchetti" tab lifts it to a high angle, the pointer adds parallax.
// Original, built by code; rendered only while the Beat Store is on screen.
import * as THREE from "three";

function vinylTex() {
  const s = 512, c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#040507"; ctx.fillRect(0, 0, s, s);
  for (let r = s * 0.17; r < s * 0.49; r += 1.4) {
    ctx.strokeStyle = `rgba(255,255,255,${0.03 + 0.06 * Math.abs(Math.sin(r * 0.41))})`;
    ctx.lineWidth = 0.6; ctx.beginPath(); ctx.arc(s / 2, s / 2, r, 0, Math.PI * 2); ctx.stroke();
  }
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s * 0.16);
  g.addColorStop(0, "#9CBFFF"); g.addColorStop(1, "#1d3a8f");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s / 2, s / 2, s * 0.16, 0, Math.PI * 2); ctx.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function glowTex() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(156,191,255,0.9)"); g.addColorStop(0.3, "rgba(76,131,255,0.35)"); g.addColorStop(1, "rgba(76,131,255,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export type StoreEnv = ReturnType<typeof buildStoreEnv>;

export function buildStoreEnv(hi: boolean) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#02040a");
  scene.fog = new THREE.FogExp2("#02040a", 0.075);
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(o: T) => { disposables.push(o); return o; };
  const camera = new THREE.PerspectiveCamera(46, 1, 0.05, 60);
  const BLUE = new THREE.Color("#4C83FF"), LIGHT = new THREE.Color("#9CBFFF");
  const glow = hi ? 1 : 0.85;

  // the world above the floor; its mirror image below gives the glossy-floor reflection
  const world = new THREE.Group(); scene.add(world);
  const mirror = new THREE.Group(); mirror.scale.y = -1; scene.add(mirror);
  const both = (make: () => THREE.Object3D) => { world.add(make()); const m = make(); mirror.add(m); return m; };

  // ---- light bars: a corridor receding into the dark ----
  const barGeo = track(new THREE.BoxGeometry(0.05, 3.2, 0.05));
  const barMat = track(new THREE.MeshBasicMaterial({ color: BLUE.clone().multiplyScalar(1.2 * glow), toneMapped: false, fog: true, side: THREE.DoubleSide }));
  const barMatSoft = track(new THREE.MeshBasicMaterial({ color: LIGHT.clone().multiplyScalar(0.9 * glow), toneMapped: false, fog: true, side: THREE.DoubleSide }));
  const bars: THREE.Mesh[] = [];
  const makeBars = () => {
    const g = new THREE.Group();
    for (let i = 0; i < 14; i++) for (const side of [-1, 1]) {
      const b = new THREE.Mesh(barGeo, i % 3 === 0 ? barMatSoft : barMat);
      b.position.set(side * (2.4 + (i % 2) * 0.12), 1.6, 2 - i * 1.7);
      g.add(b); bars.push(b);
    }
    // ceiling strips
    for (let i = 0; i < 10; i++) {
      const s = new THREE.Mesh(track(new THREE.BoxGeometry(4.6, 0.02, 0.05)), barMat);
      s.position.set(0, 3.25, 1 - i * 2.4); g.add(s);
    }
    return g;
  };
  both(makeBars);
  // halos around the bars (soft glow without post-processing)
  const tGlow = track(glowTex());
  const haloMat = track(new THREE.SpriteMaterial({ map: tGlow, color: "#6f9dff", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }));
  for (let i = 0; i < 14; i++) for (const side of [-1, 1]) {
    const sp = new THREE.Sprite(haloMat); sp.position.set(side * 2.4, 1.6, 2 - i * 1.7); sp.scale.set(1.1, 3.6, 1); world.add(sp);
  }

  // ---- floor: dark glass over the mirrored world ----
  const floor = new THREE.Mesh(track(new THREE.PlaneGeometry(14, 40)), track(new THREE.MeshBasicMaterial({ color: "#02040a", transparent: true, opacity: 0.78, depthWrite: true })));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -10); scene.add(floor);
  // a lane of light on the floor
  const lane = new THREE.Mesh(track(new THREE.PlaneGeometry(1.6, 40)), track(new THREE.MeshBasicMaterial({ map: tGlow, color: "#4C83FF", transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending })));
  lane.rotation.x = -Math.PI / 2; lane.position.set(0, 0.01, -10); scene.add(lane);

  // ---- the records: a slow helix of vinyls turning in the depth ----
  const N = hi ? 26 : 16;
  const vinylGeo = track(new THREE.CylinderGeometry(0.34, 0.34, 0.012, 64));
  const vt = track(vinylTex());
  const vinylMat = [
    track(new THREE.MeshBasicMaterial({ color: "#05070c", fog: true, side: THREE.DoubleSide })),
    track(new THREE.MeshBasicMaterial({ map: vt, fog: true, side: THREE.DoubleSide })),
    track(new THREE.MeshBasicMaterial({ map: vt, fog: true, side: THREE.DoubleSide })),
  ];
  const records: { m: THREE.Mesh; mm: THREE.Mesh; a: number; y: number; z: number; spin: number }[] = [];
  for (let i = 0; i < N; i++) {
    const m = new THREE.Mesh(vinylGeo, vinylMat); world.add(m);
    const mm = new THREE.Mesh(vinylGeo, vinylMat); mirror.add(mm);
    records.push({ m, mm, a: (i / N) * Math.PI * 4, y: 1.0 + (i % 5) * 0.32, z: -2.5 - i * 0.62, spin: 0.4 + (i % 4) * 0.25 });
  }
  // a rim light behind each record
  const rimMat = track(new THREE.SpriteMaterial({ map: tGlow, color: "#4C83FF", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.35 }));
  const rims = records.map(() => { const s = new THREE.Sprite(rimMat); s.scale.setScalar(1.1); world.add(s); return s; });

  // ---- dust ----
  const D = hi ? 500 : 220;
  const dg = new THREE.BufferGeometry();
  const dp = new Float32Array(D * 3);
  for (let i = 0; i < D; i++) { dp[i * 3] = (Math.random() - 0.5) * 5; dp[i * 3 + 1] = Math.random() * 3.2; dp[i * 3 + 2] = 2 - Math.random() * 22; }
  dg.setAttribute("position", new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(track(dg), track(new THREE.PointsMaterial({ color: "#9CBFFF", size: 0.018, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })));
  world.add(dust);

  // ---- camera direction ----
  const cam = { x: 0, y: 1.35, z: 4.2, tx: 0, ty: 1.3, tz: -6 };
  const want = { ...cam };
  let enterT = -1;
  const ptr = { x: 0, y: 0 };
  const onMove = (e: PointerEvent) => { if (e.pointerType === "mouse") { ptr.x = e.clientX / window.innerWidth - 0.5; ptr.y = e.clientY / window.innerHeight - 0.5; } };
  window.addEventListener("pointermove", onMove, { passive: true });

  /** Where the camera should be for this view of the catalogue. */
  const aim = (tab: "beats" | "bundles", page: number) => {
    if (tab === "bundles") Object.assign(want, { x: 1.3, y: 2.5, z: 1.6, tx: -0.3, ty: 1.0, tz: -9 });
    else {
      const p = Math.min(page, 6);
      Object.assign(want, { x: (p % 2 ? 0.7 : -0.7) * Math.min(1, p), y: 1.35 + (p % 3) * 0.12, z: 4.2 - p * 1.6, tx: (p % 2 ? -0.4 : 0.4) * Math.min(1, p), ty: 1.3, tz: -6 - p * 1.6 });
    }
  };
  /** Entering the store: start deep inside the light, then pull back to the first view. */
  const enter = (now: number) => { enterT = now; Object.assign(cam, { x: 0, y: 1.3, z: -3.5, tx: 0, ty: 1.3, tz: -14 }); };

  const tick = (now: number, dt: number, w: number, h: number, active: boolean) => {
    const t = now / 1000;
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 64 : 46;
    camera.updateProjectionMatrix();
    // slow cinematic glide (critically damped), slower right after entering
    const k = 1 - Math.exp(-dt * (enterT >= 0 && now - enterT < 2600 ? 1.1 : 1.8));
    (Object.keys(cam) as (keyof typeof cam)[]).forEach(key => { cam[key] += (want[key] - cam[key]) * k; });
    const sway = active ? Math.sin(t * 0.21) * 0.12 : 0;
    camera.position.set(cam.x + sway + ptr.x * 0.35, cam.y + (active ? Math.sin(t * 0.17) * 0.05 : 0) - ptr.y * 0.2, cam.z);
    camera.lookAt(cam.tx + ptr.x * 0.6, cam.ty, cam.tz);
    // records turn on their helix
    records.forEach((r, i) => {
      const a = r.a + (active ? t * 0.06 : 0);
      const x = Math.cos(a) * 1.3, y = r.y + Math.sin(a * 0.5) * 0.1;
      r.m.position.set(x, y, r.z); r.mm.position.set(x, y, r.z);
      r.m.rotation.set(1.25, 0, 0.2 + Math.sin(a) * 0.3);
      r.m.rotateY(active ? t * r.spin : 0);
      r.mm.rotation.copy(r.m.rotation);
      rims[i].position.set(x, y, r.z - 0.08);
    });
    // light bars breathe in a wave travelling into the depth
    const pulse = active ? 0.85 + 0.15 * Math.sin(t * 1.4) : 1;
    barMat.color.copy(BLUE).multiplyScalar(1.2 * glow * pulse);
    if (active) dust.position.y = Math.sin(t * 0.1) * 0.05;
  };

  return {
    scene, camera, aim, enter, tick,
    dispose() { window.removeEventListener("pointermove", onMove); disposables.forEach(d => d.dispose()); },
  };
}
