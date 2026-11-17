import { Mic, SlidersHorizontal, Disc3, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { buildStudio, type Quality } from "../scene/build-studio.ts";
import { band, CHAPTERS, clamp01, ease, lerpPose, MIC, poseAt, type Pose, type V3 } from "../scene/camera-path.ts";
import { subscribeCue, getCue, type Cue, type ShotId } from "../cinema.ts";
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
  const live = useRef({ introDone, focus: null as null | "mic" | "mixer", cue: null as Cue | null });
  const [ready, setReady] = useState(false);

  useEffect(() => { live.current.introDone = introDone; }, [introDone]);
  useEffect(() => {
    live.current.focus = panel?.type === "recording" ? "mic" : panel?.type === "mix" ? "mixer" : null;
  }, [panel]);

  useEffect(() => {
    const sync = () => { const st = getCue(); live.current.cue = st.cue && !st.leaving ? st.cue : null; };
    sync();
    return subscribeCue(sync);
  }, []);

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
    const root = document.documentElement;
    root.dataset.vsStage = "3d";
    const reduced = prefersReducedMotion();
    let pixelRatio = Math.min(window.devicePixelRatio, quality === "high" ? 1.75 : 1.5);
    renderer.setPixelRatio(pixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    if (window.location.search.includes("debug")) (window as unknown as { __vsInfo: unknown }).__vsInfo = renderer.info;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const rig = buildStudio(renderer, quality);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.03, 40);
    let composer: EffectComposer | null = null;
    if (quality === "high") {
      // 8-bit target: cannot hold NaN/overflow values, which otherwise spread through the bloom blur and blank the frame
      composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.UnsignedByteType, samples: 4 }));
      composer.addPass(new RenderPass(rig.scene, camera));
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.6, 0.82));
      composer.addPass(new OutputPass());
    }

    const resize = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      composer?.setPixelRatio(renderer.getPixelRatio());
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

    // Cinematic shots for service & payment choices (world space, see build-studio / studio-extras).
    const SHOTS: Record<Exclude<ShotId, "display">, Pose> = {
      mic: { pos: [-1.28, 1.36, 1.3], target: [-0.94, 1.45, 0.95] },
      onair: { pos: [-1.55, 2.42, -2.25], target: [-1.95, 2.74, -3.47] },
      clock: { pos: [1.62, 2.5, -2.4], target: [1.95, 2.76, -3.47] },
      faders: { pos: [-0.62, 1.02, -0.98], target: [0.18, 0.84, -1.3] },
      rack: { pos: [1.55, 1.42, -1.2], target: [2.35, 0.9, -2.4] },
      console: { pos: [0.0, 2.15, 0.35], target: [0, 0.95, -1.6] },
      screen: { pos: [0.0, 1.38, -1.12], target: [0, 1.43, -2.02] },
      speakers: { pos: [0.5, 1.45, -0.9], target: [1.1, 1.24, -1.95] },
      keys: { pos: [-0.78, 1.18, -0.98], target: [-1.04, 0.84, -1.48] },
      pos: { pos: [4.02, 1.18, -0.5], target: [4.58, 0.84, -0.72] },
      approved: { pos: [4.3, 1.04, -0.66], target: [4.6, 0.83, -0.73] },
      cash: { pos: [3.92, 1.22, 0.02], target: [4.58, 0.8, -0.18] },
      sofa: { pos: [-2.55, 1.45, 1.1], target: [-4.1, 0.7, -0.55] },
    };
    const shotPose = (c: Cue): Pose => {
      if (c.shot === "display") {
        const dist = camera.aspect < 0.8 ? 0.62 : 0.4;
        const p = dPos.clone().addScaledVector(normal, dist);
        return { pos: [p.x, p.y + 0.04, p.z], target: [dPos.x, dPos.y, dPos.z] };
      }
      const base = SHOTS[c.shot];
      if (camera.aspect >= 0.8) return base;
      // portrait phones: step back along the view line so the subject stays in frame
      const back = 1.35;
      return { pos: [base.target[0] + (base.pos[0] - base.target[0]) * back, base.target[1] + (base.pos[1] - base.target[1]) * back, base.target[2] + (base.pos[2] - base.target[2]) * back], target: base.target };
    };
    /** Slow push-in plus a small orbit while the shot holds: the frame never feels frozen. */
    const animateShot = (base: Pose, held: number, dur: number): Pose => {
      const u = Math.min(1, held / dur);
      const tx = base.target[0], tz = base.target[2];
      let dx = base.pos[0] - tx, dz = base.pos[2] - tz;
      const a = (u - 0.5) * 0.16, ca = Math.cos(a), sa = Math.sin(a);
      [dx, dz] = [dx * ca - dz * sa, dx * sa + dz * ca];
      const push = 1 - 0.1 * ease(u);
      return { pos: [tx + dx * push, base.target[1] + (base.pos[1] - base.target[1]) * push, tz + dz * push], target: base.target };
    };
    let cueId = 0, cueAt = 0, cueDur = 2, shotBase: Pose | null = null;
    let tr: { from: Pose; start: number; dur: number; to: "shot" | "base" } | null = null;
    let cueLight = 0;
    const copyPose = (p: Pose): Pose => ({ pos: [...p.pos] as V3, target: [...p.target] as V3 });

    let visible = true, running = true;
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) delete root.dataset.vsStageOff; else root.dataset.vsStageOff = "1";
    }, { rootMargin: "100px" });
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
    let slowSum = 0, slowN = 0, drops = 0;

    const frame = () => {
      raf = requestAnimationFrame(frame);
      // real elapsed time (capped) so slow devices still finish the intro on schedule
      const rdt = Math.min(clock.getDelta(), 0.5);
      // Adaptive resolution: if this device cannot hold ~25 fps, render fewer pixels instead of stuttering.
      if (!first && visible) {
        slowSum += rdt; slowN++;
        if (slowN >= 50) {
          if (slowSum / slowN > 0.04 && pixelRatio > 0.75 && drops < 4) {
            pixelRatio = Math.max(0.75, pixelRatio - 0.25); drops++;
            renderer.setPixelRatio(pixelRatio); resize();
          }
          slowSum = 0; slowN = 0;
        }
      }
      if (!running || (!visible && !first && !live.current.cue && !tr)) return;
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
      // cinematic cue: fly from wherever the camera is to the shot, hold with a push-in, fly back
      const c = live.current.cue;
      if (c && c.id !== cueId) {
        cueId = c.id; cueAt = t; cueDur = c.ms / 1000; shotBase = shotPose(c);
        tr = { from: copyPose(cur), start: t, dur: reduced ? 0.01 : 1.05, to: "shot" };
        rig.setCue(c.shot, c.data);
      } else if (!c && cueId) {
        cueId = 0;
        tr = { from: copyPose(cur), start: t, dur: reduced ? 0.01 : 1.1, to: "base" };
        rig.setCue(null);
      }
      const base = pose;
      if (cueId && shotBase) pose = animateShot(shotBase, t - cueAt, cueDur);
      if (tr) {
        const u = Math.min(1, (t - tr.start) / tr.dur), e = ease(u);
        const goal = tr.to === "shot" ? pose : base;
        const span = Math.hypot(goal.pos[0] - tr.from.pos[0], goal.pos[2] - tr.from.pos[2]);
        pose = lerpPose(tr.from, goal, e);
        // crane arc: rise during long moves, like a jib
        pose.pos[1] += Math.sin(Math.PI * u) * Math.min(0.6, span * 0.12);
        if (u >= 1) tr = null;
      }
      cueLight += ((cueId ? 1 : 0) - cueLight) * Math.min(1, rdt * 3);
      // gentle idle sway + mouse parallax
      const sway = reduced ? 0 : 1;
      // handheld feel during shots: tiny noise instead of the mouse parallax
      const hand = cueLight * sway;
      const px = (pointer.x * 0.12 + Math.sin(t * 0.3) * 0.03) * sway * (1 - p * 0.8) * (1 - cueLight) + (Math.sin(t * 1.7) + Math.sin(t * 2.9) * 0.5) * 0.004 * hand;
      const py = (-pointer.y * 0.06 + Math.sin(t * 0.23) * 0.015) * sway * (1 - p * 0.8) * (1 - cueLight) + Math.sin(t * 2.3) * 0.003 * hand;
      const k = first ? 1 : Math.min(1, rdt * (cueId || tr ? 10 : 8));
      for (let i = 0; i < 3; i++) {
        cur.pos[i] += (pose.pos[i] - cur.pos[i]) * k;
        cur.target[i] += (pose.target[i] - cur.target[i]) * k;
      }
      camera.position.set(cur.pos[0] + px, cur.pos[1] + py, cur.pos[2]);
      camera.lookAt(cur.target[0], cur.target[1], cur.target[2]);
      // the room lights come up for every cue, even before the scroll reveal
      rig.setReveal(Math.max(Math.min(ease(introT) * 0.25 + p * 1.6, 1) * Math.max(0.25, introT), cueLight * 0.95));
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
        const v = live.current.focus || cueId ? 0 : band(p, hs.band[0], hs.band[1], 0.05) * (hs.id === "mic" ? introT : 1);
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
      delete root.dataset.vsStage;
      delete root.dataset.vsStageOff;
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
