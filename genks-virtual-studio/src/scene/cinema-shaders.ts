// Small custom shaders for the cinematic look. All original code (MIT, part of this project).
import * as THREE from "three";

/** Shared uniforms of the light sweep: a blue light bar that travels across every chrome surface. */
export type SweepUniforms = { sweepPhase: THREE.IUniform<number>; sweepGain: THREE.IUniform<number>; sweepColor: THREE.IUniform<THREE.Color> };

export const createSweepUniforms = (): SweepUniforms => ({
  sweepPhase: { value: -9 },
  sweepGain: { value: 0 },
  sweepColor: { value: new THREE.Color("#7fa6ff") },
});

/**
 * Adds the sweep to a PBR material: the band lives in "reflection space" (view space), so it slides
 * over every metal in sync, exactly like a light bar moved past a product in a photo studio.
 * Sharper and brighter on polished metal, invisible on rough or non-metallic surfaces.
 */
export function addSweep(material: THREE.MeshStandardMaterial, u: SweepUniforms) {
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, u);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float sweepPhase;\nuniform float sweepGain;\nuniform vec3 sweepColor;")
      .replace("#include <opaque_fragment>", `
        {
          vec3 rv = reflect(-normalize(vViewPosition), normal);
          float bandPos = dot(rv, normalize(vec3(1.0, 0.18, 0.0))) - sweepPhase;
          float w = mix(0.05, 0.22, roughnessFactor);
          float s = exp(-bandPos * bandPos / (w * w));
          float gloss = 1.0 - roughnessFactor;
          outgoingLight += sweepColor * s * sweepGain * metalnessFactor * (0.25 + gloss * gloss) * mix(vec3(1.0), diffuseColor.rgb, 0.4);
        }
        #include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => "genks-sweep";
  material.needsUpdate = true;
}

/** Volumetric light cone (additive): bright core, soft edges, slow drifting haze. */
export function beamMaterial(color: THREE.ColorRepresentation) {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, intensity: { value: 0 }, color: { value: new THREE.Color(color) } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying float vH; varying vec3 vW;
      void main() {
        vH = 1.0 - uv.y;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - w.xyz);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float time; uniform float intensity; uniform vec3 color;
      varying vec3 vN; varying vec3 vV; varying float vH; varying vec3 vW;
      void main() {
        float facing = pow(abs(dot(normalize(vN), normalize(vV))), 1.8);
        float along = smoothstep(0.0, 0.12, vH) * (1.0 - smoothstep(0.55, 1.0, vH));
        float haze = 0.72 + 0.28 * sin(vW.y * 9.0 - time * 0.6 + sin(vW.x * 13.0 + time * 0.3) * 1.7);
        float a = facing * along * haze * intensity;
        gl_FragColor = vec4(color * a, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}

/** Dust floating in the air: glints only inside the light cone (apex, axis, half-angle tangent). */
export function dustPoints(count: number, center: THREE.Vector3, apex: THREE.Vector3, tanHalf: number, pxScale: number) {
  const g = new THREE.BufferGeometry();
  const p = new Float32Array(count * 3), seed = new Float32Array(count);
  let s = 7;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 0.42;
    p[i * 3] = center.x + Math.cos(a) * r;
    p[i * 3 + 1] = center.y - 0.75 + rnd() * 1.7;
    p[i * 3 + 2] = center.z + Math.sin(a) * r;
    seed[i] = rnd();
  }
  g.setAttribute("position", new THREE.BufferAttribute(p, 3));
  g.setAttribute("seed", new THREE.BufferAttribute(seed, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, intensity: { value: 0 }, apex: { value: apex.clone() }, tanHalf: { value: tanHalf }, pxScale: { value: pxScale } },
    vertexShader: /* glsl */ `
      attribute float seed; uniform float time; uniform vec3 apex; uniform float tanHalf; uniform float pxScale;
      varying float vA;
      void main() {
        vec3 q = position;
        q += vec3(sin(time * 0.11 + seed * 41.0), sin(time * 0.07 + seed * 17.0) * 1.6, cos(time * 0.09 + seed * 29.0)) * 0.06;
        q.y += mod(time * 0.012 * (0.4 + seed), 0.3) - 0.15;
        float depth = apex.y - q.y;
        float radial = length(q.xz - apex.xz);
        float inCone = depth > 0.0 ? 1.0 - smoothstep(depth * tanHalf * 0.75, depth * tanHalf * 1.05, radial) : 0.0;
        vA = inCone * (0.35 + 0.65 * fract(seed * 7.13)) * (0.6 + 0.4 * sin(time * (0.8 + seed) + seed * 30.0));
        vec4 mv = modelViewMatrix * vec4(q, 1.0);
        gl_PointSize = pxScale * (0.6 + seed * 1.6) / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float intensity; varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vA * intensity;
        gl_FragColor = vec4(vec3(0.78, 0.86, 1.0) * a, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  return new THREE.Points(g, m);
}

/** A large word drawn into a texture (outline + soft gradient fill): typography that lives in the 3D space. */
export function wordTexture(word: string, w = 2048, h = 640) {
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const draw = () => {
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, w, h);
    ctx.font = `700 ${Math.round(h * 0.82)}px "Space Grotesk", system-ui, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    if ("letterSpacing" in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = `${Math.round(h * 0.04)}px`;
    const grad = ctx.createLinearGradient(0, h * 0.1, 0, h * 0.95);
    grad.addColorStop(0, "rgba(156,191,255,0.16)");
    grad.addColorStop(0.55, "rgba(76,131,255,0.05)");
    grad.addColorStop(1, "rgba(76,131,255,0)");
    ctx.fillStyle = grad;
    ctx.fillText(word, w / 2, h * 0.54);
    ctx.lineWidth = Math.max(2, h * 0.006);
    ctx.strokeStyle = "rgba(170,200,255,0.55)";
    ctx.strokeText(word, w / 2, h * 0.54);
    tex.needsUpdate = true;
  };
  draw();
  // redraw once the brand font is ready (the first pass may use the fallback font)
  document.fonts?.load(`700 64px "Space Grotesk"`).then(draw).catch(() => {});
  return tex;
}
