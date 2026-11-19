// The living photograph: the studio footage (and the record vault) drawn with its own depth map, so
// the real picture reacts like a real place. Moving the mouse, a finger or the phone moves the camera
// (near objects slide over the background), the cursor is a light that models the objects by their
// shape, the object under the pointer comes forward while the rest steps into the shade, and the
// picture stays sharp at every size (mipmaps + a one-screen-pixel unsharp mask). Depth: Depth Anything V2 on every frame of the film
// (one atlas, always in memory: the depth of the frame on screen is always there).
import * as THREE from "three";
import type { FilmSeq } from "../lib/film-seq.ts";

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// frame coordinates (0..1, y down) of a screen point, and the two halves of the stacked texture
const COMMON = /* glsl */ `
uniform sampler2D uTex, uDepth;
uniform float uStacked;   // 1: a film frame (top-down bitmap) with its cell of the depth atlas; 0: a still with its own depth map
uniform vec2 uCell, uGrid;
uniform vec2 uUvScale, uUvOff, uPar;
uniform float uFocus;
vec2 frameUv(vec2 s) { return s * uUvScale + uUvOff; }
vec3 colorAt(vec2 f) { f = clamp(f, 0.001, 0.999); return uStacked > 0.5 ? texture2D(uTex, f).rgb : texture2D(uTex, vec2(f.x, 1.0 - f.y)).rgb; }
float depthAt(vec2 f) {
  if (uStacked > 0.5) { f = clamp(f, 0.006, 0.994); vec2 a = (uCell + f) / uGrid; return texture2D(uDepth, vec2(a.x, 1.0 - a.y)).r; }
  f = clamp(f, 0.001, 0.999); return texture2D(uDepth, vec2(f.x, 1.0 - f.y)).r;
}
// depth with its fine noise smoothed away: the camera move and the light follow the shapes, never the
// pixels of the depth map (that was the tearing and the grain around the edges while the mouse moved)
float depthSoft(vec2 f) {
  const float r = 0.011;
  return (depthAt(f) * 2.0 + depthAt(f + vec2(r, 0.0)) + depthAt(f - vec2(r, 0.0)) + depthAt(f + vec2(0.0, r * 1.7)) + depthAt(f - vec2(0.0, r * 1.7))) / 6.0;
}
// the camera move follows a wide, soft version of the depth: the picture bends gently around the objects
// instead of stretching their rims of light into streaks
float depthWide(vec2 f) {
  const float r = 0.05;
  vec2 q = vec2(r, r * 1.7);
  float a = depthAt(f) * 2.0;
  a += depthAt(f + vec2(q.x, 0.0)) + depthAt(f - vec2(q.x, 0.0)) + depthAt(f + vec2(0.0, q.y)) + depthAt(f - vec2(0.0, q.y));
  a += depthAt(f + q * 0.7) + depthAt(f - q * 0.7) + depthAt(f + vec2(q.x, -q.y) * 0.7) + depthAt(f + vec2(-q.x, q.y) * 0.7);
  return a / 10.0;
}
vec2 parallax(vec2 f) {
  vec2 g = f;
  for (int i = 0; i < 2; i++) g = f - uPar * (depthWide(g) - uFocus);
  return g;
}`;

const FRAG = /* glsl */ `
${COMMON}
uniform vec3 uLight;   // x, y in frame coordinates, amount
uniform vec3 uHover;   // (unused, kept for compatibility)
uniform vec4 uPick;    // the object under the pointer: x, y in frame coordinates, radius, amount
uniform float uAspect, uTime, uExposure, uTexel, uSharp;
varying vec2 vUv;
void main() {
  vec2 s = vec2(vUv.x, 1.0 - vUv.y);
  vec2 f = parallax(frameUv(s));
  vec3 col = colorAt(f);
  // crisp: an unsharp mask at the size of one screen pixel (never finer, never coarser)
  vec2 b = vec2(uTexel, uTexel * uAspect);
  vec3 avg = (colorAt(f + vec2(b.x, 0.0)) + colorAt(f - vec2(b.x, 0.0)) + colorAt(f + vec2(0.0, b.y)) + colorAt(f - vec2(0.0, b.y))) * 0.25;
  col = max(col + (col - avg) * uSharp, 0.0);
  float d = depthSoft(f);
  // the object under the pointer: the surface at its depth, around it, with soft edges
  vec2 fc = uPick.xy;
  float dC = depthSoft(fc);
  vec2 rv = (f - fc) * vec2(uAspect, 1.0);
  float area = exp(-dot(rv, rv) / max(1e-4, uPick.z * uPick.z));
  float same = 1.0 - smoothstep(0.07, 0.22, abs(d - dC));
  float m = area * mix(0.35, 1.0, same) * uPick.w;
  // everything else steps back into the shade (no blur: the picture stays sharp everywhere)
  float rest = uPick.w * (1.0 - m);
  float g = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(g) * vec3(0.86, 0.92, 1.04), 0.28 * rest) * (1.0 - 0.38 * rest);
  // and the object comes forward: a touch brighter and richer
  col = mix(col, col * 1.2 + (col - g) * 0.18, m);
  // shape from depth: the light in the hand models the real objects
  float e = 0.009;
  float dx = depthSoft(f + vec2(e, 0.0)) - depthSoft(f - vec2(e, 0.0));
  float dy = depthSoft(f + vec2(0.0, e)) - depthSoft(f - vec2(0.0, e));
  vec3 n = normalize(vec3(-dx * 9.0, dy * 9.0, 1.0));
  vec2 lv = (uLight.xy - f) * vec2(uAspect, 1.0);
  vec3 L = normalize(vec3(lv, 0.45));
  float fall = exp(-dot(lv, lv) * 9.0);
  float lam = max(dot(n, L), 0.0);
  float near = smoothstep(0.15, 0.85, d);
  vec3 tint = vec3(0.8, 0.9, 1.15);
  col *= 1.0 - 0.16 * uLight.z * (1.0 - fall);
  col += col * tint * lam * fall * uLight.z * (0.18 + 0.32 * near);
  // when the whole frame is shown inside a taller screen, its edges melt into the dark
  col *= smoothstep(-0.07, 0.0, f.y) * smoothstep(1.07, 1.0, f.y) * smoothstep(-0.03, 0.0, f.x) * smoothstep(1.03, 1.0, f.x);
  // the picture stays in its own (display) colour space from texture to screen: no double conversion
  gl_FragColor = vec4(min(col * uExposure, vec3(1.0)), 1.0);
}`;

