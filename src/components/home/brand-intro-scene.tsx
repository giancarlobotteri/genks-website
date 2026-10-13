"use client";

import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createGenksGlyphs } from "@/lib/graphics/genks-model";

type Props = {
  phase: "loading" | "letters" | "opening";
  timelineRef: RefObject<number>;
  onReady: () => void;
  onUnavailable: () => void;
};

export default function BrandIntroScene({ phase, timelineRef, onReady, onUnavailable }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef(phase);
  const exitTime = useRef(0);
  const callbacks = useRef({ onReady, onUnavailable });
  useEffect(() => {
    phaseRef.current = phase;
    if (phase === "opening") exitTime.current = performance.now();
  }, [phase]);
  useEffect(() => { callbacks.current = { onReady, onUnavailable }; }, [onReady, onUnavailable]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let teardown = () => {};
    void createGenksGlyphs(4.8).then(models => {
      if (disposed) { models.forEach(model => model.geometry.dispose()); return; }
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" }); }
    catch { callbacks.current.onUnavailable(); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 700 ? 1.5 : 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setClearColor(0, 0);
    renderer.domElement.setAttribute("aria-hidden", "true");
    mount.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, .1, 60);
    const room = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(room, .03);
    scene.environment = env.texture;
    room.dispose();
    pmrem.dispose();
    const wordmark = new THREE.Group();
    scene.add(wordmark);
    const letters = models.map((model, index) => {
      const material = new THREE.MeshStandardMaterial({
        color: [0x458aff, 0x48dfe7, 0xdaecff, 0xa382ff, 0xec70be][index], metalness: .75, roughness: .2,
        envMapIntensity: 1.4, transparent: true, opacity: 0,
        emissive: [0x163bb4, 0x087487, 0x354a93, 0x6729a7, 0x8a245c][index], emissiveIntensity: .24,
      });
      const mesh = new THREE.Mesh(model.geometry, material);
      mesh.position.copy(model.position);
      wordmark.add(mesh);
      return { mesh, material, home: model.position };
    });
    scene.add(new THREE.HemisphereLight(0xbbd5ff, 0x03060c, .8));
    const key = new THREE.DirectionalLight(0xe4efff, 4);
    key.position.set(1.5, 3, 4);
    scene.add(key);
    const blue = new THREE.PointLight(0x1e68ff, 28, 15, 2);
    blue.position.set(-3, 1.2, 2.5);
    scene.add(blue);
    const edge = new THREE.PointLight(0xde79ff, 20, 15, 2);
    edge.position.set(3, -1, 2);
    scene.add(edge);
    const haloGeometry = new THREE.TorusGeometry(2.7, .008, 6, 128);
    const haloMaterials = [0x40c9ff, 0xad66ff].map(color => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .3, depthWrite: false }));
    const halos = haloMaterials.map((material, index) => {
      const mesh = new THREE.Mesh(haloGeometry, material);
      mesh.position.z = -.8 - index * .15;
      mesh.rotation.x = .72 + index * .5;
      scene.add(mesh);
      return mesh;
    });
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let distance = 9;
    let warmed = false;
    let previous = 0;
    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      distance = Math.max(5.2, 4.8 * 1.22 / (2 * Math.tan(Math.PI / 10) * camera.aspect));
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();
    void renderer.compileAsync(scene, camera).then(() => {
      if (disposed) return;
      timelineRef.current = performance.now();
      warmed = true;
      callbacks.current.onReady();
      window.dispatchEvent(new Event("genks:intro-ready"));
    }).catch(() => { if (!disposed) callbacks.current.onUnavailable(); });
    const contextLost = (event: Event) => { event.preventDefault(); renderer.setAnimationLoop(null); callbacks.current.onUnavailable(); };
    renderer.domElement.addEventListener("webglcontextlost", contextLost);
    renderer.setAnimationLoop(() => {
      const now = performance.now();
      if (!warmed || document.hidden) { previous = now; return; }
      const delta = previous ? Math.min((now - previous) / 1000, .05) : 1 / 60;
      previous = now;
      const elapsed = timelineRef.current ? Math.max(0, (now - timelineRef.current) / 1000) : 0;
      const exiting = phaseRef.current === "opening";
      const exit = exiting ? Math.max(0, (now - exitTime.current) / 1000) : 0;
      letters.forEach((letter, index) => {
        const t = reduced.matches ? 1 : THREE.MathUtils.clamp((elapsed - index * .12) / 1.05, 0, 1);
        const arrive = 1 - Math.pow(1 - t, 4);
        const leave = exiting ? THREE.MathUtils.smoothstep(exit - index * .045, 0, .75) : 0;
        letter.mesh.position.set(
          letter.home.x + (index - 2) * .55 * (1 - arrive),
          letter.home.y + (index % 2 ? -.38 : .38) * (1 - arrive) + leave * .25,
          -2.4 * (1 - arrive) + leave * 1.3,
        );
        letter.mesh.rotation.set(
          reduced.matches ? 0 : .25 * (1 - arrive) + Math.sin(elapsed * .65 + index) * .035,
          reduced.matches ? 0 : (index % 2 ? 1 : -1) * 1.2 * (1 - arrive) + leave * .45,
          reduced.matches ? 0 : (index - 2) * .075 * (1 - arrive),
        );
        letter.mesh.scale.setScalar(.35 + .65 * arrive);
        letter.material.opacity = THREE.MathUtils.smoothstep(t, 0, .2) * (1 - leave);
        letter.material.depthWrite = letter.material.opacity > .98;
      });
      blue.position.x = -3 + Math.sin(elapsed * .7) * 1.8;
      edge.position.y = -1 + Math.sin(elapsed * .6) * .7;
      wordmark.rotation.set(reduced.matches ? 0 : Math.sin(elapsed * .65) * .045, reduced.matches ? 0 : -.18 * (1 - THREE.MathUtils.smoothstep(elapsed, .5, 1.8)) + Math.sin(elapsed * .7) * .05, 0);
      halos.forEach((halo, index) => {
        if (!reduced.matches) halo.rotation.y += delta * (index ? -.3 : .3);
        halo.scale.setScalar(1 + Math.min(elapsed, 2.5) * .08 + exit * .4);
        haloMaterials[index].opacity = .3 * (1 - THREE.MathUtils.smoothstep(exit, 0, .7));
      });
      camera.position.set(0, .1, distance - (exiting ? Math.min(exit, 1) * .6 : 0));
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    });
    teardown = () => {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      letters.forEach(letter => { letter.mesh.geometry.dispose(); letter.material.dispose(); });
      haloGeometry.dispose();
      haloMaterials.forEach(material => material.dispose());
      env.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
    }).catch(() => { if (!disposed) callbacks.current.onUnavailable(); });
    return () => { disposed = true; teardown(); };
  }, [timelineRef]);

  return <div ref={mountRef} style={{ position: "absolute", inset: 0 }} aria-hidden="true" />;
}

