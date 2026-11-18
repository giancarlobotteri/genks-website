// Cinematic post-processing for capable GPUs (pmndrs/postprocessing, Zlib licence).
// HDR half-float buffers → depth of field that follows the subject → NaN guard → bloom only on real
// light sources → GENKS grade → AgX tone mapping with a punchy look → vignette + film grain.
// All effects of the last stage are merged into a single full-screen pass.
import * as THREE from "three";
import { BloomEffect, DepthOfFieldEffect, Effect, EffectComposer, EffectPass, RenderPass, ShaderPass, ToneMappingEffect, ToneMappingMode } from "postprocessing";

/** Scene-referred grade, before tone mapping: exposure, deep blue shadows, slightly cool mids. */
class GradeEffect extends Effect {
  constructor() {
    super("GenksGrade", /* glsl */ `
      uniform float exposure;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec3 c = inputColor.rgb * exposure;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        float sh = 1.0 - smoothstep(0.0, 0.22, l);
        c *= mix(vec3(1.0), vec3(0.82, 0.92, 1.18), sh * 0.55);
        outputColor = vec4(max(c, vec3(0.0)), inputColor.a);
      }`, { uniforms: new Map([["exposure", new THREE.Uniform(1)]]) });
  }
}

/** Display-referred look after AgX: contrast + saturation ("punchy"), vignette, animated grain. */
class FilmEffect extends Effect {
  constructor() {
    super("GenksFilm", /* glsl */ `
      uniform float grain;
      uniform float vignette;
      float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec3 c = clamp(inputColor.rgb, 0.0, 1.0);
        c = pow(c, vec3(1.22));
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = max(mix(vec3(l), c, 1.32), 0.0);
        vec2 d = (uv - 0.5) * vec2(aspect, 1.0);
        c *= mix(1.0 - vignette, 1.0, smoothstep(0.95, 0.2, length(d)));
        float n = hash12(floor(uv * resolution) + floor(fract(time * 24.0) * 97.0)) - 0.5;
        c += n * grain * (0.4 + 0.6 * smoothstep(0.0, 0.35, l)) * (1.0 - l * 0.6);
        outputColor = vec4(c, inputColor.a);
      }`, { uniforms: new Map([["grain", new THREE.Uniform(0.022)], ["vignette", new THREE.Uniform(0.32)]]) });
  }
}

/** Replaces NaN/Inf and clamps fireflies before the bloom blur can spread them over the frame. */
const sanitize = () => new ShaderPass(new THREE.ShaderMaterial({
  uniforms: { inputBuffer: { value: null } },
  vertexShader: "varying vec2 vUv; void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 1.0, 1.0); }",
  fragmentShader: `uniform sampler2D inputBuffer; varying vec2 vUv;
    void main() {
      vec4 c = texture2D(inputBuffer, vUv);
      bool bad = any(isnan(c.rgb)) || any(isinf(c.rgb));
      gl_FragColor = vec4(bad ? vec3(0.0) : min(c.rgb, vec3(40.0)), 1.0);
    }`,
  depthTest: false, depthWrite: false,
}), "inputBuffer");

export type CinemaFx = {
  /** Keep `target` (world) in focus; `lens` < 1 = longer lens = shallower depth of field. */
  focus: (target: THREE.Vector3, lens: number) => void;
  render: (dt: number) => void;
  setSize: (w: number, h: number) => void;
  setPixelRatio: (r: number) => void;
  /** First step of the adaptive quality: drop the depth of field, keep bloom + grade. */
  dropDof: () => boolean;
  dispose: () => void;
};

export function createCinemaFx(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera): CinemaFx {
  renderer.toneMapping = THREE.NoToneMapping;
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: Math.min(4, renderer.capabilities.maxSamples) });
  composer.addPass(new RenderPass(scene, camera));
  const dof = new DepthOfFieldEffect(camera, { focusDistance: 1.2, focusRange: 0.8, bokehScale: 2.2, resolutionScale: 0.5 });
  const dofPass = new EffectPass(camera, dof);
  composer.addPass(dofPass);
  composer.addPass(sanitize());
  const bloom = new BloomEffect({ mipmapBlur: true, luminanceThreshold: 0.95, luminanceSmoothing: 0.3, intensity: 0.7, radius: 0.7, levels: 7 });
  const grade = new GradeEffect();
  const tone = new ToneMappingEffect({ mode: ToneMappingMode.AGX });
  const film = new FilmEffect();
  composer.addPass(new EffectPass(camera, bloom, grade, tone, film));

  const tgt = new THREE.Vector3();
  let focusD = 1.2, hasDof = true;
  return {
    focus(target, lens) {
      tgt.copy(target);
      const d = camera.position.distanceTo(tgt);
      // smooth rack focus: the focus plane travels, it never jumps
      focusD += (d - focusD) * 0.12;
      if (!hasDof) return;
      dof.cocMaterial.focusDistance = focusD;
      // longer lens and closer subject → shallower depth of field, like a real camera
      const tight = THREE.MathUtils.clamp((1.05 - lens) / 0.45, 0, 1);
      dof.cocMaterial.focusRange = Math.max(0.12, focusD * (0.62 - 0.32 * tight));
      dof.bokehScale = THREE.MathUtils.lerp(1.1, 2.8, THREE.MathUtils.clamp(1 - (focusD - 0.5) / 3.2, 0, 1)) * (0.75 + 0.5 * tight);
    },
    render(dt) { composer.render(dt); },
    setSize(w, h) { composer.setSize(w, h, false); },
    setPixelRatio() { composer.setSize(renderer.domElement.clientWidth, renderer.domElement.clientHeight, false); },
    dropDof() {
      if (!hasDof) return false;
      hasDof = false;
      composer.removePass(dofPass);
      dofPass.dispose();
      return true;
    },
    dispose() { composer.dispose(); },
  };
}
