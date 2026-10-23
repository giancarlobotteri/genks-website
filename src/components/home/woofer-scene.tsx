"use client";

import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createGenksGlyphs } from "@/lib/graphics/genks-model";

type Props = {
  sectionRef: RefObject<HTMLElement | null>;
  paused: boolean;
  onReady: () => void;
  onUnavailable: () => void;
  mode?: "hero" | "exploded" | "showcase";
  wideLayout?: boolean;
  heroProgressRef?: RefObject<number>;
};

export default function WooferScene({ sectionRef, paused, onReady, onUnavailable, mode = "hero", heroProgressRef, wideLayout = false }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused);
  const callbacks = useRef({ onReady, onUnavailable });

  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { callbacks.current = { onReady, onUnavailable }; }, [onReady, onUnavailable]);

  useEffect(() => {
    const mount = mountRef.current;
    const section = sectionRef.current;
    if (!mount || !section) return;
    let disposed = false;
    let teardown = () => {};
    void createGenksGlyphs(1.14).then(models => {
      if (disposed) { models.forEach(model => model.geometry.dispose()); return; }
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    } catch {
      callbacks.current.onUnavailable();
      return;
    }

    let visible = true;
    let elapsed = 0;
    let previous = 0;
    let progress = 0;
    let pointerX = 0;
    let pointerY = 0;
    let frameCount = 0;
    let displayedProgress = 0;
    let needsRender = true;
    let previousPaused = pausedRef.current;
    let announcedReady = false;
    let warmed = false;
    // Preserve native display sharpness throughout the animation; never downscale on slow frames.
    let qualityRatio = window.devicePixelRatio;
    let qualitySamples = 0;
    let qualityFrameTime = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(pointer: fine)");
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    renderer.setPixelRatio(qualityRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setClearColor(0x03060c, 0);
    renderer.domElement.setAttribute("aria-hidden", "true");
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, .08, 180);
    const focus = new THREE.Vector3();
    const environment = new RoomEnvironment();
    const lightPanel = new THREE.Mesh(new THREE.BoxGeometry(.25, 5, 3), new THREE.MeshBasicMaterial({ color: 0x1258ff, toneMapped: false }));
    lightPanel.position.set(-3, 1, 1);
    environment.add(lightPanel);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environmentMap = pmrem.fromScene(environment, .04);
    scene.environment = environmentMap.texture;
    environment.dispose();
    lightPanel.geometry.dispose();
    (lightPanel.material as THREE.Material).dispose();
    pmrem.dispose();

    const assembly = new THREE.Group();
    scene.add(assembly);
    const diaphragm = new THREE.Group();
    assembly.add(diaphragm);
    const front = new THREE.Group();
    assembly.add(front);

    const chrome = new THREE.MeshStandardMaterial({ color: 0x99c8ff, metalness: 1, roughness: .22, envMapIntensity: 1.35 });
    const darkMetal = new THREE.MeshStandardMaterial({ color: 0x102b56, metalness: .85, roughness: .25 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x11151d, metalness: .08, roughness: .62 });
    const coneMaterial = new THREE.MeshStandardMaterial({ color: 0x244e89, metalness: .5, roughness: .38, side: THREE.DoubleSide });
    const ridges = new THREE.MeshStandardMaterial({ color: 0x1a2332, metalness: .25, roughness: .55 });
    const blue = new THREE.MeshStandardMaterial({ color: 0x1458ff, metalness: .5, roughness: .24, emissive: 0x1555ff, emissiveIntensity: 1.6 });

    const addMesh = (geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Group = assembly) => {
      geometries.add(geometry);
      materials.add(material);
      const mesh = new THREE.Mesh(geometry, material);
      parent.add(mesh);
      return mesh;
    };
    const ring = (radius: number, thickness: number, z: number, material: THREE.Material, parent: THREE.Group = assembly) => {
      const mesh = addMesh(new THREE.TorusGeometry(radius, thickness, 20, 144), material, parent);
      mesh.position.z = z;
      return mesh;
    };

    // The lathed profile builds a concave speaker membrane along the Z axis.
    const profile = [new THREE.Vector2(.56, -.23), new THREE.Vector2(.69, -.19), new THREE.Vector2(.87, -.105), new THREE.Vector2(1.06, -.015), new THREE.Vector2(1.22, .065), new THREE.Vector2(1.3, .12)];
    const cone = addMesh(new THREE.LatheGeometry(profile, 192), coneMaterial, diaphragm);
    cone.rotation.x = Math.PI / 2;
    // Fine paper grain and concentric moulded ribs make the diaphragm read as a speaker.
    const grainData = new Uint8Array(128 * 128);
    for (let i = 0; i < grainData.length; i++) grainData[i] = 100 + Math.round((Math.sin(i * 12.9898) * 43758.5453 % 1 + 1) * 30);
    const grain = new THREE.DataTexture(grainData, 128, 128, THREE.RedFormat);
    grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
    grain.repeat.set(12, 2);
    grain.magFilter = THREE.LinearFilter;
    grain.minFilter = THREE.LinearMipmapLinearFilter;
    grain.generateMipmaps = true;
    grain.needsUpdate = true;
    textures.add(grain);
    coneMaterial.bumpMap = grain;
    coneMaterial.bumpScale = .012;
    for (let i = 0; i < 6; i++) {
      const radius = .78 + i * .082;
      const profileIndex = profile.findIndex(point => point.x >= radius);
      const inner = profile[profileIndex - 1];
      const outer = profile[profileIndex];
      const z = THREE.MathUtils.lerp(inner.y, outer.y, (radius - inner.x) / (outer.x - inner.x)) + .004;
      const rib = addMesh(new THREE.TorusGeometry(radius, .007, 8, 160), ridges, diaphragm);
      rib.position.z = z;
    }
    ring(1.345, .115, .145, rubber);
    ring(1.435, .012, .19, rubber);
    ring(1.46, .027, .225, chrome);
    ring(1.56, .065, .15, darkMetal);
    ring(1.57, .014, .218, blue, front);
    ring(1.405, .007, .245, blue, front);
    const satellite = new THREE.Group();
    assembly.add(satellite);
    const orbitRing = ring(1.73, .005, 0, blue, satellite);
    orbitRing.rotation.x = .19;
    orbitRing.rotation.y = -.12;
    ring(1.64, .023, .12, chrome, front);
    ring(1.5, .018, -.02, chrome);
    ring(1.52, .035, -.32, darkMetal);
    const flange = addMesh(new THREE.RingGeometry(1.46, 1.63, 192), darkMetal, front);
    flange.position.z = .19;

    const body = addMesh(new THREE.CylinderGeometry(1.55, 1.42, .4, 96, 1, true), darkMetal);
    body.rotation.x = Math.PI / 2;
    body.position.z = -.1;
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4 + Math.PI / 8;
      const recess = addMesh(new THREE.CircleGeometry(.055, 24), rubber, front);
      recess.position.set(Math.cos(angle) * 1.56, Math.sin(angle) * 1.56, .22);
      const bolt = addMesh(new THREE.CylinderGeometry(.036, .036, .025, 12), chrome, front);
      bolt.rotation.x = Math.PI / 2;
      bolt.position.set(Math.cos(angle) * 1.56, Math.sin(angle) * 1.56, .225);
      const slot = addMesh(new THREE.BoxGeometry(.035, .006, .002), darkMetal, front);
      slot.position.copy(bolt.position);
      slot.position.z += .014;
      slot.rotation.z = angle;
      const spoke = addMesh(new THREE.BoxGeometry(.065, .43, .1), darkMetal);
      spoke.position.set(Math.cos(angle) * 1.22, Math.sin(angle) * 1.22, -.32);
      spoke.rotation.z = angle - Math.PI / 2;
      const basketStart = new THREE.Vector3(Math.cos(angle) * 1.45, Math.sin(angle) * 1.45, -.18);
      const basketEnd = new THREE.Vector3(Math.cos(angle) * .8, Math.sin(angle) * .8, -1.02);
      const direction = basketEnd.clone().sub(basketStart);
      const rib = addMesh(new THREE.BoxGeometry(.08, direction.length(), .12), darkMetal);
      rib.position.copy(basketStart.clone().add(basketEnd).multiplyScalar(.5));
      rib.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    }
    ring(.85, .045, -.98, chrome);
    const magnet = addMesh(new THREE.CylinderGeometry(.79, .79, .28, 64), darkMetal);
    magnet.rotation.x = Math.PI / 2;
    magnet.position.z = -1.14;
    ring(.79, .014, -1.27, blue);
    ring(.8, .025, -1.02, chrome);

    const cap = addMesh(new THREE.SphereGeometry(.68, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2), darkMetal, diaphragm);
    cap.rotation.x = Math.PI / 2;
    cap.scale.y = .28;
    cap.position.z = -.18;
    ring(.7, .012, -.105, chrome, diaphragm);
    const logoMaterial = new THREE.MeshStandardMaterial({ color: 0xccedff, metalness: .9, roughness: .16, envMapIntensity: 1.65, emissive: 0x1757bf, emissiveIntensity: .22 });
    const logo = new THREE.Group();
    logo.position.z = .045;
    diaphragm.add(logo);
    models.forEach(glyph => {
      const mesh = addMesh(glyph.geometry, logoMaterial, logo);
      mesh.position.copy(glyph.position);
    });

    // A lightweight light gate surrounds the existing model; no extra renderer or postprocessing.
    const gate = new THREE.Group();
    scene.add(gate);
    const gateMaterial = new THREE.MeshBasicMaterial({ color: 0x6bb5ff, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
    ring(2.02, .012, -.7, gateMaterial, gate);
    ring(2.14, .004, -.8, gateMaterial, gate);
    const arc = addMesh(new THREE.TorusGeometry(2.24, .018, 8, 96, Math.PI * .72), gateMaterial, gate);
    arc.position.z = -.9;

    const modelMaterials = [...materials];
    modelMaterials.forEach(material => { material.transparent = true; });
    // A single screen-space wave travels out from the speaker, with no corridor geometry.
    const waveMaterial = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false,
      uniforms: { progress: { value: 0 }, aspect: { value: 1 } },
      vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `
        varying vec2 vUv; uniform float progress; uniform float aspect;
        void main(){
          vec2 p=(vUv-.5)*vec2(aspect,1.0);
          float radius=length(p);
          float angle=atan(p.y,p.x);
          float advance=smoothstep(.23,.92,progress);
          float edge=advance*2.4-.25;
          float organic=sin(angle*3.0+progress*4.0)*.045+sin(angle*5.0-progress*3.0)*.018;
          float distanceToWave=radius-edge+organic;
          float crest=exp(-pow(distanceToWave/.13,2.0));
          float bloom=exp(-pow(distanceToWave/.4,2.0));
          float wake=(1.0-smoothstep(-.35,.06,distanceToWave))*.55;
          float reveal=smoothstep(.19,.38,progress);
          vec3 color=mix(vec3(.025,.12,.36),vec3(.12,.48,.95),bloom);
          color=mix(color,vec3(.58,.83,1.0),crest*.8);
          float alpha=clamp((bloom*.8+crest*.2+wake)*reveal,0.0,.96);
          gl_FragColor=vec4(color,alpha);
        }`,
    });
    materials.add(waveMaterial);
    const waveGeometry = new THREE.PlaneGeometry(2,2); geometries.add(waveGeometry);
    const wave = new THREE.Mesh(waveGeometry,waveMaterial);
    wave.position.z=-1; wave.renderOrder=100;
    camera.add(wave); scene.add(camera);

    // Combine fixed parts sharing a material; the parent groups still rotate and separate normally.
    for (const group of [assembly, front, diaphragm, logo]) {
      const batches = new Map<THREE.Material, THREE.Mesh[]>();
      for (const child of group.children) {
        if (!(child instanceof THREE.Mesh) || Array.isArray(child.material)) continue;
        const batch = batches.get(child.material) ?? [];
        batch.push(child);
        batches.set(child.material, batch);
      }
      for (const [material, meshes] of batches) {
        if (meshes.length < 2) continue;
        const copies = meshes.map(mesh => { mesh.updateMatrix(); return mesh.geometry.clone().applyMatrix4(mesh.matrix); });
        const merged = mergeGeometries(copies, false);
        copies.forEach(geometry => geometry.dispose());
        if (!merged) continue;
        merged.computeBoundingSphere();
        meshes.forEach(mesh => group.remove(mesh));
        addMesh(merged, material, group);
      }
    }

    scene.add(new THREE.HemisphereLight(0x9cbcff, 0x030409, 1.25));
    const key = new THREE.DirectionalLight(0xc8dcff, 4);
    key.position.set(2, 3, 4);
    scene.add(key);
    const blueLight = new THREE.DirectionalLight(0x3475ff, 2.4);
    blueLight.position.set(-2.5, 1, 2);
    scene.add(blueLight);
    const rim = new THREE.DirectionalLight(0x76a9ff, 2);
    rim.position.set(2, -1, 1);
    scene.add(rim);

    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      if (!width || !height) return;
      qualityRatio = window.devicePixelRatio;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(qualityRatio);
      needsRender = true;
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();
    // Warm the complete model before revealing it, avoiding first-frame shader compilation stutter.
    void renderer.compileAsync(scene, camera).then(() => { if (!disposed) warmed = true; })
      .catch(() => { if (!disposed) callbacks.current.onUnavailable(); });
    const onScroll = () => {
      if (heroProgressRef) { needsRender = true; return; }
      const rect = section.getBoundingClientRect();
      const travel = Math.max(1, section.offsetHeight - window.innerHeight);
      progress = THREE.MathUtils.clamp(-rect.top / travel, 0, 1);
      needsRender = true;
    };
    const onPointer = (event: PointerEvent) => {
      if (!finePointer.matches || reducedMotion.matches || pausedRef.current) return;
      const rect = mount.getBoundingClientRect();
      pointerX = THREE.MathUtils.clamp((event.clientX - rect.left) / rect.width - .5, -.5, .5);
      pointerY = THREE.MathUtils.clamp((event.clientY - rect.top) / rect.height - .5, -.5, .5);
      needsRender = true;
    };
    const resetPointer = () => { if (!pausedRef.current) { pointerX = 0; pointerY = 0; needsRender = true; } };
    window.addEventListener("scroll", onScroll, { passive: true });
    section.addEventListener("pointermove", onPointer, { passive: true });
    section.addEventListener("pointerleave", resetPointer);
    onScroll();

    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      previous = 0;
      needsRender = true;
    });
    intersection.observe(mount);
    const onContextLost = (event: Event) => {
      event.preventDefault();
      renderer.setAnimationLoop(null);
      callbacks.current.onUnavailable();
    };
    renderer.domElement.addEventListener("webglcontextlost", onContextLost);
    const onMotionChange = () => { needsRender = true; };
    reducedMotion.addEventListener("change", onMotionChange);
    renderer.setAnimationLoop((time: number) => {
      if (!warmed) return;
      const frameInterval = previous ? (time - previous) / 1000 : 0;
      const delta = Math.min(frameInterval, .05);
      previous = time;
      if (!visible || document.hidden) return;
      const moving = !pausedRef.current && !reducedMotion.matches;
      displayedProgress = reducedMotion.matches || pausedRef.current ? 0 : (heroProgressRef?.current ?? progress);
      const travel = displayedProgress;
      // Stop rendering and sampling frames once the scene is no longer visible.
      if (mode === "hero" && travel >= .98 && announcedReady) return;
      if (moving && frameInterval > 0 && frameInterval < 1 && frameCount > 10) {
        qualityFrameTime += frameInterval;
        qualitySamples++;
        if (qualitySamples >= 20) {
          renderer.domElement.dataset.renderFps = String(Math.round(qualitySamples / qualityFrameTime));
          qualitySamples = 0;
          qualityFrameTime = 0;
        }
      }
      if (previousPaused !== pausedRef.current) { needsRender = true; previousPaused = pausedRef.current; }
      if (!moving && !needsRender && frameCount > 2) return;
      if (moving) elapsed += delta;
      const expansion = reducedMotion.matches ? 0 : (1 - Math.cos(elapsed * Math.PI / 3.8)) * .5;
      const easing = 1 - Math.exp(-delta * 5);
      const smoothstep = (from: number, to: number, value: number) => THREE.MathUtils.smoothstep(value, from, to);
      const zoom = mode === "hero" ? smoothstep(.02, .4, travel) : 0;
      const entry = mode === "hero" ? smoothstep(.18,.88,travel) : 0;
      wave.visible = mode === "hero" && travel > .19;
      waveMaterial.uniforms.progress.value = travel;
      waveMaterial.uniforms.aspect.value = camera.aspect;
      const waveHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/camera.zoom;
      wave.scale.set(waveHeight*camera.aspect,waveHeight,1);
      const modelOpacity=1-smoothstep(.44,.76,travel);
      modelMaterials.forEach(material=>{material.opacity=mode === "hero"?modelOpacity:1;});
      assembly.visible=mode!=="hero"||modelOpacity>.001;
      const turn = 0;
      const reveal = 0;
      const perspective = 1 - smoothstep(0, .7, travel) * .55;
      const orbit = moving ? Math.sin(elapsed * .45) : 0;
      const targetX = mode === "exploded" ? .15 + travel * .22 : reveal * .32 + (orbit * .025 + (reducedMotion.matches ? 0 : pointerY * .08)) * (1-smoothstep(0,.08,travel));
      const targetY = mode === "exploded" ? -.6 - travel * .6 : -turn * 1.05 + (orbit * .045 + (reducedMotion.matches ? 0 : pointerX * .12)) * (1-smoothstep(0,.08,travel));
      assembly.rotation.x = THREE.MathUtils.lerp(assembly.rotation.x, targetX, easing || 1);
      assembly.rotation.y = THREE.MathUtils.lerp(assembly.rotation.y, targetY, easing || 1);
      assembly.rotation.z = moving ? Math.sin(elapsed * .3) * .035 * (1-smoothstep(0,.08,travel)) : 0;
      const scale = 1 + expansion * .005;
      diaphragm.scale.set(scale, scale, 1);
      diaphragm.position.z = expansion * .028 + (mode === "exploded" ? travel * .6 : reveal * .42);
      front.position.z = mode === "exploded" ? travel * 1.2 : reveal * 1.1;
      blue.emissiveIntensity = 1.45 + expansion * .3 + reveal * 1.1;
      gate.visible = false;
      gateMaterial.opacity = smoothstep(.15, .4, travel) * (1 - smoothstep(.65, .95, travel)) * .22;
      gate.scale.setScalar(1 + zoom * 3);
      gate.rotation.z = -travel * .65;
      arc.rotation.z = elapsed * .12 + travel * 1.4;
      satellite.rotation.z = moving ? elapsed * .12 + travel * Math.PI : 0;
      satellite.rotation.y = moving ? Math.sin(elapsed * .35) * .15 : 0;
      // Keep the canvas size fixed: resizing its drawing buffer during scroll clears the rendered frame.
      const height = mount.clientHeight;
      const width = mount.clientWidth;
      const uiSpace = 1 - smoothstep(.035, .25, travel);
      // Fit the complete opening composition: model above its two actions, centered in the usable viewport.
      const compact = width <= 700;
      const modelHeight = wideLayout
        ? Math.min(compact ? Math.min(width * .9, 300) : 520, Math.max(compact ? 150 : 220, height - (compact ? 330 : 300)))
        : Math.max(250, height - 340 * uiSpace);
      const offset = (wideLayout ? (compact ? 24 : -16) : 80) * uiSpace;
      const fitHeight = wideLayout ? THREE.MathUtils.lerp(modelHeight, height, 1 - uiSpace) : modelHeight;
      const distance = mode === "hero" ? Math.max(6.3 * height / fitHeight, 6.3 / camera.aspect) : Math.max(5.95, 5.95 / camera.aspect) + .5;
      if (mode === "hero" && (!camera.view || camera.view.offsetY !== offset || camera.view.fullWidth !== width || camera.view.fullHeight !== height)) {
        camera.setViewOffset(width, height, 0, offset, width, height);
      }
      // Slow optical approach preserves the original mesh and avoids near-plane clipping or a retreating logo.
      assembly.scale.setScalar(1);
      assembly.position.z = 0;
      const cameraZoom = mode === "hero" ? 1 + zoom * .36 : 1;
      if (Math.abs(camera.zoom - cameraZoom) > .0001) {
        camera.zoom = cameraZoom;
        camera.updateProjectionMatrix();
      }
      assembly.position.y = mode === "hero" ? .2 * perspective : 0;
      camera.position.set(mode === "exploded" ? travel * .25 : 0, mode === "exploded" ? travel * .12 : .08 * perspective*(1-entry), mode === "hero" ? THREE.MathUtils.lerp(distance,1.5,entry) : distance-travel*.35);
      if (mode === "hero") {
        logo.getWorldPosition(focus);
        focus.multiplyScalar(0);
        camera.lookAt(focus);
      } else camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      needsRender = false;
      if (!announcedReady && frameCount >= 2) {
        announcedReady = true;
        renderer.domElement.dataset.drawCalls = String(renderer.info.render.calls);
        callbacks.current.onReady();
      }
      frameCount++;
    });

    teardown = () => {
      renderer.setAnimationLoop(null);
      intersection.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("scroll", onScroll);
      section.removeEventListener("pointermove", onPointer);
      section.removeEventListener("pointerleave", resetPointer);
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      reducedMotion.removeEventListener("change", onMotionChange);
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
      textures.forEach(texture => texture.dispose());
      environmentMap.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
    }).catch(() => { if (!disposed) callbacks.current.onUnavailable(); });
    return () => { disposed = true; teardown(); };
  }, [sectionRef, mode, heroProgressRef, wideLayout]);

  return <div ref={mountRef} style={{ position: "absolute", inset: 0 }} aria-hidden="true" />;
}
