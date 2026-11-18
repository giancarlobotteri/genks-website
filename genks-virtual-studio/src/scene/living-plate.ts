// The living photograph: the studio footage (and the record vault) drawn with its own depth map, so
// the real picture reacts like a real place. Moving the mouse, a finger or the phone moves the camera
// (near objects slide over the background, with occlusion), the cursor is a light that models the
// objects by their shape, dust floats in the air in front of and behind them and drifts away from the
// pointer, the object under the pointer lights up. Depth: Depth Anything V2 on every frame of the film
// (colour on top, depth below, in the same video, so they never drift apart).
import * as THREE from "three";

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// frame coordinates (0..1, y down) of a screen point, and the two halves of the stacked texture
const COMMON = /* glsl */ `
uniform sampler2D uTex, uDepth;
uniform float uStacked;
uniform vec2 uUvScale, uUvOff, uPar;
uniform float uFocus;
vec2 frameUv(vec2 s) { return s * uUvScale + uUvOff; }
vec3 colorAt(vec2 f) { f = clamp(f, 0.001, 0.999); return uStacked > 0.5 ? texture2D(uTex, vec2(f.x, 1.0 - f.y * 0.5)).rgb : texture2D(uTex, vec2(f.x, 1.0 - f.y)).rgb; }
float depthAt(vec2 f) { f = clamp(f, 0.001, 0.999); return uStacked > 0.5 ? texture2D(uTex, vec2(f.x, 0.5 - f.y * 0.5)).r : texture2D(uDepth, vec2(f.x, 1.0 - f.y)).r; }
// the camera moves: near things slide more than far ones (a few steps keep the edges in place)
vec2 parallax(vec2 f) {
  vec2 g = f;
  for (int i = 0; i < 4; i++) g = f - uPar * (depthAt(g) - uFocus);
  return g;
}`;

