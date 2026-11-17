import { Disc3, Mic, MonitorPlay, Mouse, Hand, SlidersHorizontal, Upload, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { formatEuro } from "../lib/catalog.ts";
import { musicLevel } from "../lib/level.ts";
import { getDive, getSubShot, setSubShot } from "../lib/shots.ts";
import { installStepper, isTraveling, scrollAt, travelTo, travelToId } from "../lib/stepper.ts";
import { arcFor, durFor, orbitPose, SHOTS } from "../scene/shot-table.ts";
import { enterStore } from "./BeatBurst.tsx";
import { buildStudio, type Quality } from "../scene/build-studio.ts";
import { band, clamp01, ease, lerpPose, poseAt, STOPS, type Pose, type V3 } from "../scene/camera-path.ts";
import { useStudio } from "../store.tsx";
import s from "../styles/vs.module.css";
import { DemoBadge, prefersReducedMotion } from "./ui.tsx";

export function detectQuality(): Quality {
  // Manual override for testing: ?quality=low or ?quality=high
  const forced = new URLSearchParams(window.location.search).get("quality");
  if (forced === "low" || forced === "high") return forced;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const small = window.matchMedia("(max-width: 820px)").matches;
  const weak = (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4;
  return small || weak ? "low" : "high";
}

/** Absolute scrollY of a studio progress value. */
function progressY(p: number) {
  const el = document.getElementById("studio");
  if (!el) return 0;
  return el.getBoundingClientRect().top + window.scrollY + (el.offsetHeight - window.innerHeight) * p;
}
export const travelToStop = (id: (typeof STOPS)[number]["id"], duration?: number) => travelTo(progressY(STOPS.find(x => x.id === id)!.p), duration);

/** Every resting point of the guided tour, ending at the top of the Beat Store. */
function tourStops() {
  const store = document.getElementById("beat-store");
  const ys = STOPS.map(x => progressY(x.p));
  if (store) ys.push(store.getBoundingClientRect().top + window.scrollY - (parseFloat(getComputedStyle(store).scrollMarginTop) || 0));
  return ys;
}
// Slow, cinematic moves: the waveform → Beat Store leg is the longest.
const stepDuration = (from: number, to: number) => (Math.max(from, to) >= STOPS.length ? 3000 : Math.abs(to - from) > 1 ? 2600 : from + to === 1 ? 2300 : 1900);

type Props = { introDone: boolean; noGl: boolean; onWebglFail: () => void };

const HOTSPOTS = [
  { id: "mic", label: "Registrazione voce", band: [0, 0.03] as const, Icon: Mic },
  { id: "screen", label: "Beat su misura", band: [0.19, 0.25] as const, Icon: MonitorPlay },
  { id: "display", label: "Entra nel Beat Store", band: [0.96, 1] as const, Icon: Disc3 },
] as const;

const SERVICE_STOPS: Record<string, number> = { mix: 0.5, master: 0.62, mixmaster: 0.74 };
const SVC_GAP = 0.12;

export function StudioStage({ introDone, noGl, onWebglFail }: Props) {
  const { open, panel, content } = useStudio();
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hotRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const svcRefs = useRef<(HTMLElement | null)[]>([]);
  const svcNavRef = useRef<HTMLOListElement>(null);
  const showcaseRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const live = useRef({ introDone, base: null as string | null, framed: false });
  const [ready, setReady] = useState(false);
  // bumped when the phone gives the WebGL context back after a memory-pressure loss: the scene is rebuilt
  const [glGen, setGlGen] = useState(0);
  const services = content.mix;

  useEffect(() => { live.current.introDone = introDone; }, [introDone]);
  // Opening a service = the camera flies to its object; inner steps refine the framing (see lib/shots).
  useEffect(() => {
    const base = panel?.type === "recording" ? "rec" : panel?.type === "custom" ? "custom" : panel?.type === "mix" ? (panel.view === "remote" ? "mix:remote" : panel.tab ? `mix:${panel.tab}` : "mix") : null;
    live.current.base = base;
    live.current.framed = Boolean(panel);
    setSubShot(null);
  }, [panel]);

  // Guided, step-by-step scrolling through the studio (disabled with reduced motion).
  useEffect(() => (noGl ? undefined : installStepper(tourStops, stepDuration, (from, to) => {
    if (from === STOPS.length - 1 && to === STOPS.length) { void enterStore(); return true; }
    return false;
  })), [noGl]);

  const activate = (id: string) => {
    if (id === "mic") open({ type: "recording" });
    else if (id === "screen") open({ type: "custom" });
    else void enterStore();
  };

  useEffect(() => {
    if (noGl) return;
    const canvas = canvasRef.current!;
    const section = sectionRef.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    } catch {
      onWebglFail();
      return;
    }
    let raf = 0;
    const onLost = (e: Event) => { e.preventDefault(); cancelAnimationFrame(raf); };
    const onRestored = () => setGlGen(g => g + 1);
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    const quality = detectQuality();
    const reduced = prefersReducedMotion();
    // Moderate pixel ratio: fill-rate is what limits 120 Hz screens, not geometry.
    let pixelRatio = Math.min(window.devicePixelRatio, quality === "high" ? 1.5 : 1.25);
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

    let w = 1, h = 1, portrait = false;
    // section metrics cached: no layout reads inside the frame loop
    let secTop = 0, secSpan = 1;
    const measure = () => {
      secTop = section.getBoundingClientRect().top + window.scrollY;
      secSpan = Math.max(1, section.offsetHeight - window.innerHeight);
    };
    const resize = () => {
      w = canvas.clientWidth; h = canvas.clientHeight; portrait = w / h < 0.9;
      renderer.setSize(w, h, false);
      composer?.setPixelRatio(renderer.getPixelRatio());
      composer?.setSize(w, h);
      camera.aspect = w / h;
      // Wider vertical FOV on portrait phones so the subjects stay framed.
      camera.fov = w / h < 0.8 ? 62 : 42;
      camera.updateProjectionMatrix();
      measure();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    ro.observe(document.body);

    // Final pose: square in front of the mixer display.
    rig.scene.updateMatrixWorld(true);
    const dPos = new THREE.Vector3(), dQ = new THREE.Quaternion();
    rig.anchors.display.getWorldPosition(dPos);
    rig.anchors.display.getWorldQuaternion(dQ);
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(dQ);
    const displayAt = (dist: number): Pose => {
      const c = dPos.clone().addScaledVector(normal, dist);
      return { pos: [c.x, c.y, c.z], target: [dPos.x, dPos.y, dPos.z] };
    };
    const endPose = (): Pose => displayAt(camera.aspect < 0.8 ? 0.42 : 0.2);
    const introPose: Pose = { pos: [0.4, 2.7, 6.2], target: [-0.6, 1.3, 0] };

    let visible = true, running = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { rootMargin: "100px" });
    io.observe(section);
    const onVis = () => { running = !document.hidden; };
    document.addEventListener("visibilitychange", onVis);
    const pointer = { x: 0, y: 0 }, sp = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => { if (e.pointerType === "mouse") { pointer.x = e.clientX / window.innerWidth - 0.5; pointer.y = e.clientY / window.innerHeight - 0.5; } };
    window.addEventListener("pointermove", onMove, { passive: true });

    // ---- shot tween: from wherever the camera is to the framing of the current step ----
    const camNow: Pose = { pos: [...introPose.pos] as V3, target: [...introPose.target] as V3 };
    let shotId: string | null = null;
    let tw: { from: Pose; to: Pose | null; t0: number; dur: number; arc: number } | null = null;
    const startShot = (id: string | null, now: number) => {
      shotId = id;
      const from: Pose = { pos: [...camNow.pos] as V3, target: [...camNow.target] as V3 };
      if (reduced) { tw = id ? { from, to: orbitPose(SHOTS[id], portrait), t0: now - 1e6, dur: 1, arc: 0 } : null; return; }
      const to = id ? orbitPose(SHOTS[id], portrait) : null;
      const ref = to ?? scrollPose;
      tw = { from, to, t0: now, dur: durFor(from, ref) * 1000, arc: arcFor(from, ref) };
    };
    let scrollPose: Pose = introPose;

    let introT = live.current.introDone ? 1 : 0;
    let framing = 0, svcShift = 0, last = -1;
    let first = true, frames = 0;
    // adaptive quality aims at the display's own refresh rate (60, 90, 120 Hz…)
    let refresh = 1 / 60, minDt = 1, sum = 0, n = 0, degrade = 0;
    let activeSvc = -2, hintState = "";
    const tmp = new THREE.Vector3(), off = new THREE.Vector3();

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = last < 0 ? 1 / 60 : Math.min((now - last) / 1000, 0.25);
      last = now;
      if (!running || (!visible && !first)) return;
      const t = now / 1000;
      if (!first && frames < 90) { minDt = Math.min(minDt, dt); refresh = Math.max(1 / 240, minDt); }
      else if (!first) {
        sum += dt; n++;
        if (n >= 90) {
          // too slow for this screen: first drop the bloom, then render fewer pixels
          if (sum / n > refresh * 1.4 && degrade < 4) {
            degrade++;
            if (composer) { composer.dispose(); composer = null; }
            else if (pixelRatio > 0.75) { pixelRatio = Math.max(0.75, pixelRatio - 0.25); renderer.setPixelRatio(pixelRatio); resize(); }
          }
          sum = 0; n = 0;
        }
      }
      frames++;

      // scroll progress read from the guided-move curve itself (same frame, same value)
      const p = clamp01((scrollAt(now) - secTop) / secSpan);
      if (live.current.introDone) introT = reduced ? 1 : Math.min(1, introT + dt / 1.8);
      scrollPose = lerpPose(introPose, poseAt(p, endPose(), reduced), ease(introT));
      // the display "dive" of the Beat Store transition
      const dv = getDive();
      if (dv > 0) scrollPose = lerpPose(scrollPose, displayAt(0.03), ease(dv));

      const want = live.current.base ? (getSubShot() ?? live.current.base) : null;
      if (want !== shotId && (want == null || SHOTS[want])) startShot(want, now);
      let pose = scrollPose;
      if (tw) {
        const u = clamp01((now - tw.t0) / tw.dur), e = ease(u);
        const to = tw.to ?? scrollPose;
        pose = lerpPose(tw.from, to, e);
        // arc: pull back in the middle of the move
        if (tw.arc > 0) {
          off.set(pose.pos[0] - pose.target[0], pose.pos[1] - pose.target[1], pose.pos[2] - pose.target[2]).normalize().multiplyScalar(Math.sin(Math.PI * u) * tw.arc);
          pose = { pos: [pose.pos[0] + off.x, pose.pos[1] + off.y + Math.sin(Math.PI * u) * tw.arc * 0.3, pose.pos[2] + off.z], target: pose.target };
        }
        if (u >= 1 && !tw.to) tw = null;
      }
      camNow.pos = pose.pos; camNow.target = pose.target;

      // always alive: a slow orbit + breathing dolly around the subject, wider inside a service
      const inShot = shotId != null;
      const amp = reduced ? 0 : inShot ? 1 : 0.55;
      const k = 1 - Math.exp(-dt * 4);
      sp.x += (pointer.x - sp.x) * k; sp.y += (pointer.y - sp.y) * k;
      const yaw = (Math.sin(t * 0.19) * 0.07 + Math.sin(t * 0.07) * 0.04) * amp + sp.x * -0.12 * (reduced ? 0 : 1);
      const bob = (Math.sin(t * 0.23) * 0.02) * amp - sp.y * 0.06 * (reduced ? 0 : 1);
      const dolly = 1 + Math.sin(t * 0.13) * 0.045 * amp;
      off.set(pose.pos[0] - pose.target[0], pose.pos[1] - pose.target[1], pose.pos[2] - pose.target[2]).multiplyScalar(dolly).applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
      camera.position.set(pose.target[0] + off.x, pose.target[1] + off.y + bob, pose.target[2] + off.z);
      camera.lookAt(pose.target[0], pose.target[1], pose.target[2]);

      // framing: when a panel or the service cards cover part of the screen, slide the picture aside
      const svcBand = live.current.framed ? 0 : band(p, 0.5, 0.74, 0.1);
      const kf = reduced ? 1 : 1 - Math.exp(-dt * 3);
      framing += ((live.current.framed ? 1 : 0) - framing) * kf;
      svcShift += (svcBand - svcShift) * kf;
      const fr = Math.max(framing, svcShift);
      if (fr > 0.002) camera.setViewOffset(w, h, portrait ? 0 : w * 0.21 * fr, portrait ? h * (framing > svcShift ? 0.27 : 0.2) * fr : 0, w, h);
      else if (camera.view) camera.clearViewOffset();

      rig.setReveal(Math.min(ease(introT) * 0.25 + p * 2.2, 1) * Math.max(0.25, introT));
      rig.tick(t, !reduced, musicLevel(now));
      if (composer) composer.render(); else renderer.render(rig.scene, camera);
      first = false;
      // Safety net: if post-processing ever outputs a fully black frame on this GPU, drop it and render directly.
      if (composer && frames === 6) {
        const gl = renderer.getContext();
        const pxl = new Uint8Array(4);
        let lit = 0;
        for (const [fx, fy] of [[0.5, 0.5], [0.25, 0.3], [0.75, 0.3], [0.3, 0.75], [0.7, 0.75], [0.5, 0.15]]) {
          gl.readPixels(Math.floor(gl.drawingBufferWidth * fx), Math.floor(gl.drawingBufferHeight * fy), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pxl);
          lit = Math.max(lit, pxl[0], pxl[1], pxl[2]);
        }
        if (lit < 3) { composer.dispose(); composer = null; }
      }

      // hotspots follow their 3D anchors
      HOTSPOTS.forEach(hs => {
        const el = hotRefs.current[hs.id];
        if (!el) return;
        rig.anchors[hs.id].getWorldPosition(tmp);
        tmp.project(camera);
        const v = (tmp.z > 1 || live.current.framed || dv > 0 ? 0 : band(p, hs.band[0], hs.band[1], 0.05)) * (hs.id === "mic" ? introT : 1);
        // keep the button and its label inside the screen on narrow phones
        const sx = Math.min(w - 90, Math.max(90, ((tmp.x + 1) / 2) * w));
        el.style.transform = `translate3d(${sx}px, ${((1 - tmp.y) / 2) * h}px, 0)`;
        el.style.opacity = String(v);
        el.style.visibility = v < 0.15 ? "hidden" : "visible";
      });
      paintServices(p);

      // "scroll" hint: only while resting on a stop
      const resting = !isTraveling() && introT > 0.9 && !live.current.framed && dv === 0;
      const hs = !resting ? "off" : p < 0.02 ? "start" : p > 0.98 ? "store" : svcBand > 0.5 ? "svc" : "on";
      if (hs !== hintState && hintRef.current) {
        hintState = hs;
        hintRef.current.dataset.state = hs;
      }
    };

    // Service cards: each one enters from below while turning, holds, then leaves upwards.
    const paintServices = (p: number) => {
      const wrap = showcaseRef.current;
      if (!wrap) return;
      const showing = live.current.framed ? 0 : band(p, 0.5, 0.74, 0.1);
      wrap.style.visibility = showing < 0.01 ? "hidden" : "visible";
      let best = -1, bestV = 0;
      svcRefs.current.forEach((el, i) => {
        if (!el) return;
        const spos = SERVICE_STOPS[services[i]?.id] ?? 0.5;
        const d = Math.max(-1.2, Math.min(1.2, (p - spos) / SVC_GAP));
        const a = clamp01(1 - Math.abs(d) * 2.1) * (live.current.framed ? 0 : 1);
        if (a > bestV) { bestV = a; best = i; }
        el.style.opacity = String(a);
        el.style.visibility = a < 0.02 ? "hidden" : "visible";
        el.style.setProperty("--d", d.toFixed(4));
        el.style.setProperty("--ad", Math.min(1, Math.abs(d)).toFixed(4));
        el.toggleAttribute("inert", a < 0.6);
      });
      if (best !== activeSvc) {
        activeSvc = best;
        svcNavRef.current?.querySelectorAll("button").forEach((b, i) => b.toggleAttribute("data-on", i === best));
      }
    };

    raf = requestAnimationFrame(frame);
    const readyT = window.setTimeout(() => setReady(true), 0);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
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
  }, [noGl, glGen]);

  if (noGl) return <StudioFallback />;

  return (
    <section id="studio" ref={sectionRef} className={s.stageSection} aria-label="Studio virtuale GENKS">
      <div className={s.stageSticky}>
        <canvas ref={canvasRef} className={s.stageCanvas} data-ready={ready || undefined} aria-hidden="true" />
        <div className={s.stageVignette} aria-hidden="true" />
        {HOTSPOTS.map(hs => (
          <button key={hs.id} ref={el => { hotRefs.current[hs.id] = el; }} type="button" className={s.hotspot} data-id={hs.id} onClick={() => activate(hs.id)}>
            <span className={s.hotPulse} aria-hidden="true"><hs.Icon size={20} /></span>
            <span className={s.hotLabel}>{hs.label}</span>
          </button>
        ))}

        <div ref={showcaseRef} className={s.showcase} aria-label="Servizi Mix & Master" role="region">
          <ol ref={svcNavRef} className={s.svcNav} aria-label="Scegli il servizio">
            {services.map(m => <li key={m.id}><button type="button" onClick={() => travelToStop(m.id)}>{m.name}</button></li>)}
          </ol>
          {services.map((m, i) => (
            <article key={m.id} ref={el => { svcRefs.current[i] = el; }} className={s.svc} data-i={i} aria-labelledby={`svc-${m.id}`}>
              <span className={s.svcWord} aria-hidden="true">{m.name}</span>
              <SvcVisual kind={m.id} />
              <div className={s.svcText}>
                <p className={s.kicker}>Banco mixer</p>
                <h3 id={`svc-${m.id}`}>{m.name}</h3>
                <p className={s.svcSummary}>{m.summary}</p>
                <p className={s.svcPrice}><strong>{m.price != null ? formatEuro(m.price) : "Su preventivo"}</strong> <small>{m.priceNote}</small> <DemoBadge /></p>
                <ul className={s.svcList}>{m.includes.slice(0, 3).map(x => <li key={x}><Check size={15} aria-hidden="true" />{x}</li>)}</ul>
                <div className={s.svcCta}>
                  <button type="button" className={s.btnPrimary} onClick={() => open({ type: "mix", tab: m.id })}><SlidersHorizontal size={16} /> Scegli {m.name}</button>
                  <button type="button" className={s.btnGhost} onClick={() => open({ type: "mix", tab: m.id, view: "remote" })}><Upload size={16} /> Invia il progetto</button>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div ref={hintRef} className={s.scrollHint} data-state="off" aria-hidden="true">
          <span className={s.hintIcon}><Mouse size={22} className={s.hintMouse} /><Hand size={22} className={s.hintHand} /></span>
          <span className={s.hintStart}>Scorri verso il basso per scoprire i servizi</span>
          <span className={s.hintOn}>Scorri</span>
          <span className={s.hintStore}>Scorri per entrare nel Beat Store</span>
        </div>
      </div>
    </section>
  );
}

/** Animated audio visual for each service: waveform (Mix), loudness meter (Master), both (Mix & Master). */
function SvcVisual({ kind }: { kind: string }) {
  const bars = Array.from({ length: 28 }, (_, i) => 0.25 + Math.abs(Math.sin(i * 0.7) * Math.cos(i * 0.23)) * 0.75);
  return (
    <div className={s.svcVisual} data-kind={kind} aria-hidden="true">
      {kind !== "master" && <span className={s.svcWave}>{bars.map((b, i) => <i key={i} style={{ ["--h" as string]: b, ["--i" as string]: i }} />)}</span>}
      {kind !== "mix" && <span className={s.svcMeter}>{Array.from({ length: 2 }, (_, c) => <span key={c}>{Array.from({ length: 14 }, (_, k) => <i key={k} style={{ ["--k" as string]: k }} />)}</span>)}</span>}
    </div>
  );
}

/** Shown only when this browser cannot run WebGL at all. */
function StudioFallback() {
  const { open } = useStudio();
  const items = [
    { Icon: Mic, title: "Registrazione voce", go: () => open({ type: "recording" }) },
    { Icon: MonitorPlay, title: "Beat su misura", go: () => open({ type: "custom" }) },
    { Icon: SlidersHorizontal, title: "Mix & Master", go: () => open({ type: "mix" }) },
    { Icon: Disc3, title: "Beat Store", go: () => travelToId("beat-store") },
  ];
  return (
    <section id="studio" className={s.stageFallback} aria-label="Servizi GENKS">
      {items.map(it => (
        <button key={it.title} type="button" className={s.fallbackCard} onClick={it.go}>
          <span className={s.liteIcon} aria-hidden="true"><it.Icon size={28} /></span>
          <strong>{it.title}</strong>
        </button>
      ))}
    </section>
  );
}
