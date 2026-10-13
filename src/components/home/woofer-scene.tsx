"use client";

import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

type Props = {
  sectionRef: RefObject<HTMLElement | null>;
  paused: boolean;
  onReady: () => void;
  onUnavailable: () => void;
  mode?: "hero" | "exploded";
};

export default function WooferScene({ sectionRef, paused, onReady, onUnavailable, mode = "hero" }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused);
  const callbacks = useRef({ onReady, onUnavailable });

  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { callbacks.current = { onReady, onUnavailable }; }, [onReady, onUnavailable]);

  useEffect(() => {
    const mount = mountRef.current;
    const section = sectionRef.current;
    if (!mount || !section) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
    } catch {
      callbacks.current.onUnavailable();
      return;
    }

    let alive = true;
    let visible = true;
    let elapsed = 0;
    let previous = 0;
    let progress = 0;
    let pointerX = 0;
    let pointerY = 0;
    let frameCount = 0;
    let displayedProgress = 0;
    let needsRender = true;
    let lastRenderedTime = 0;
    let previousPaused = pausedRef.current;
    let logoLoaded = false;
    let announcedReady = false;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(pointer: fine)");
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 700 ? 1.35 : 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setClearColor(0x03060c, 0);
    renderer.domElement.setAttribute("aria-hidden", "true");
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, .1, 50);
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

    const chrome = new THREE.MeshStandardMaterial({ color: 0xb4c3d9, metalness: 1, roughness: .22, envMapIntensity: 1.35 });
    const darkMetal = new THREE.MeshStandardMaterial({ color: 0x101727, metalness: .9, roughness: .29 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x0c0f18, metalness: .18, roughness: .48 });
    const coneMaterial = new THREE.MeshStandardMaterial({ color: 0x252b38, metalness: .65, roughness: .35, side: THREE.DoubleSide });
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
    const profile = [new THREE.Vector2(.53, .04), new THREE.Vector2(.7, .015), new THREE.Vector2(.92, -.09), new THREE.Vector2(1.16, -.23), new THREE.Vector2(1.29, -.29), new THREE.Vector2(1.33, -.23)];
    const cone = addMesh(new THREE.LatheGeometry(profile, 144), coneMaterial, diaphragm);
    cone.rotation.x = Math.PI / 2;
    ring(1.37, .095, .23, rubber, diaphragm);
    ring(1.46, .027, .225, chrome);
    ring(1.56, .065, .15, darkMetal);
    ring(1.57, .014, .218, blue, front);
    ring(1.64, .023, .12, chrome, front);
    ring(1.5, .018, -.02, chrome);
    ring(1.52, .035, -.32, darkMetal);
    ring(1.37, .012, .31, blue, diaphragm);

    const body = addMesh(new THREE.CylinderGeometry(1.55, 1.42, .4, 96, 1, true), darkMetal);
    body.rotation.x = Math.PI / 2;
    body.position.z = -.1;
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4 + Math.PI / 8;
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
    }

    const cap = addMesh(new THREE.SphereGeometry(.68, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2), darkMetal, diaphragm);
    cap.rotation.x = Math.PI / 2;
    cap.scale.y = .25;
    cap.position.z = .08;
    ring(.7, .014, .11, chrome, diaphragm);
    const logoMaterial = new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false });
    materials.add(logoMaterial);
    const logo = addMesh(new THREE.CircleGeometry(.69, 96), logoMaterial, diaphragm);
    logo.position.z = .27;
    const logoImage = new window.Image();
    logoImage.onload = () => {
      if (!alive) return;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 768;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.beginPath();
      context.arc(384, 384, 384, 0, Math.PI * 2);
      context.clip();
      context.drawImage(logoImage, 0, 0, 768, 768);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      textures.add(texture);
      logoMaterial.map = texture;
      logoMaterial.needsUpdate = true;
      logoLoaded = true;
      needsRender = true;
    };
    logoImage.src = "/brand/genks-logo.jpeg";

    scene.add(new THREE.HemisphereLight(0x9cbcff, 0x030409, 1));
    const key = new THREE.DirectionalLight(0xc8dcff, 4);
    key.position.set(2, 3, 4);
    scene.add(key);
    const blueLight = new THREE.PointLight(0x155cff, 24, 12, 2);
    blueLight.position.set(-2.5, 1, 2);
    scene.add(blueLight);
    const rim = new THREE.PointLight(0x5395ff, 16, 12, 2);
    rim.position.set(2, -1, 1);
    scene.add(rim);

    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      needsRender = true;
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();
    const onScroll = () => {
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
      if (time - lastRenderedTime < 1000 / 60) return;
      const delta = previous ? Math.min((time - previous) / 1000, .05) : 0;
      previous = time;
      if (!visible || document.hidden) return;
      const moving = !pausedRef.current && !reducedMotion.matches;
      if (previousPaused !== pausedRef.current) { needsRender = true; previousPaused = pausedRef.current; }
      if (!moving && !needsRender && frameCount > 2) return;
      if (moving) elapsed += delta;
      const expansion = reducedMotion.matches ? 0 : (1 - Math.cos(elapsed * Math.PI / 3.8)) * .5;
      if (!pausedRef.current) displayedProgress = reducedMotion.matches ? 0 : progress;
      const travel = displayedProgress;
      const easing = 1 - Math.exp(-delta * 5);
      const targetX = mode === "exploded" ? .12 + travel * .12 : -.07 + (reducedMotion.matches ? 0 : pointerY * .12) + travel * .09;
      const targetY = mode === "exploded" ? -.5 - travel * .6 : -.12 + (reducedMotion.matches ? 0 : pointerX * .18) + travel * .5;
      assembly.rotation.x = THREE.MathUtils.lerp(assembly.rotation.x, targetX, easing || 1);
      assembly.rotation.y = THREE.MathUtils.lerp(assembly.rotation.y, targetY, easing || 1);
      const scale = 1 + expansion * .008;
      diaphragm.scale.set(scale, scale, 1);
      diaphragm.position.z = expansion * .028 + (mode === "exploded" ? travel * .6 : 0);
      front.position.z = travel * (mode === "exploded" ? 1.2 : .24);
      blue.emissiveIntensity = 1.3 + expansion * .25;
      const distance = Math.max(5.95, 5.95 / camera.aspect);
      camera.position.set(travel * .25, travel * .12, distance + (mode === "exploded" ? .5 : 0) - travel * .35);
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      lastRenderedTime = time;
      needsRender = false;
      if (!announcedReady && logoLoaded && frameCount >= 2) {
        announcedReady = true;
        callbacks.current.onReady();
      }
      frameCount++;
    });

    return () => {
      alive = false;
      logoImage.onload = null;
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
  }, [sectionRef, mode]);

  return <div ref={mountRef} style={{ position: "absolute", inset: 0 }} aria-hidden="true" />;
}