const FRAG = /* glsl */ `
${COMMON}
uniform vec3 uLight;   // x, y in frame coordinates, amount
uniform vec3 uHover;   // (unused, kept for compatibility)
uniform vec4 uPick;    // what the pointer is on: x, y in frame coordinates, radius, amount
uniform float uAspect, uTime, uExposure;
varying vec2 vUv;
void main() {
  vec2 s = vec2(vUv.x, 1.0 - vUv.y);
  vec2 f0 = parallax(frameUv(s));
  // the object under the pointer: the surface at the pointer's depth, around it
  vec2 fc = uPick.xy;
  float dC = depthAt(fc);
  vec2 rv = (f0 - fc) * vec2(uAspect, 1.0);
  float area = exp(-dot(rv, rv) / max(1e-4, uPick.z * uPick.z));
  float same = 1.0 - smoothstep(0.05, 0.17, abs(depthAt(f0) - dC));
  float m = area * same * uPick.w;
  // it lifts out of the picture, towards the viewer
  vec2 f = mix(f0, fc + (f0 - fc) * 0.92, m);
  vec3 col = colorAt(f);
  float d = depthAt(f);
  // everything else falls out of focus, loses colour and goes darker
  float rest = uPick.w * (1.0 - m);
  if (rest > 0.01) {
    float b = 0.004 * rest;
    col = (col * 2.0 + colorAt(f + vec2(b, 0.0)) + colorAt(f - vec2(b, 0.0)) + colorAt(f + vec2(0.0, b * 1.7)) + colorAt(f - vec2(0.0, b * 1.7))) / 6.0;
    float g = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(col, vec3(g) * vec3(0.78, 0.86, 1.0), 0.4 * rest) * (1.0 - 0.45 * rest);
  }
  // shape from depth: the light models the real objects
  float e = 0.0025;
  float dx = depthAt(f + vec2(e, 0.0)) - depthAt(f - vec2(e, 0.0));
  float dy = depthAt(f + vec2(0.0, e)) - depthAt(f - vec2(0.0, e));
  vec3 n = normalize(vec3(-dx * 22.0, dy * 22.0, 1.0));
  vec2 lv = (uLight.xy - f) * vec2(uAspect, 1.0);
  vec3 L = normalize(vec3(lv, 0.32));
  // a spotlight in the hand: a tight pool of light, the rest of the room a little darker
  float fall = exp(-dot(lv, lv) * 16.0);
  float lam = max(dot(n, L), 0.0);
  float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 24.0);
  float near = smoothstep(0.15, 0.85, d);
  vec3 tint = vec3(0.7, 0.84, 1.25);
  col *= 1.0 - 0.22 * uLight.z * (1.0 - fall);
  col += col * tint * lam * fall * uLight.z * (0.9 + 1.4 * near);
  col += tint * spec * fall * uLight.z * 0.35 * near;
  // the object shines: brighter, crisper, and a pulsing rim of blue light runs along its silhouette
  col = mix(col, (col - 0.5) * 1.15 + 0.5, m) * (1.0 + 0.4 * m);
  float edge = smoothstep(0.012, 0.05, length(vec2(dx, dy)));
  float rim = edge * area * (1.0 - smoothstep(0.06, 0.2, abs(d - dC))) * uPick.w;
  float pulse = 0.7 + 0.3 * sin(uTime * 4.2 - length(rv) * 30.0);
  col += vec3(0.32, 0.58, 1.0) * rim * pulse * 1.4;
  // the picture stays in its own (display) colour space from texture to screen: no double conversion
  gl_FragColor = vec4(col * uExposure, 1.0);
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

export function createLivingPlate(renderer: THREE.WebGLRenderer, video: HTMLVideoElement | null, vault: { color: string; depth: string }, hi: boolean) {
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const vt = video ? new THREE.VideoTexture(video) : null;
  if (vt) { vt.colorSpace = THREE.NoColorSpace; vt.minFilter = THREE.LinearFilter; vt.magFilter = THREE.LinearFilter; vt.generateMipmaps = false; }
  const loader = new THREE.TextureLoader();
  const vColor = loader.load(vault.color); vColor.colorSpace = THREE.NoColorSpace;
  const vDepth = loader.load(vault.depth);
  const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); blank.needsUpdate = true;

  const shared = {
    uTex: { value: (vt ?? blank) as THREE.Texture }, uDepth: { value: blank as THREE.Texture }, uStacked: { value: 1 },
    uUvScale: { value: new THREE.Vector2(1, 1) }, uUvOff: { value: new THREE.Vector2(0, 0) },
    uPar: { value: new THREE.Vector2() }, uFocus: { value: 0.55 }, uTime: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false,
    uniforms: { ...shared, uLight: { value: new THREE.Vector3(0.5, 0.4, 0) }, uHover: { value: new THREE.Vector3(0.5, 0.5, 0) }, uPick: { value: new THREE.Vector4(0.5, 0.5, 0.15, 0) }, uAspect: { value: 16 / 9 }, uExposure: { value: 1 } },
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
        shared.uTex.value = src === "film" ? (vt ?? blank) : vColor;
        shared.uDepth.value = src === "film" ? blank : vDepth;
        shared.uStacked.value = src === "film" ? 1 : 0;
      }
      const W = src === "film" ? 1920 : 6336, H = src === "film" ? 1080 : 2688;
      const cs = Math.max(o.w / W, o.h / H), dw = W * cs, dh = H * cs;
      const offX = (o.w - dw) * o.ox, offY = (o.h - dh) * 0.5;
      shared.uUvScale.value.set(o.w / (o.k * dw), o.h / (o.k * dh));
      shared.uUvOff.value.set(((-o.tx - o.w / 2) / o.k + o.w / 2 - offX) / dw, ((-o.ty - o.h / 2) / o.k + o.h / 2 - offY) / dh);
      // frame coordinates of a screen point (for the light and the hover)
      const toFrame = (sx: number, sy: number): [number, number] => [sx * shared.uUvScale.value.x + shared.uUvOff.value.x, sy * shared.uUvScale.value.y + shared.uUvOff.value.y];
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
      dust.visible = o.dust > 0.01;
      const tm = renderer.toneMapping;
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.setRenderTarget(null);
      renderer.render(scene, cam);
      renderer.toneMapping = tm;
    },
    dispose() {
      vt?.dispose(); vColor.dispose(); vDepth.dispose(); blank.dispose();
      mat.dispose(); dustMat.dispose(); quad.geometry.dispose(); dg.dispose();
    },
  };
}
