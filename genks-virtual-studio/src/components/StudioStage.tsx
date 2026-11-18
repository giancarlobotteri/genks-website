import { Disc3, Mic, MonitorPlay, Mouse, Hand, SlidersHorizontal, Upload, Check, Clapperboard } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { formatEuro } from "../lib/catalog.ts";
import { getDirector, useDirector } from "../lib/director.ts";
import { musicLevel } from "../lib/level.ts";
import { enterStore, goService, replayReel } from "../lib/nav.ts";
import { getDive, getSubShot, setSubShot } from "../lib/shots.ts";
import { goToStop, installStepper, isMoving, overshoot, stopPos, tickStepper } from "../lib/stepper.ts";
import { arcFor, drift, durFor, orbitPose, SHOTS } from "../scene/shot-table.ts";
import { buildStudio, type ConsoleMode, type HitId, type Quality } from "../scene/build-studio.ts";
import { createCinemaFx, type CinemaFx } from "../scene/cinema-fx.ts";
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

/** Camera-path progress (0..1) of a position measured in stops. */
const progressOf = (pos: number) => {
  const i = Math.max(0, Math.min(STOPS.length - 2, Math.floor(pos)));
  const f = clamp01(pos - i);
  return STOPS[i].p + (STOPS[i + 1].p - STOPS[i].p) * f;
};

export const travelToStop = (id: (typeof STOPS)[number]["id"]) => goToStop(STOPS.findIndex(x => x.id === id));

type Props = { noGl: boolean; onWebglFail: () => void };

const HOTSPOTS = [
  { id: "mic", anchor: "micHot", label: "Prenota una sessione", stop: 0, Icon: Mic },
  { id: "screen", anchor: "screen", label: "Beat su misura", stop: 3, Icon: MonitorPlay },
  { id: "display", anchor: "display", label: "Entra nel Beat Store", stop: 7, Icon: Disc3 },
] as const;

const SERVICE_STOPS: Record<string, number> = { mix: 4, master: 5, mixmaster: 6 };
/** The exploded microphone: one caption per part (anchors in scene/build-studio). */
const CALLOUTS = [
  { id: "grille", title: "Doppia griglia", text: "Protegge la capsula, lascia passare ogni dettaglio" },
  { id: "capsule", title: "Capsula a diaframma largo", text: "Voce piena, calda e presente" },
  { id: "mount", title: "Sospensione elastica", text: "Nessuna vibrazione arriva al segnale" },
  { id: "xlr", title: "Uscita XLR bilanciata", text: "Segnale pulito fino al preamplificatore" },
] as const;
/** Reveal of the studio lights for each shot of the preview (0 = the microphone alone in the dark). */
const REEL_REVEAL: Record<string, number> = { "reel:dark": 0.02, "reel:intro": 0.45, "reel:rec": 0.03, "reel:custom": 0.8, "reel:mix": 1, "reel:store": 1, "reel:choose": 0.9 };