const DUST_VERT = /* glsl */ `
${COMMON}
attribute vec3 seed;   // x, y (0..1 screen), z (nearness)
uniform float uTime, uPx;
uniform vec2 uMouse;   // screen 0..1, y down
varying float vA, vZ, vScene;
void main() {
  float z = seed.z;
  vec2 s = seed.xy;
  s.y = fract(s.y - uTime * (0.006 + 0.012 * z) + 1.0);
  s.x += sin(uTime * 0.2 + seed.y * 31.0) * 0.01;
  // the air moves away from the pointer
  vec2 dm = s - uMouse;
  s += normalize(dm + 1e-5) * 0.07 * exp(-dot(dm, dm) * 60.0) * (0.4 + z);
  // the same camera move as the picture
  s += uPar * (z - uFocus) / max(uUvScale, vec2(1e-3)) * 0.9;
  vZ = z;
  vScene = depthAt(frameUv(s));
  vA = 0.25 + 0.55 * z;
  gl_Position = vec4(s.x * 2.0 - 1.0, 1.0 - s.y * 2.0, 0.0, 1.0);
  gl_PointSize = uPx * (1.0 + 3.2 * z * z);
}`;

const DUST_FRAG = /* glsl */ `
varying float vA, vZ, vScene;
void main() {
  // behind a real object: hidden by it
  if (vZ < vScene - 0.04) discard;
  vec2 c = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.0, length(c));
  gl_FragColor = vec4(vec3(0.72, 0.82, 1.0) * a * vA, a * vA);
}`;

export type LivingPlate = ReturnType<typeof createLivingPlate>;

