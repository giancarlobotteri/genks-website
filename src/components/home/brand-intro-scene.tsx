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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
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
        color: [0x287dff, 0x49c6ff, 0x9bc9ff, 0x278eff, 0x3965ff][index], metalness: .8, roughness: .23,
        envMapIntensity: 1.4, transparent: true, opacity: 0,
        emissive: [0x164fd8, 0x168cca, 0x285aac, 0x185fdb, 0x2545d8][index], emissiveIntensity: .28,
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
    const edge = new THREE.PointLight(0x80baff, 20, 15, 2);
    edge.position.set(3, -1, 2);
    scene.add(edge);
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
      if (!warmed || document.hidden || now - previous + .5 < 1000 / 60) return;
      previous = now;
      const elapsed = timelineRef.current ? Math.max(0, (now - timelineRef.current) / 1000) : 0;
      const exiting = phaseRef.current === "opening";
      const exit = exiting ? Math.max(0, (now - exitTime.current) / 1000) : 0;
      letters.forEach((letter, index) => {
        const t = reduced.matches ? 1 : THREE.MathUtils.clamp((elapsed - index * .2) / 1.15, 0, 1);
        const arrive = 1 - Math.pow(1 - t, 4);
        const leave = exiting ? THREE.MathUtils.smoothstep(exit - index * .045, 0, .75) : 0;
        letter.mesh.position.set(
          letter.home.x + (index - 2) * .2 * (1 - arrive),
          letter.home.y - .55 * (1 - arrive) + (reduced.matches ? 0 : Math.sin(elapsed * 1.1 + index * .5) * .025) + leave * .45,
          -1.8 * (1 - arrive) + leave * 1.6,
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
      wordmark.rotation.set(reduced.matches ? 0 : -.08 + Math.sin(elapsed * .4) * .07, reduced.matches ? 0 : -.3 + Math.sin(elapsed * .65) * .22 + exit * .25, 0);
      camera.position.set(reduced.matches ? 0 : Math.sin(elapsed * .4) * .25, .1, distance - (exiting ? Math.min(exit, 1) * .6 : 0));
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    });
    teardown = () => {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      letters.forEach(letter => { letter.mesh.geometry.dispose(); letter.material.dispose(); });
      env.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
    }).catch(() => { if (!disposed) callbacks.current.onUnavailable(); });
    return () => { disposed = true; teardown(); };
  }, [timelineRef]);

  return <div ref={mountRef} style={{ position: "absolute", inset: 0 }} aria-hidden="true" />;
}