export function StudioStage({ noGl, onWebglFail }: Props) {
  const { panel, content } = useStudio();
  const { screen } = useDirector();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hotRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const svcRefs = useRef<(HTMLElement | null)[]>([]);
  const svcNavRef = useRef<HTMLOListElement>(null);
  const showcaseRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const anatomyRef = useRef<HTMLDivElement>(null);
  const calloutRefs = useRef<(HTMLDivElement | null)[]>([]);
  const railRef = useRef<HTMLOListElement>(null);
  const live = useRef({ base: null as string | null, framed: false });
  const [ready, setReady] = useState(false);
  // bumped when the phone gives the WebGL context back after a memory-pressure loss: the scene is rebuilt
  const [glGen, setGlGen] = useState(0);
  const services = content.mix;

  // Opening a service = the camera flies to its object; inner steps refine the framing (see lib/shots).
  useEffect(() => {
    const base = panel?.type === "recording" ? "rec" : panel?.type === "custom" ? "custom" : panel?.type === "mix" ? (panel.view === "remote" ? "mix:remote" : panel.tab ? `mix:${panel.tab}` : "mix") : null;
    live.current.base = base;
    live.current.framed = Boolean(base);
    setSubShot(null);
  }, [panel]);

  // Virtual step-by-step tour of the studio; pushing past the display enters the Beat Store.
  useEffect(() => installStepper(STOPS.length, () => void enterStore(), STOPS.map(x => x.glide)), []);

  const activate = (id: string) => {
    if (id === "mic") void goService("recording");
    else if (id === "screen") void goService("custom");
    else if (id === "mixer") void goService("mix");
    else void enterStore();
  };
  const activateRef = useRef(activate);
  useEffect(() => { activateRef.current = activate; });

  useEffect(() => {
    if (noGl) return;
    const canvas = canvasRef.current!;
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
    // Cinematic pipeline (HDR, depth of field, bloom on light sources, grade, grain) on capable GPUs only.
    let composer: CinemaFx | null = null;
    if (quality === "high") {
      try { composer = createCinemaFx(renderer, rig.scene, camera); } catch { composer = null; }
    }
    const dropComposer = () => {
      composer?.dispose(); composer = null;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      rig.setHdr(false);
    };
    if (!composer) dropComposer();

    let w = 1, h = 1, portrait = false, baseFov = 42, lensNow = 1;
    const applyFov = (lens: number) => {
      lensNow = lens;
      camera.fov = (2 * Math.atan(Math.tan((baseFov * Math.PI) / 360) * lens) * 180) / Math.PI;
      camera.updateProjectionMatrix();
    };
    const resize = () => {
      w = canvas.clientWidth; h = canvas.clientHeight; portrait = w / h < 0.9;
      renderer.setSize(w, h, false);
      composer?.setSize(w, h);
      camera.aspect = w / h;
      // Wider vertical FOV on portrait phones so the subjects stay framed; on super-ultrawide
      // monitors (32:9) the horizontal angle is capped at ~95° so the room never looks stretched.
      const aspect = w / h;
      baseFov = aspect < 0.8 ? 62 : Math.min(42, (2 * Math.atan(Math.tan((47.5 * Math.PI) / 180) / aspect) * 180) / Math.PI);
      applyFov(lensNow);
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
    const displayAt = (dist: number): Pose => {
      const c = dPos.clone().addScaledVector(normal, dist);
      return { pos: [c.x, c.y, c.z], target: [dPos.x, dPos.y, dPos.z] };
    };
    // the preview's Beat Store shot frames the display, slowly pushing in
    SHOTS["reel:store"] = { t: [dPos.x, dPos.y, dPos.z], yaw: Math.atan2(normal.x, normal.z) + 0.28, pitch: Math.asin(Math.max(-1, Math.min(1, normal.y))) + 0.2, dist: 0.75, spin: -0.06, push: -0.06 };
    const endPose = (): Pose => displayAt(camera.aspect < 0.8 ? 0.42 : 0.2);
    const introPose: Pose = { pos: [0.4, 2.7, 6.2], target: [-0.6, 1.3, 0] };

    let running = true;
    const onVis = () => { running = !document.hidden; };
    document.addEventListener("visibilitychange", onVis);
    const pointer = { x: 0, y: 0 }, sp = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => { if (e.pointerType === "mouse") { pointer.x = e.clientX / window.innerWidth - 0.5; pointer.y = e.clientY / window.innerHeight - 0.5; } };
    window.addEventListener("pointermove", onMove, { passive: true });

    // The objects of the studio are clickable themselves: hover lights them up, a click opens their service.
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), sph = new THREE.Sphere();
    let hoverId: HitId | null = null, canHit = false, curPos = 0;
    const hitAt = (cx: number, cy: number): HitId | null => {
      if (!canHit) return null;
      const r = canvas.getBoundingClientRect();
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      let best: HitId | null = null, bestD = Infinity;
      for (const hz of rig.hits) {
        // only what the current shot is about
        const allowed = hz.id === "mic" ? curPos < 1.5 : hz.id === "screen" ? curPos > 2.5 && curPos < 3.5 : curPos > 3.5 && curPos < 6.5;
        if (!allowed) continue;
        hz.obj.getWorldPosition(sph.center); sph.radius = hz.r;
        const hit = ray.ray.intersectSphere(sph, tmp);
        if (hit) { const d = hit.distanceTo(camera.position); if (d < bestD) { bestD = d; best = hz.id; } }
      }
      return best;
    };
    const onCanvasMove = (e: PointerEvent) => {
      const id = e.pointerType === "mouse" ? hitAt(e.clientX, e.clientY) : null;
      if (id !== hoverId) { hoverId = id; rig.setHover(id); canvas.style.cursor = id ? "pointer" : ""; }
    };
    const onCanvasLeave = () => { if (hoverId) { hoverId = null; rig.setHover(null); canvas.style.cursor = ""; } };
    const onCanvasClick = (e: MouseEvent) => {
      const id = hitAt(e.clientX, e.clientY);
      if (id) activateRef.current(id);
    };
    canvas.addEventListener("pointermove", onCanvasMove, { passive: true });
    canvas.addEventListener("pointerleave", onCanvasLeave, { passive: true });
    canvas.addEventListener("click", onCanvasClick);

    // ---- shot tween: from wherever the camera is to a (moving) framing ----
    const camNow: Pose = { pos: [...introPose.pos] as V3, target: [...introPose.target] as V3, lens: 1 };
    let shotId: string | null = null, shotT0 = 0;
    let tw: { from: Pose; t0: number; dur: number; arc: number } | null = null;
    const shotPose = (id: string, now: number) => orbitPose(drift(SHOTS[id], reduced ? 0 : (now - shotT0) / 1000), portrait);
    const startShot = (id: string | null, now: number) => {
      shotId = id;
      shotT0 = now;
      const from: Pose = { pos: [...camNow.pos] as V3, target: [...camNow.target] as V3, lens: camNow.lens ?? 1 };
      const ref = id ? shotPose(id, now) : studioPose;
      tw = reduced ? { from, t0: now - 1e6, dur: 1, arc: 0 } : { from, t0: now, dur: durFor(from, ref) * 1000 * (id?.startsWith("reel:") ? 1.25 : 1), arc: arcFor(from, ref) };
    };
    let studioPose: Pose = introPose;

    let fx = 0, fy = 0, last = -1, wake = 0;
    let first = true, frames = 0;
    // adaptive quality aims at the display's own refresh rate (60, 90, 120 Hz…)
    let refresh = 1 / 60, minDt = 1, sum = 0, n = 0, degrade = 0;
    let activeSvc = -2, hintState = "", lastScreen = "";
    const tmp = new THREE.Vector3(), off = new THREE.Vector3(), focusV = new THREE.Vector3();
    // light direction values, eased so a change of screen never pops
    const look = { reveal: 0, hero: 0, title: 0 };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = last < 0 ? 1 / 60 : Math.min((now - last) / 1000, 0.25);
      last = now;
      const dir = getDirector();
      if (dir.screen !== lastScreen) { lastScreen = dir.screen; wake = now + 2600; }
      // the store covers the studio: stop rendering once its intro has taken over
      const hidden = dir.screen === "store" && now > wake && getDive() >= 1;
      if (!running || (hidden && !first)) return;
      const t = now / 1000;
      if (!first && frames < 90) { minDt = Math.min(minDt, dt); refresh = Math.max(1 / 240, minDt); }
      else if (!first) {
        sum += dt; n++;
        if (n >= 90) {
          // too slow for this screen: first drop the bloom, then render fewer pixels
          if (sum / n > refresh * 1.4 && degrade < 5) {
            degrade++;
            if (composer && composer.dropDof()) { /* depth of field off first */ }
            else if (composer) dropComposer();
            else if (pixelRatio > 0.75) { pixelRatio = Math.max(0.75, pixelRatio - 0.25); renderer.setPixelRatio(pixelRatio); resize(); }
          }
          sum = 0; n = 0;
        }
      }
      frames++;

      // the virtual scroll advances in this same frame: camera and UI read one value
      tickStepper(dt);
      const pos = stopPos();
      const p = progressOf(pos);
      studioPose = poseAt(p, endPose(), reduced);

      const want = dir.screen === "reel" ? dir.reelShot : live.current.base ? (getSubShot() ?? live.current.base) : null;
      if (want !== shotId && (want == null || SHOTS[want])) startShot(want, now);
      let pose = studioPose;
      if (tw) {
        const u = clamp01((now - tw.t0) / tw.dur), e = ease(u);
        const to = shotId ? shotPose(shotId, now) : studioPose;
        pose = lerpPose(tw.from, to, e);
        // arc: pull back in the middle of the move
        if (tw.arc > 0) {
          off.set(pose.pos[0] - pose.target[0], pose.pos[1] - pose.target[1], pose.pos[2] - pose.target[2]).normalize().multiplyScalar(Math.sin(Math.PI * u) * tw.arc);
          pose = { pos: [pose.pos[0] + off.x, pose.pos[1] + off.y + Math.sin(Math.PI * u) * tw.arc * 0.3, pose.pos[2] + off.z], target: pose.target };
        }
        if (u >= 1 && !shotId) tw = null;
      } else if (shotId) pose = shotPose(shotId, now);
      // the dive into the mixer display (Beat Store), or a pull past the last stop
      const dv = Math.max(getDive(), Math.min(0.45, overshoot() * 1.2));
      if (dv > 0) pose = lerpPose(pose, { ...displayAt(0.03), lens: 1 }, ease(dv));
      camNow.pos = pose.pos; camNow.target = pose.target; camNow.lens = pose.lens ?? 1;
      if (Math.abs((pose.lens ?? 1) - lensNow) > 1e-4) applyFov(pose.lens ?? 1);

      // always alive: a slow orbit + breathing dolly around the subject, wider inside a service
      const inShot = shotId != null;
      const amp = reduced ? 0 : inShot ? 1 : 0.55;
      const k = 1 - Math.exp(-dt * 4);
      sp.x += (pointer.x - sp.x) * k; sp.y += (pointer.y - sp.y) * k;
      const yaw = (Math.sin(t * 0.19) * 0.07 + Math.sin(t * 0.07) * 0.04) * amp * (1 - dv) + sp.x * -0.12 * (reduced ? 0 : 1);
      const bob = (Math.sin(t * 0.23) * 0.02) * amp - sp.y * 0.06 * (reduced ? 0 : 1);
      const dolly = 1 + Math.sin(t * 0.13) * 0.045 * amp;
      off.set(pose.pos[0] - pose.target[0], pose.pos[1] - pose.target[1], pose.pos[2] - pose.target[2]).multiplyScalar(dolly).applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
      camera.position.set(pose.target[0] + off.x, pose.target[1] + off.y + bob, pose.target[2] + off.z);
      camera.lookAt(pose.target[0], pose.target[1], pose.target[2]);

      // framing: slide the picture away from whatever covers part of the screen
      const svcBand = dir.screen === "studio" && !live.current.framed ? band(pos, 4, 6, 0.5) : 0;
      const anaBand = dir.screen === "studio" && !live.current.framed ? band(pos, 1, 1, 0.6) : 0;
      let gx = 0, gy = 0;
      // the subject is centred in the free part of the screen, measured from the real widths of
      // the text / panel / card (so 16:9, 21:9, 32:9 and 4:3 monitors all frame it the same way)
      if (dir.screen === "reel") {
        if (dir.reelChoosing) { gx = 0; gy = 0; }
        else { gx = portrait ? 0 : -Math.min(0.2, (Math.min(660, w * 0.92) + Math.min(56, Math.max(16, w * 0.04))) / 2 / w); gy = portrait ? 0.12 : 0; }
      } else if (live.current.framed) { gx = portrait ? 0 : Math.min(0.24, (Math.min(600, w * 0.47) + 28) / 2 / w + 20 / w); gy = portrait ? 0.17 : 0; }
      // anatomy: text on the left (desktop) or on top (phone); on phones the microphone moves left so the captions fit on its right
      else if (anaBand > 0) { gx = (portrait ? 0.17 : -Math.min(0.2, (Math.min(470, w * 0.38) + 40) / 2 / w)) * anaBand; gy = portrait ? -0.07 * anaBand : 0; }
      else if (svcBand > 0) { gx = portrait ? 0 : Math.min(0.24, (Math.min(500, w * 0.44) + Math.max(16, w * 0.05)) / 2 / w + 10 / w) * svcBand; gy = portrait ? 0.2 * svcBand : 0; }
      const kf = reduced ? 1 : 1 - Math.exp(-dt * 2.6);
      fx += (gx - fx) * kf; fy += (gy - fy) * kf;
      if (Math.abs(fx) + Math.abs(fy) > 0.001) camera.setViewOffset(w, h, w * fx, h * fy, w, h);
      else if (camera.view) camera.clearViewOffset();

      // ---- direction of light: the microphone alone in the dark, then the studio lights up with the scroll
      const touringNow = dir.screen === "studio" && !live.current.framed;
      const base = live.current.base;
      let wantReveal = 1, wantHero = 0, wantTitle = 0;
      if (dir.screen === "reel") {
        wantReveal = REEL_REVEAL[dir.reelShot ?? ""] ?? 0.9;
        // the opening shot: the studio wakes up in the dark while the camera pushes in
        if (dir.reelShot === "reel:intro") wantReveal = 0.04 + (REEL_REVEAL["reel:intro"] - 0.04) * clamp01((now - shotT0 - 400) / 3600);
        wantHero = dir.reelShot === "reel:rec" ? 1 : 0;
      }
      else if (dir.screen === "studio") {
        if (base?.startsWith("rec")) { wantReveal = 0.05; wantHero = 0.85; }
        else if (base === "custom") wantReveal = 0.85;
        // stop 0 microphone · stop 1 anatomy (still in the dark) · stop 2 the studio lights up
        else if (!base) { wantReveal = clamp01(pos - 1); wantHero = 1 - clamp01((pos - 1) / 0.65); wantTitle = 1 - clamp01(pos / 0.3); }
      }
      // scroll-driven values follow the scroll closely, state changes fade like a lighting cue
      const kl = reduced ? 1 : 1 - Math.exp(-dt * (touringNow ? 9 : 1.6));
      look.reveal += (wantReveal - look.reveal) * kl;
      look.hero += (wantHero - look.hero) * kl;
      look.title += (wantTitle - look.title) * (reduced ? 1 : 1 - Math.exp(-dt * (touringNow ? 9 : 4)));
      rig.setReveal(look.reveal);
      rig.setHero(look.hero);
      rig.setTitle(look.title);
      const tab = base?.startsWith("mix") ? (getSubShot() ?? base) : null;
      const mode: ConsoleMode = tab ? (tab.includes("mixmaster") ? "mixmaster" : tab.includes("master") ? "master" : "mix")
        : dir.screen === "reel" && dir.reelShot === "reel:mix" ? "mix"
        : touringNow && pos > 3.5 && pos < 6.5 ? (["mix", "master", "mixmaster"] as const)[Math.min(2, Math.max(0, Math.round(pos) - 4))] : "idle";
      rig.setMode(mode);
      // anatomy: the microphone opens up on the way to stop 1 and closes again while the camera pulls back
      rig.setExplode(dir.screen === "studio" && !base ? (pos <= 1 ? clamp01((pos - 0.08) / 0.84) : 1 - clamp01((pos - 1.06) / 0.5)) : 0);
      curPos = pos; canHit = touringNow && dv === 0;
      rig.tick(t, !reduced, musicLevel(now), dt);
      // rack focus on the subject of the shot
      focusV.set(pose.target[0], pose.target[1], pose.target[2]);
      composer?.focus(focusV, pose.lens ?? 1);
      if (composer) composer.render(dt); else renderer.render(rig.scene, camera);
      first = false;
      // Safety net: if post-processing ever outputs a fully black frame on this GPU, drop it and render directly.
      if (composer && frames === 6) {
        const gl = renderer.getContext();
        const pxl = new Uint8Array(4);
        let lit = 0;
        for (const [px, py] of [[0.5, 0.5], [0.25, 0.3], [0.75, 0.3], [0.3, 0.75], [0.7, 0.75], [0.5, 0.15]]) {
          gl.readPixels(Math.floor(gl.drawingBufferWidth * px), Math.floor(gl.drawingBufferHeight * py), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pxl);
          lit = Math.max(lit, pxl[0], pxl[1], pxl[2]);
        }
        if (lit < 3) dropComposer();
      }

      const touring = dir.screen === "studio" && !live.current.framed;
      // hotspots follow their 3D anchors
      HOTSPOTS.forEach(hs => {
        const el = hotRefs.current[hs.id];
        if (!el) return;
        rig.anchors[hs.anchor].getWorldPosition(tmp);
        tmp.project(camera);
        const v = tmp.z > 1 || !touring || dv > 0.02 ? 0 : band(pos, hs.stop, hs.stop, 0.3);
        // keep the button and its label inside the screen on narrow phones
        const sx = Math.min(w - 90, Math.max(90, ((tmp.x + 1) / 2) * w));
        el.style.transform = `translate3d(${sx}px, ${((1 - tmp.y) / 2) * h}px, 0)`;
        el.style.opacity = String(v);
        el.style.visibility = v < 0.15 ? "hidden" : "visible";
      });
      paintServices(pos, touring);
      // the establishing shot has its own title, like the opening of a film
      const tv = touring && dv === 0 ? band(pos, 2, 2, 0.45) : 0;
      // anatomy captions: each one follows its part of the exploded microphone
      const av = touring && dv === 0 ? band(pos, 1, 1, 0.55) : 0;
      const ana = anatomyRef.current;
      if (ana) {
        ana.style.setProperty("--av", av.toFixed(3));
        ana.style.visibility = av < 0.02 ? "hidden" : "visible";
        ana.toggleAttribute("inert", av < 0.6);
        rig.callouts.forEach((c, i) => {
          const el = calloutRefs.current[i];
          if (!el) return;
          c.obj.getWorldPosition(tmp);
          tmp.project(camera);
          const x = ((tmp.x + 1) / 2) * w, y = ((1 - tmp.y) / 2) * h;
          const left = x > w - 175 && x > w * 0.5;
          el.dataset.side = left ? "left" : "right";
          el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(${left ? "-100%" : "0"}, -50%)`;
          el.style.opacity = clamp01((av - 0.35 - i * 0.1) / 0.35).toFixed(3);
        });
      }
      if (titleRef.current) {
        titleRef.current.style.opacity = tv.toFixed(3);
        titleRef.current.style.setProperty("--tv", tv.toFixed(3));
        titleRef.current.style.visibility = tv < 0.02 ? "hidden" : "visible";
      }
      // the stop rail: its ink follows the exact position
      railRef.current?.style.setProperty("--pos", pos.toFixed(4));

      // "scroll" hint: only while resting on a stop
      const resting = touring && !isMoving() && dv === 0;
      const hs = !resting ? "off" : pos < 0.05 ? "start" : pos > STOPS.length - 1.05 ? "store" : svcBand > 0.5 ? "svc" : "on";
      if (hs !== hintState && hintRef.current) {
        hintState = hs;
        hintRef.current.dataset.state = hs;
      }
    };

    // Service cards: each one enters from below while turning, holds, then leaves upwards.
    const paintServices = (pos: number, touring: boolean) => {
      const wrap = showcaseRef.current;
      if (!wrap) return;
      const showing = touring ? band(pos, 4, 6, 0.5) : 0;
      wrap.style.visibility = showing < 0.01 ? "hidden" : "visible";
      let best = -1, bestV = 0;
      svcRefs.current.forEach((el, i) => {
        if (!el) return;
        const spos = SERVICE_STOPS[services[i]?.id] ?? 4;
        const d = Math.max(-1.2, Math.min(1.2, pos - spos));
        const a = clamp01(1 - Math.abs(d) * 2.1) * (touring ? 1 : 0);
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
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointermove", onCanvasMove);
      canvas.removeEventListener("pointerleave", onCanvasLeave);
      canvas.removeEventListener("click", onCanvasClick);
      composer?.dispose();
      rig.dispose();
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noGl, glGen]);

  const touringUi = screen === "studio" && !panel;

  return (
    <section id="studio" className={s.stage} data-screen={screen} aria-label="Studio virtuale GENKS">
      {noGl ? <div className={s.stageNoGl} aria-hidden="true" /> : <canvas ref={canvasRef} className={s.stageCanvas} data-ready={ready || undefined} aria-hidden="true" />}
      <div className={s.stageVignette} aria-hidden="true" />
      {!noGl && HOTSPOTS.map(hs => (
        <button key={hs.id} ref={el => { hotRefs.current[hs.id] = el; }} type="button" className={s.hotspot} data-id={hs.id} onClick={() => activate(hs.id)} tabIndex={touringUi ? 0 : -1}>
          <span className={s.hotPulse} aria-hidden="true"><hs.Icon size={20} /></span>
          <span className={s.hotLabel}>{hs.label}</span>
        </button>
      ))}

      {!noGl && (
        <div ref={showcaseRef} className={s.showcase} aria-label="Servizi Mix & Master" role="region">
          <ol ref={svcNavRef} className={s.svcNav} aria-label="Scegli il servizio">
            {services.map(m => <li key={m.id}><button type="button" onClick={() => void goToStop(SERVICE_STOPS[m.id])}>{m.name}</button></li>)}
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
                  <button type="button" className={s.btnPrimary} onClick={() => void goService("mix", { tab: m.id })}><SlidersHorizontal size={16} /> Scegli {m.name}</button>
                  <button type="button" className={s.btnGhost} onClick={() => void goService("mix", { tab: m.id, view: "remote" })}><Upload size={16} /> Invia il progetto</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {touringUi && (
        <>
          {!noGl && (
            <ol ref={railRef} className={s.stopRail} aria-label="Tappe dello studio">
              <span className={s.stopInk} aria-hidden="true" />
              {STOP_LABELS.map((l, i) => <li key={l}><button type="button" onClick={() => void goToStop(i)} aria-label={`Vai a: ${l}`}><span>{l}</span></button></li>)}
            </ol>
          )}
          <StudioDock />
        </>
      )}

      {!noGl && (
        <div ref={anatomyRef} className={s.anatomy} role="region" aria-label="Anatomia della voce">
          <div className={s.anatomyText}>
            <p className={s.kicker}>Anatomia della voce</p>
            <h2>Ogni dettaglio,<br />al servizio della tua voce.</h2>
            <p>Registri in cabina trattata, con un microfono a condensatore a diaframma largo e un engineer che segue la sessione.</p>
            <button type="button" className={s.btnPrimary} onClick={() => void goService("recording")}><Mic size={16} /> Prenota una sessione</button>
          </div>
          {CALLOUTS.map((c, i) => (
            <div key={c.id} ref={el => { calloutRefs.current[i] = el; }} className={s.callout} data-side="right" aria-hidden="true">
              <span className={s.calloutDot} /><span className={s.calloutLine} />
              <span className={s.calloutBox}><strong>{c.title}</strong><small>{c.text}</small></span>
            </div>
          ))}
        </div>
      )}

      {!noGl && (
        <div ref={titleRef} className={s.studioTitle} aria-hidden="true">
          <span className={s.studioKicker}>GENKS · Studio</span>
          <span className={s.studioName}>Un unico spazio,<br />tre servizi.</span>
          <span className={s.studioSub}>Registrazione · Produzione · Mix &amp; Master</span>
        </div>
      )}

      {!noGl && (
        <div ref={hintRef} className={s.scrollHint} data-state="off" aria-hidden="true">
          <span className={s.hintIcon}><Mouse size={22} className={s.hintMouse} /><Hand size={22} className={s.hintHand} /></span>
          <span className={s.hintStart}>Scorri per esplorare lo studio</span>
          <span className={s.hintOn}>Scorri</span>
          <span className={s.hintStore}>Scorri per entrare nel Beat Store</span>
        </div>
      )}
    </section>
  );
}

const STOP_LABELS = ["Microfono", "Anatomia", "Studio", "Monitor DAW", "Mix", "Master", "Mix & Master", "Beat Store"];

/** Always on screen in the studio: jump to any service, or watch the preview again. */
export function StudioDock() {
  const items = [
    { Icon: Mic, label: "Registrazione", go: () => void goService("recording") },
    { Icon: MonitorPlay, label: "Beat su misura", go: () => void goService("custom") },
    { Icon: SlidersHorizontal, label: "Mix & Master", go: () => void goService("mix") },
    { Icon: Disc3, label: "Beat Store", go: () => void enterStore() },
  ];
  return (
    <nav className={s.dock} aria-label="Servizi">
      {items.map((it, i) => (
        <button key={it.label} type="button" onClick={it.go} style={{ ["--i" as string]: i }}><it.Icon size={18} aria-hidden="true" /><span>{it.label}</span></button>
      ))}
      <button type="button" className={s.dockReel} onClick={replayReel} style={{ ["--i" as string]: 4 }} aria-label="Rivedi l’anteprima"><Clapperboard size={18} aria-hidden="true" /><span>Anteprima</span></button>
    </nav>
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