export function createLivingPlate(renderer: THREE.WebGLRenderer, film: FilmSeq | null, depth: { atlas: string; grid: [number, number] }, vault: { color: string; depth: string }, hi: boolean) {
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  // the frame on screen (a decoded bitmap, top-down) and the depth of all frames
  const vt = film ? new THREE.Texture() : null;
  if (vt) { vt.flipY = false; vt.colorSpace = THREE.NoColorSpace; vt.minFilter = THREE.LinearMipmapLinearFilter; vt.magFilter = THREE.LinearFilter; vt.generateMipmaps = true; vt.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); }
  let shownIdx = -1;
  const loader = new THREE.TextureLoader();
  const atlas = loader.load(depth.atlas); atlas.generateMipmaps = false; atlas.minFilter = THREE.LinearFilter;
  const vColor = loader.load(vault.color); vColor.colorSpace = THREE.NoColorSpace; vColor.minFilter = THREE.LinearMipmapLinearFilter;
  const vDepth = loader.load(vault.depth);
  const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); blank.needsUpdate = true;

  const shared = {
    uTex: { value: blank as THREE.Texture }, uDepth: { value: atlas as THREE.Texture }, uStacked: { value: 1 },
    uCell: { value: new THREE.Vector2() }, uGrid: { value: new THREE.Vector2(depth.grid[0], depth.grid[1]) },
    uUvScale: { value: new THREE.Vector2(1, 1) }, uUvOff: { value: new THREE.Vector2(0, 0) },
    uPar: { value: new THREE.Vector2() }, uFocus: { value: 0.55 }, uTime: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false,
    uniforms: { ...shared, uLight: { value: new THREE.Vector3(0.5, 0.4, 0) }, uHover: { value: new THREE.Vector3(0.5, 0.5, 0) }, uPick: { value: new THREE.Vector4(0.5, 0.5, 0.15, 0) }, uAspect: { value: 16 / 9 }, uExposure: { value: 1 }, uTexel: { value: 1 / 1920 }, uSharp: { value: 0.35 } },
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  scene.add(quad);

  const N = hi ? 900 : 380;
  const seeds = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { seeds[i * 3] = Math.random(); seeds[i * 3 + 1] = Math.random(); seeds[i * 3 + 2] = Math.pow(Math.random(), 1.6); }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  dg.setAttribute("seed", new THREE.BufferAttribute(seeds, 3));
  const dustMat = new THREE.ShaderMaterial({
    vertexShader: DUST_VERT, fragmentShader: DUST_FRAG, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { ...shared, uMouse: { value: new THREE.Vector2(-1, -1) }, uPx: { value: 1.6 } },
  });
  const dust = new THREE.Points(dg, dustMat);
  dust.frustumCulled = false;
  // no floating particles over the photograph (the footage has its own air)
  dust.visible = false;
  scene.add(dust);

  let src: "film" | "vault" = "film";
  return {
    /**
     * Draw one frame. Layout: the source covers the w×h screen (object position `ox`), scaled by `k`
     * around the centre and moved by tx, ty (px). Pointer and light in screen fractions (0..1, y down).
     */
    render(o: {
      source: "film" | "vault"; w: number; h: number; ox: number; k: number; tx: number; ty: number;
      par: [number, number]; light: [number, number, number]; hover: [number, number, number] | null; mouse: [number, number]; time: number; dust: number;
      /** what the pointer is on: x, y (frame coordinates if `frame`, else screen fractions), radius, amount */
      focus?: { x: number; y: number; frame: boolean; r: number; a: number };
    }) {
      if (o.source !== src) {
        src = o.source;
        shared.uDepth.value = src === "film" ? atlas : vDepth;
        shared.uStacked.value = src === "film" ? 1 : 0;
        if (src === "vault") shared.uTex.value = vColor;
        shownIdx = -1;
      }
      if (src === "film" && film && vt) {
        const near = film.bitmapNear(film.frame());
        if (!near) return false;
        if (near.i !== shownIdx) {
          shownIdx = near.i;
          vt.image = near.bmp; vt.needsUpdate = true;
          shared.uTex.value = vt;
          shared.uCell.value.set(near.i % depth.grid[0], Math.floor(near.i / depth.grid[0]));
        }
      }
      const W = src === "film" ? 1920 : 6336, H = src === "film" ? 1080 : 2688;
      const cs = Math.max(o.w / W, o.h / H), dw = W * cs, dh = H * cs;
      const offX = (o.w - dw) * o.ox, offY = (o.h - dh) * 0.5;
      shared.uUvScale.value.set(o.w / (o.k * dw), o.h / (o.k * dh));
      shared.uUvOff.value.set(((-o.tx - o.w / 2) / o.k + o.w / 2 - offX) / dw, ((-o.ty - o.h / 2) / o.k + o.h / 2 - offY) / dh);
      // frame coordinates of a screen point (for the light and the hover)
      const toFrame = (sx: number, sy: number): [number, number] => [sx * shared.uUvScale.value.x + shared.uUvOff.value.x, sy * shared.uUvScale.value.y + shared.uUvOff.value.y];
      mat.uniforms.uTexel.value = Math.max(1 / (src === "film" && vt?.image ? (vt.image as ImageBitmap).width : W), shared.uUvScale.value.x / Math.max(1, o.w * renderer.getPixelRatio()));
      shared.uPar.value.set(o.par[0], o.par[1]);
      shared.uTime.value = o.time;
      const lf = toFrame(o.light[0], o.light[1]);
      mat.uniforms.uLight.value.set(lf[0], lf[1], o.light[2]);
      if (o.focus) {
        const fp = o.focus.frame ? [o.focus.x, o.focus.y] : toFrame(o.focus.x, o.focus.y);
        mat.uniforms.uPick.value.set(fp[0], fp[1], o.focus.r, o.focus.a);
      } else mat.uniforms.uPick.value.w = 0;
      mat.uniforms.uAspect.value = W / H;
      dustMat.uniforms.uMouse.value.set(o.mouse[0], o.mouse[1]);
      dustMat.uniforms.uPx.value = 1.4 * renderer.getPixelRatio() * (o.h / 900 + 0.4);
      dust.visible = false; void o.dust;
      const tm = renderer.toneMapping;
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.setRenderTarget(null);
      renderer.render(scene, cam);
      renderer.toneMapping = tm;
      return true;
    },
    dispose() {
      vt?.dispose(); atlas.dispose(); vColor.dispose(); vDepth.dispose(); blank.dispose();
      mat.dispose(); dustMat.dispose(); quad.geometry.dispose(); dg.dispose();
    },
  };
}
