// Photographic PBR textures and scanned models from Poly Haven (CC0), stored locally in public/assets.
// They load after the first frame and replace the procedural placeholders; if anything fails the
// procedural look simply stays.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export type PhotoSlot = {
  material: THREE.MeshStandardMaterial;
  name: "parquet" | "walnut" | "linen" | "leather" | "wool" | "plaster";
  repeat: [number, number];
  tint: string;
  rotate?: boolean;
  normalScale?: number;
  roughness?: number;
};

export type PhotoModel = { name: string; position: [number, number, number]; rotationY: number; scale?: number; tint?: string };

export function loadPhotoAssets(scene: THREE.Scene, slots: PhotoSlot[], models: PhotoModel[], hi: boolean, alive: () => boolean, onDispose: (d: { dispose: () => void }) => void) {
  const size = hi ? 1024 : 512;
  const loader = new THREE.TextureLoader();
  const cache = new Map<string, Promise<THREE.Texture>>();
  const load = (file: string, srgb: boolean) => {
    const key = file + srgb;
    if (!cache.has(key)) {
      cache.set(key, loader.loadAsync(`${import.meta.env.BASE_URL}assets/tex/${file}-${size}.webp`).then(t => {
        t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.anisotropy = hi ? 8 : 2;
        onDispose(t);
        return t;
      }));
    }
    return cache.get(key)!;
  };
  // each slot gets its own clone so repeat/rotation can differ while the image is shared
  const place = (t: THREE.Texture, s: PhotoSlot) => {
    const c = t.clone();
    c.repeat.set(s.repeat[0], s.repeat[1]);
    if (s.rotate) { c.center.set(0.5, 0.5); c.rotation = Math.PI / 2; }
    c.needsUpdate = true;
    onDispose(c);
    return c;
  };
  for (const s of slots) {
    Promise.all([load(`${s.name}-d`, true), load(`${s.name}-n`, false), load(`${s.name}-arm`, false)]).then(([d, n, arm]) => {
      if (!alive()) return;
      const m = s.material;
      m.map = place(d, s);
      m.normalMap = place(n, s);
      m.normalScale.setScalar(s.normalScale ?? 1);
      m.roughnessMap = place(arm, s);
      m.aoMap = hi ? m.roughnessMap : null;
      m.bumpMap = null;
      m.roughness = s.roughness ?? 1;
      m.color.set(s.tint);
      m.needsUpdate = true;
    }).catch(() => { /* keep the procedural material */ });
  }
  const gltf = new GLTFLoader();
  for (const md of models) {
    gltf.loadAsync(`/assets/models/${md.name}/${md.name}${hi ? "" : ".low"}.gltf`).then(g => {
      if (!alive()) return;
      const root = g.scene;
      root.position.set(...md.position);
      root.rotation.y = md.rotationY;
      if (md.scale) root.scale.setScalar(md.scale);
      root.traverse(o => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = true; mesh.receiveShadow = true;
        onDispose(mesh.geometry);
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach(mm => {
          const sm = mm as THREE.MeshStandardMaterial;
          if (md.tint && sm.color) sm.color.set(md.tint);
          [sm.map, sm.normalMap, sm.roughnessMap, sm.metalnessMap, sm.aoMap].forEach(t => { if (t) { t.anisotropy = hi ? 8 : 2; onDispose(t); } });
          onDispose(sm);
        });
      });
      scene.add(root);
    }).catch(() => { /* optional dressing */ });
  }
}
