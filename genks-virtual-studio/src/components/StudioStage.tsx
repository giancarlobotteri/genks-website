import { Mic, SlidersHorizontal, Disc3, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { buildStudio, type Quality } from "../scene/build-studio.ts";
import { band, CHAPTERS, clamp01, ease, lerpPose, MIC, poseAt, type Pose, type V3 } from "../scene/camera-path.ts";
import { useStudio } from "../store.tsx";
import s from "../styles/vs.module.css";
import { prefersReducedMotion } from "./ui.tsx";

export function detectQuality(): Quality {
  // Manual override for testing: ?quality=low or ?quality=high
  const forced = new URLSearchParams(window.location.search).get("quality");
  if (forced === "low" || forced === "high") return forced;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const small = window.matchMedia("(max-width: 820px)").matches;
  const weak = (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4;
  return small || weak ? "low" : "high";
}

/** Scroll progress of the studio section, 0..1. */
function sectionProgress(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const span = r.height - window.innerHeight;
  return span > 0 ? clamp01(-r.top / span) : 0;
}

export function scrollToProgress(p: number) {
  const el = document.getElementById("studio");
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY;
  const span = el.offsetHeight - window.innerHeight;
  window.scrollTo({ top: top + span * p, behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

type Props = { introDone: boolean; lite: boolean; onWebglFail: () => void };

const HOTSPOTS = [
  { id: "mic", label: "Esplora registrazione", band: [0, 0.2] as const, Icon: Mic },
  { id: "mixer", label: "Apri servizi Mix & Master", band: [0.7, 0.9] as const, Icon: SlidersHorizontal },
  { id: "display", label: "Entra nel display: Beat Store", band: [0.93, 1] as const, Icon: Disc3 },
];

export function StudioStage({ introDone, lite, onWebglFail }: Props) {
  const { open, panel } = useStudio();
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hotRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const chapterRefs = useRef<(HTMLDivElement | null)[]>([]);
  const railRef = useRef<HTMLDivElement>(null);
  const tagRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const live = useRef({ introDone, focus: null as null | "mic" | "mixer" });
  const [ready, setReady] = useState(false);

  useEffect(() => { live.current.introDone = introDone; }, [introDone]);
  useEffect(() => {
    live.current.focus = panel?.type === "recording" ? "mic" : panel?.type === "mix" ? "mixer" : null;
  }, [panel]);

  const activate = (id: string) => {
    if (id === "mic") open({ type: "recording" });
    else if (id === "mixer") open({ type: "mix" });
    else document.getElementById("onda")?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth" });
  };

  // Chapter overlays + rail update (also used in lite mode for the progress rail).
  const paintOverlays = (p: number) => {
    const bands: [number, number][] = [[0, 0.2], [0.26, 0.6], [0.66, 0.85], [0.94, 1]];
    chapterRefs.current.forEach((el, i) => {
      if (!el) return;
      const v = band(p, bands[i][0], bands[i][1], 0.06);
      el.style.opacity = String(v);
      el.style.transform = `translate3d(0, ${(1 - v) * 18}px, 0)`;
      el.style.visibility = v < 0.02 ? "hidden" : "visible";
    });
    railRef.current?.style.setProperty("--p", String(p));
  };

  useEffect(() => {
    if (lite) return;
    const canvas = canvasRef.current!;
    const section = sectionRef.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    } catch {
      onWebglFail();
      return;
    }
    const quality = detectQuality();
    const reduced = prefersReducedMotion();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === "high" ? 1.75 : 1.25));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const rig = buildStudio(renderer, quality);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.03, 40);
    let composer: EffectComposer | null = null;
    if (quality === "high") {
      // 8-bit target: cannot hold NaN/overflow values, which otherwise spread through the bloom blur and blank the frame
      composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.UnsignedByteType, samples: 4 }));
      composer.addPass(new RenderPass(rig.scene, camera));
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.6, 0.72));
      composer.addPass(new OutputPass());
    }

    const resize = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      composer?.setSize(w, h);
      camera.aspect = w / h;
      // Wider vertical FOV on portrait phones so the subjects stay framed.
      camera.fov = w / h < 0.8 ? 62 : 42;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Final pose: square in front of the mixer display.
    rig.scene.updateMatrixWorld(true);
    const dPos = new THREE.Vector3(), dQ = new THREE.Quaternion();
    rig.anchors.display.getWorldPosition(dPos);
    rig.anchors.display.getWorldQuaternion(dQ);
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(dQ);
    const endPose = (): Pose => {
      const dist = camera.aspect < 0.8 ? 0.42 : 0.2;
      const c = dPos.clone().addScaledVector(normal, dist);
      return { pos: [c.x, c.y, c.z], target: [dPos.x, dPos.y, dPos.z] };
    };
    const introPose: Pose = { pos: [0.4, 2.7, 6.2], target: [-0.6, 1.3, 0] };
    const focusPose: Record<"mic" | "mixer", Pose> = {
      mic: { pos: [-0.78, 1.5, 1.32], target: MIC },
      mixer: { pos: [0.0, 1.32, -0.7], target: [0, 0.84, -1.5] },
    };

    let visible = true, running = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { rootMargin: "100px" });
    io.observe(section);
    const onVis = () => { running = !document.hidden; };
    document.addEventListener("visibilitychange", onVis);
    const pointer = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => { if (e.pointerType === "mouse") { pointer.x = e.clientX / window.innerWidth - 0.5; pointer.y = e.clientY / window.innerHeight - 0.5; } };
    window.addEventListener("pointermove", onMove, { passive: true });

    let introT = live.current.introDone ? 1 : 0;
    let focusT = 0;
    let lastFocus: "mic" | "mixer" = "mic";
    let smoothP = sectionProgress(section);
    const cur: Pose = { pos: [...introPose.pos] as V3, target: [...introPose.target] as V3 };
    const tmp = new THREE.Vector3();
    const clock = new THREE.Clock();
    let raf = 0;
    let first = true;
    let frames = 0;

    const frame = () => {
      raf = requestAnimationFrame(frame);
      // real elapsed time (capped) so slow devices still finish the intro on schedule
      const rdt = Math.min(clock.getDelta(), 0.5);
      if (!running || (!visible && !first)) return;
      const t = clock.elapsedTime;
      const target = sectionProgress(section);
      smoothP = reduced ? target : smoothP + (target - smoothP) * Math.min(1, rdt * 6);
      const p = smoothP;
      if (live.current.introDone) introT = reduced ? 1 : Math.min(1, introT + rdt / 1.8);
      const f = live.current.focus;
      if (f) lastFocus = f;
      focusT = reduced ? (f ? 1 : 0) : focusT + ((f ? 1 : 0) - focusT) * Math.min(1, rdt * 4);

      let pose = poseAt(p, endPose(), reduced);
      if (focusT > 0.001) pose = lerpPose(pose, focusPose[lastFocus], ease(focusT));
      pose = lerpPose(introPose, pose, ease(introT));
      // gentle idle sway + mouse parallax
      const sway = reduced ? 0 : 1;
      const px = (pointer.x * 0.12 + Math.sin(t * 0.3) * 0.03) * sway * (1 - p * 0.8);
      const py = (-pointer.y * 0.06 + Math.sin(t * 0.23) * 0.015) * sway * (1 - p * 0.8);
      const k = first ? 1 : Math.min(1, rdt * 8);
      for (let i = 0; i < 3; i++) {
        cur.pos[i] += (pose.pos[i] - cur.pos[i]) * k;
        cur.target[i] += (pose.target[i] - cur.target[i]) * k;
      }
      camera.position.set(cur.pos[0] + px, cur.pos[1] + py, cur.pos[2]);
      camera.lookAt(cur.target[0], cur.target[1], cur.target[2]);
      rig.setReveal(Math.min(ease(introT) * 0.25 + p * 1.6, 1) * Math.max(0.25, introT));
      rig.tick(t, !reduced);
      if (composer) composer.render(); else renderer.render(rig.scene, camera);
      first = false;
      // Safety net: if post-processing ever outputs a fully black frame on this GPU, drop it and render directly.
      if (composer && ++frames === 6) {
        const gl = renderer.getContext();
        const px = new Uint8Array(4);
        let lit = 0;
        for (const [fx, fy] of [[0.5, 0.5], [0.25, 0.3], [0.75, 0.3], [0.3, 0.75], [0.7, 0.75], [0.5, 0.15]]) {
          gl.readPixels(Math.floor(gl.drawingBufferWidth * fx), Math.floor(gl.drawingBufferHeight * fy), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          lit = Math.max(lit, px[0], px[1], px[2]);
        }
        if (lit < 3) { composer.dispose(); composer = null; }
      }

      // project hotspots & info tags
      const w = canvas.clientWidth, h = canvas.clientHeight;
      const place = (el: HTMLElement | null | undefined, anchor: THREE.Object3D, vis: number) => {
        if (!el) return;
        anchor.getWorldPosition(tmp);
        tmp.project(camera);
        const behind = tmp.z > 1;
        const v = behind ? 0 : vis;
        el.style.transform = `translate3d(${((tmp.x + 1) / 2) * w}px, ${((1 - tmp.y) / 2) * h}px, 0)`;
        el.style.opacity = String(v);
        el.style.visibility = v < 0.15 ? "hidden" : "visible";
      };
      HOTSPOTS.forEach(hs => {
        const anchor = rig.anchors[hs.id as "mic" | "mixer" | "display"];
        const v = live.current.focus ? 0 : band(p, hs.band[0], hs.band[1], 0.05) * (hs.id === "mic" ? introT : 1);
        place(hotRefs.current[hs.id], anchor, v);
      });
      place(tagRefs.current.monitors, rig.anchors.monitors, band(p, 0.3, 0.62, 0.06));
      place(tagRefs.current.rack, rig.anchors.rack, band(p, 0.4, 0.64, 0.06));
      paintOverlays(p);
    };
    frame();
    const readyT = window.setTimeout(() => setReady(true), 0);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(readyT);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointermove", onMove);
      composer?.dispose();
      rig.dispose();
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lite]);

  // Lite mode: no WebGL — overlays become normal readable cards.
  useEffect(() => {
    if (!lite) return;
    const onScroll = () => sectionRef.current && railRef.current?.style.setProperty("--p", String(sectionProgress(sectionRef.current)));
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [lite]);

  const chapters = [
    { kicker: "01 · Registrazione", title: "Il microfono è acceso.", text: "Sessioni voce con fonico in sala, pacchetti a ore e calendario dimostrativo.", cta: { label: "Esplora registrazione", action: () => open({ type: "recording" }) }, Icon: Mic },
    { kicker: "02 · Lo studio", title: "Lo spazio si accende.", text: "Monitor da studio, scrivania, rack e pannelli acustici: un unico ambiente, una sola luce blu.", Icon: ChevronDown },
    { kicker: "03 · Mix & Master", title: "Il banco mixer.", text: "Mix, Master o il percorso completo. Confronta i servizi e invia il progetto da remoto.", cta: { label: "Apri servizi Mix & Master", action: () => open({ type: "mix" }) }, Icon: SlidersHorizontal },
    { kicker: "04 · Beat Store", title: "Dentro la forma d’onda.", text: "Continua a scorrere: il display del mixer diventa il catalogo dei beat.", cta: { label: "Vai al Beat Store", action: () => document.getElementById("beat-store")?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth" }) }, Icon: Disc3 },
  ];

  return (
    <section id="studio" ref={sectionRef} className={`${s.stageSection} ${lite ? s.stageLite : ""}`} aria-label="Studio virtuale GENKS">
      <div className={s.stageSticky}>
        {!lite && <canvas ref={canvasRef} className={s.stageCanvas} data-ready={ready || undefined} aria-hidden="true" />}
        {!lite && <div className={s.stageVignette} aria-hidden="true" />}
        {!lite && HOTSPOTS.map(hs => (
          <button key={hs.id} ref={el => { hotRefs.current[hs.id] = el; }} type="button" className={s.hotspot} data-id={hs.id} onClick={() => activate(hs.id)}>
            <span className={s.hotPulse} aria-hidden="true"><hs.Icon size={18} /></span>
            <span className={s.hotLabel}>{hs.label}</span>
          </button>
        ))}
        {!lite && <>
          <span ref={el => { tagRefs.current.monitors = el; }} className={s.infoTag} aria-hidden="true">Monitor da studio</span>
          <span ref={el => { tagRefs.current.rack = el; }} className={s.infoTag} aria-hidden="true">Rack outboard</span>
        </>}
        <div className={s.chapters}>
          {chapters.map((c, i) => (
            <div key={c.kicker} ref={el => { chapterRefs.current[i] = el; }} className={s.chapter} data-side={i % 2 ? "right" : "left"}>
              {lite && <span className={s.liteIcon} aria-hidden="true"><c.Icon size={28} /></span>}
              <p className={s.kicker}>{c.kicker}</p>
              <h2>{c.title}</h2>
              <p>{c.text}</p>
              {c.cta && <button type="button" className={s.btnPrimary} onClick={c.cta.action}>{c.cta.label}</button>}
            </div>
          ))}
        </div>
        <nav ref={railRef} className={s.rail} aria-label="Avanzamento nello studio">
          <span className={s.railFill} aria-hidden="true" />
          {CHAPTERS.map(c => (
            <button key={c.id} type="button" onClick={() => scrollToProgress(c.p)} className={s.railDot} style={{ ["--at" as string]: c.p }}>
              <span>{c.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </section>
  );
}
