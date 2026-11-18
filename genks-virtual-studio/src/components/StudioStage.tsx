import { Disc3, Mic, MonitorPlay, Mouse, Hand, SlidersHorizontal, Upload, Check, Clapperboard } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { formatEuro } from "../lib/catalog.ts";
import { getDirector, useDirector } from "../lib/director.ts";
import { musicLevel } from "../lib/level.ts";
import { enterStore, goService, replayReel } from "../lib/nav.ts";
import { FILM, SHOT_T, SPOTS, STOP_T, filmTimeAt, frameToScreen, isReelFilm, panAt, panAtPos, pickFilm, setFilmVideo } from "../lib/film-media.ts";
import { createLivingPlate } from "../scene/living-plate.ts";
import { getDive, getSubShot, setSubShot } from "../lib/shots.ts";
import { goToStop, installStepper, isMoving, overshoot, stopPos, tickStepper } from "../lib/stepper.ts";
import { arcFor, drift, durFor, orbitPose, SHOTS } from "../scene/shot-table.ts";
import { buildStudio, type ConsoleMode, type HitId, type Quality } from "../scene/build-studio.ts";
import { createCinemaFx, type CinemaFx } from "../scene/cinema-fx.ts";
import { buildStoreEnv, type StoreEnv } from "../scene/store-env.ts";
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
  const calloutRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const railRef = useRef<HTMLOListElement>(null);
  // the photographic studio: the film's frames (lib/film-media), with the live 3D underneath as fallback
  const plateRef = useRef<HTMLVideoElement>(null);
  const vaultRef = useRef<HTMLDivElement>(null);
  const cutRef = useRef<HTMLDivElement>(null);
  // the pointer on a hotspot or a service caption also puts that object in the spotlight
  const domHover = useRef<string | null>(null);
  const [plateSrc] = useState(() => pickFilm({ motion: false }));
  const live = useRef({ base: null as string | null, framed: false });
  const [ready, setReady] = useState(false);
  // bumped when the phone gives the WebGL context back after a memory-pressure loss: the scene is rebuilt
  const [glGen, setGlGen] = useState(0);
  const services = content.mix;
  const minPrice = (xs: { price: number | null }[]) => xs.reduce<number | null>((m, p) => (p.price == null ? m : m == null ? p.price : Math.min(m, p.price)), null);
  const fromRec = minPrice(content.recording), fromMix = minPrice(content.mix);
  const lineupItems = [
    { id: "recording", title: "Registrazione", meta: fromRec != null ? `da ${formatEuro(fromRec)}` : "su richiesta", go: () => void goService("recording") },
    { id: "custom", title: "Beat su misura", meta: content.customBeat.priceFrom != null ? `da ${formatEuro(content.customBeat.priceFrom)}` : "su preventivo", go: () => void goService("custom") },
    { id: "mix", title: "Mix & Master", meta: fromMix != null ? `da ${formatEuro(fromMix)}` : "su preventivo", go: () => void goService("mix") },
    { id: "store", title: "Beat Store", meta: `${content.beats.filter(b => b.status === "published").length} beat pronti`, go: () => void enterStore() },
  ];

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
    else if (id === "mixer" || id === "svc:mix") void goService("mix");
    else if (id === "svc:recording") void goService("recording");
    else if (id === "svc:custom") void goService("custom");
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
    // the Beat Store screen lets the 3D record vault show through (see styles: html[data-gl])
    document.documentElement.dataset.gl = "1";
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
    // mouse, finger and the tilt of the phone all move the camera (and the light); idle, it drifts by itself
    let lastInput = -1e9, touchLight = 0;
    const onMove = (e: PointerEvent) => {
      mouseOn = e.pointerType === "mouse";
      pointer.x = e.clientX / window.innerWidth - 0.5; pointer.y = e.clientY / window.innerHeight - 0.5;
      lastInput = performance.now();
      if (e.pointerType !== "mouse") touchLight = 1;
    };
    let tilt0: [number, number] | null = null;
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      if (!tilt0) tilt0 = [e.gamma, e.beta];
      pointer.x = Math.max(-0.5, Math.min(0.5, (e.gamma - tilt0[0]) / 40));
      pointer.y = Math.max(-0.5, Math.min(0.5, (e.beta - tilt0[1]) / 40));
      lastInput = performance.now();
    };
    window.addEventListener("deviceorientation", onTilt, { passive: true });
    // iPhone asks once, on the first touch
    const askTilt = () => {
      const D = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> } | undefined;
      if (D?.requestPermission) D.requestPermission().catch(() => {});
      window.removeEventListener("touchend", askTilt);
    };
    window.addEventListener("touchend", askTilt, { passive: true });
    window.addEventListener("pointermove", onMove, { passive: true });

    // The objects of the studio are clickable themselves: hover lights them up, a click opens their service.
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), sph = new THREE.Sphere();
    let hoverId: HitId | null = null, canHit = false, curPos = 0;
    const LINE_IDS: HitId[] = ["svc:recording", "svc:custom", "svc:mix", "svc:store"];
    const hitAt = (cx: number, cy: number): HitId | null => {
      if (!canHit) return null;
      if (photo) {
        // the objects of the footage: a circle around each one, only at its own stop
        const r = canvas.getBoundingClientRect(), x = cx - r.left, y = cy - r.top;
        const cand: [HitId, { x: number; y: number; r: number }][] = curPos < 0.5 ? [["mic", SPOTS.mic]]
          : curPos > 0.5 && curPos < 1.5 ? LINE_IDS.map((id, i) => [id, { ...SPOTS.lineupObj[i], r: 0.075 }] as [HitId, { x: number; y: number; r: number }])
          : curPos > 2.5 && curPos < 3.5 ? [["screen", SPOTS.screen]] : curPos > 3.5 && curPos < 6.5 ? [["mixer", SPOTS.mixer]] : [];
        for (const [id, c] of cand) { const q = spot(c.x, c.y); if (Math.hypot(x - q.x, y - q.y) < c.r * q.unit) return id; }
        return null;
      }
      const r = canvas.getBoundingClientRect();
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      let best: HitId | null = null, bestD = Infinity;
      for (const hz of rig.hits) {
        // only what the current shot is about
        const allowed = hz.id === "mic" ? curPos < 0.5 : hz.id.startsWith("svc:") ? curPos > 0.5 && curPos < 1.5 : hz.id === "screen" ? curPos > 2.5 && curPos < 3.5 : curPos > 3.5 && curPos < 6.5;
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

    let fx = 0, fy = 0, last = -1;
    let first = true, frames = 0;
    // adaptive quality aims at the display's own refresh rate (60, 90, 120 Hz…)
    let refresh = 1 / 60, minDt = 1, sum = 0, n = 0, degrade = 0;
    let activeSvc = -2, hintState = "";
    let storeEnv: StoreEnv | null = null, storeVisit = -1, storeSkip = false;
    const tmp = new THREE.Vector3(), off = new THREE.Vector3(), focusV = new THREE.Vector3();
    // light direction values, eased so a change of screen never pops
    const look = { reveal: 0, hero: 0, title: 0 };

    // ---- the photographic studio: the film's own frames, scrubbed by the tour ----
    const plate = plateRef.current, vault = vaultRef.current, stageEl = canvas.parentElement!;
    const living = plate ? createLivingPlate(renderer, plate, { color: FILM.vault, depth: FILM.vaultDepth }, quality === "high") : null;
    let hoverAmt = 0, hoverAt: [number, number] = [0.5, 0.5], lightAmt = 0;
    // the focus pull: on the object under the pointer (or wherever a mouse points), eased like a camera
    const focus = { x: 0.5, y: 0.5, frame: false, r: 0.12, a: 0 };
    let mouseOn = false;
    const LINE_SPOTS = ["svc:recording", "svc:custom", "svc:mix", "svc:store"];
    /** camera parallax, light and hover for the living photograph, from the pointer */
    const lifeInputs = (now: number, dt: number) => {
      const t = now / 1000;
      const idle = now - lastInput > 2600 && !reduced;
      if (idle) { pointer.x = Math.sin(t * 0.31) * 0.22; pointer.y = Math.cos(t * 0.23) * 0.14; }
      const k = 1 - Math.exp(-dt * (idle ? 1.2 : 5));
      sp.x += (pointer.x - sp.x) * k; sp.y += (pointer.y - sp.y) * k;
      const wantLight = reduced ? 0.35 : idle ? 0.55 : 1;
      lightAmt += (wantLight - lightAmt) * (1 - Math.exp(-dt * 3));
      if (touchLight > 0) touchLight = Math.max(0, touchLight - dt * 0.4);
      const hid = (hoverId as string | null) ?? domHover.current;
      const at = hid == null ? null : hid.startsWith("svc:") ? SPOTS.lineupObj[LINE_SPOTS.indexOf(hid)] : (SPOTS as unknown as Record<string, { x: number; y: number }>)[hid];
      if (at) hoverAt = [at.x, at.y];
      hoverAmt += ((at ? 1 : 0) - hoverAmt) * (1 - Math.exp(-dt * 8));
      const par: [number, number] = reduced ? [0, 0] : [-sp.x * 0.11, -sp.y * 0.07];
      // focus: a known object (hotspot / service) when hovered, otherwise whatever the mouse is on
      const fk = 1 - Math.exp(-dt * 7);
      const pointing = mouseOn && !idle;
      const wantA = at ? 1 : pointing ? 0.5 : 0;
      if (at) {
        if (!focus.frame) { focus.frame = true; focus.x = at.x; focus.y = at.y; }
        focus.x += (at.x - focus.x) * fk; focus.y += (at.y - focus.y) * fk; focus.r += (0.17 - focus.r) * fk;
      } else if (pointing) {
        if (focus.frame) { focus.frame = false; focus.x = pointer.x + 0.5; focus.y = pointer.y + 0.5; }
        focus.x += (pointer.x + 0.5 - focus.x) * fk * 1.6; focus.y += (pointer.y + 0.5 - focus.y) * fk * 1.6; focus.r += (0.11 - focus.r) * fk;
      }
      focus.a += (wantA - focus.a) * fk;
      const light: [number, number, number] = [sp.x + 0.5, sp.y + 0.5, lightAmt];
      return { par, light, mouse: [pointer.x + 0.5, pointer.y + 0.5] as [number, number], time: t, focus: { ...focus } };
    };
    let photo = false, plateT = -1, plateK = 1, plateTx = 0, plateTy = 0, plateOx = 0.5;
    // a change of screen far away in the footage is a cut (a quick dip through the dark), not a rewind
    let cutT0 = -1, cutTo = 0, cutDone = false, blurNow = 0;
    const cutEl = cutRef.current;
    const onPlateReady = () => { if (!photo) { photo = true; stageEl.dataset.photo = "1"; } };
    const onPlateFail = () => { photo = false; delete stageEl.dataset.photo; };
    plate?.addEventListener("loadeddata", onPlateReady);
    plate?.addEventListener("error", onPlateFail);
    if (plate && plate.readyState >= 2) onPlateReady();
    const spot = (nx: number, ny: number) => frameToScreen(nx, ny, w, h, plateOx, plateK, plateTx, plateTy);
    const paintPlate = (now: number, dt: number, screenNow: string, reelShot: string | null, pos: number, dv: number) => {
      if (!plate) return;
      const t = now / 1000;
      const base = live.current.base, sub = getSubShot();
      const playing = screenNow === "reel" && isReelFilm();
      let want = playing ? plate.currentTime : screenNow === "reel" ? (SHOT_T[reelShot ?? ""] ?? 5.8) : base ? (SHOT_T[sub ?? base] ?? SHOT_T[base] ?? filmTimeAt(pos)) : filmTimeAt(pos);
      // the dive into the mixer display (towards the Beat Store)
      if (dv > 0) want += (STOP_T[STOP_T.length - 1] - want) * ease(dv);
      // the tour is already smooth; a change of screen glides through the footage like a camera move
      const touringNow = screenNow === "studio" && !base;
      const prevT = plateT;
      if (playing) { plateT = want; cutT0 = -1; if (cutEl) cutEl.style.opacity = "0"; }
      else if (plateT >= 0 && cutT0 < 0 && !touringNow && dv === 0 && Math.abs(want - plateT) > 1.6) { cutT0 = now; cutTo = want; cutDone = false; }
      if (cutT0 >= 0) {
        const u = (now - cutT0) / 1000;
        if (u >= 0.26 && !cutDone) { cutDone = true; plateT = cutTo; }
        if (cutDone) plateT += (want - plateT) * (1 - Math.exp(-dt * 3.2));
        if (cutEl) cutEl.style.opacity = (u < 0.26 ? u / 0.26 : Math.max(0, 1 - (u - 0.26) / 0.5)).toFixed(3);
        if (u > 0.8) { cutT0 = -1; if (cutEl) cutEl.style.opacity = "0"; }
      } else {
        const kk = touringNow ? 1 - Math.exp(-dt * 14) : 1 - Math.exp(-dt * 3.2);
        plateT = plateT < 0 ? want : plateT + (want - plateT) * kk;
      }
      if (!playing && Math.abs(plate.currentTime - plateT) > 0.03 && !plate.seeking) plate.currentTime = Math.max(0, Math.min((plate.duration || 13) - 0.05, plateT));
      void prevT; void blurNow;
      // a camera that breathes, the framing of the screen, and the push into the display
      const breathe = reduced ? 0 : Math.sin(t * 0.13) * 0.012;
      plateK = (playing ? 1.04 : 1.06) + breathe + (base ? 0.08 : 0) + ease(dv) * 1.4;
      const slack = (plateK - 1) / 2;
      plateTx = playing ? 0 : Math.max(-slack, Math.min(slack, -fx)) * w + (reduced ? 0 : Math.sin(t * 0.07) * 0.006 * w);
      plateTy = playing ? 0 : Math.max(-slack, Math.min(slack, -fy)) * h;
      plateOx = portrait ? (playing ? panAt(plateT) / 100 : panAtPos(pos)) : 0.5;
      const io = lifeInputs(now, dt);
      // the camera leans in towards the object under the pointer
      if (hoverAmt > 0.01 && !playing) {
        const q = spot(hoverAt[0], hoverAt[1]);
        const e = ease(Math.min(1, hoverAmt));
        plateK += 0.08 * e;
        plateTx += (w / 2 - q.x) * 0.22 * e;
        plateTy += (h / 2 - q.y) * 0.18 * e;
      }
      living?.render({ focus: io.focus, source: "film", w, h, ox: plateOx, k: plateK, tx: plateTx, ty: plateTy, par: io.par, light: io.light, hover: hoverAmt > 0.01 ? [hoverAt[0], hoverAt[1], hoverAmt] : null, mouse: io.mouse, time: io.time, dust: 1 });
    };
    // the Beat Store's own place: the photographic record vault, moving with the catalogue
    const paintVault = (now: number, dt: number, page: number, bundles: boolean) => {
      void vault;
      const t = now / 1000, pg = Math.min(page, 6);
      const k = 1.08 + (reduced ? 0 : 0.025 * Math.sin(t * 0.07)) + pg * 0.03 + (bundles ? 0.06 : 0);
      const io = lifeInputs(now, dt);
      living?.render({ focus: io.focus, source: "vault", w, h, ox: 0.5, k, tx: (pg % 2 ? -16 : 16) * Math.min(1, pg), ty: bundles ? 24 : 0, par: [io.par[0] * 1.3, io.par[1] * 1.3], light: io.light, hover: null, mouse: io.mouse, time: io.time, dust: 1 });
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = last < 0 ? 1 / 60 : Math.min((now - last) / 1000, 0.25);
      last = now;
      const dir = getDirector();
      // the store covers the studio: stop rendering once its intro has taken over
      if (!running) return;
      // inside the Beat Store: its own place (the record vault), with its own camera
      if (dir.screen === "store" && getDive() >= 0.98 && !first) {
        if (photo) { paintVault(now, dt, dir.storePage, dir.storeTab === "bundles"); return; }
        if (!storeEnv) storeEnv = buildStoreEnv(quality === "high");
        if (storeVisit !== dir.storeVisit) { storeVisit = dir.storeVisit; storeEnv.enter(now); }
        storeEnv.aim(dir.storeTab, dir.storePage);
        // 30 fps is plenty for the slow vault and leaves the GPU to the catalogue
        storeSkip = !storeSkip;
        if (storeSkip && !reduced) return;
        storeEnv.tick(now, dt * 2, w, h, !reduced);
        const tm = renderer.toneMapping;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        if (camera.view) camera.clearViewOffset();
        renderer.render(storeEnv.scene, storeEnv.camera);
        renderer.toneMapping = tm;
        return;
      }
      const t = now / 1000;
      if (photo) { /* the photographic plate costs nothing to draw: nothing to adapt */ }
      else if (!first && frames < 90) { minDt = Math.min(minDt, dt); refresh = Math.max(1 / 240, minDt); }
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
      const lineBand = dir.screen === "studio" && !live.current.framed ? band(pos, 1, 1, 0.6) : 0;
      const lensWant = (pose.lens ?? 1) * (portrait ? 1 + 0.04 * lineBand : 1);
      if (Math.abs(lensWant - lensNow) > 1e-4) applyFov(lensWant);

      // always alive: a slow orbit + breathing dolly around the subject, wider inside a service
      const inShot = shotId != null;
      const amp = reduced ? 0 : inShot ? 1 : 0.55;
      const k = 1 - Math.exp(-dt * 4);
      sp.x += (pointer.x - sp.x) * k; sp.y += (pointer.y - sp.y) * k;
      const yaw = (Math.sin(t * 0.19) * 0.07 + Math.sin(t * 0.07) * 0.04) * amp * (1 - dv) + sp.x * -0.12 * (reduced ? 0 : 1);
      const bob = (Math.sin(t * 0.23) * 0.02) * amp - sp.y * 0.06 * (reduced ? 0 : 1);
      // phones: the camera moves closer to the line-up so the four capsules fill the width
      const dolly = (1 + Math.sin(t * 0.13) * 0.045 * amp) * (portrait ? 1 - 0.1 * lineBand : 1);
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
      // services: text on the left (desktop) or on top (phone)
      else if (anaBand > 0) { gx = (portrait ? 0 : -Math.min(0.2, (Math.min(470, w * 0.38) + 40) / 2 / w)) * anaBand; gy = portrait ? -0.1 * anaBand : 0; }
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
        // stop 0 microphone · stop 1 the services under the spotlights (still dark) · stop 2 the studio lights up
        else if (!base) { wantReveal = clamp01(pos - 1); wantHero = 1 - clamp01(pos / 0.7); wantTitle = 1 - clamp01(pos / 0.3); }
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
      // the line-up of the services rises into its spotlights around stop 1
      rig.setLineup(dir.screen === "studio" && !base ? 1 - clamp01(Math.abs(pos - 1) / 0.8) : 0);
      curPos = pos; canHit = touringNow && dv === 0;
      rig.tick(t, !reduced, musicLevel(now), dt);
      // rack focus on the subject of the shot
      focusV.set(pose.target[0], pose.target[1], pose.target[2]);
      composer?.focus(focusV, pose.lens ?? 1);
      if (photo) paintPlate(now, dt, dir.screen, dir.reelShot, pos, dv);
      else if (composer) composer.render(dt); else renderer.render(rig.scene, camera);
      first = false;
      // Safety net: if post-processing ever outputs a fully black frame on this GPU, drop it and render directly.
      if (!photo && composer && frames === 6) {
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
        if (photo) { const q = spot(SPOTS[hs.id].x, SPOTS[hs.id].y); tmp.set((q.x / w) * 2 - 1, 1 - (q.y / h) * 2, 0); }
        else { rig.anchors[hs.anchor].getWorldPosition(tmp); tmp.project(camera); }
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
      // captions of the services: one under each capsule (they are also the keyboard-accessible buttons)
      const av = touring && dv === 0 ? band(pos, 1, 1, 0.55) : 0;
      const ana = anatomyRef.current;
      if (ana) {
        ana.style.setProperty("--av", av.toFixed(3));
        ana.style.visibility = av < 0.02 ? "hidden" : "visible";
        ana.toggleAttribute("inert", av < 0.6);
        rig.lineup.forEach((c, i) => {
          const el = calloutRefs.current[i];
          if (!el) return;
          // phones see only part of the line-up: the four captions sit in an even row above the dock
          if (photo && portrait) tmp.set(((0.13 + i * 0.247) * 2 - 1), 1 - 0.74 * 2, 0);
          else if (photo) { const q = spot(SPOTS.lineup[i].x, SPOTS.lineup[i].y); tmp.set((q.x / w) * 2 - 1, 1 - (q.y / h) * 2, 0); }
          else { c.anchor.getWorldPosition(tmp); tmp.project(camera); }
          // kept inside the screen on narrow phones
          const x = Math.min(w - 44, Math.max(44, ((tmp.x + 1) / 2) * w)), y = ((1 - tmp.y) / 2) * h;
          // the camera always breathes: the captions follow it only past 2 px, so the text stays still and easy to hit
          const lx = Number(el.dataset.x ?? -1e4), ly = Number(el.dataset.y ?? -1e4);
          if (Math.abs(x - lx) > 2 || Math.abs(y - ly) > 2) {
            el.dataset.x = String(Math.round(x)); el.dataset.y = String(Math.round(y));
            el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0) translate(-50%, 0)`;
          }
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
      delete document.documentElement.dataset.gl;
      plate?.removeEventListener("loadeddata", onPlateReady);
      living?.dispose();
      window.removeEventListener("deviceorientation", onTilt);
      window.removeEventListener("touchend", askTilt);
      plate?.removeEventListener("error", onPlateFail);
      delete stageEl.dataset.photo;
      composer?.dispose();
      storeEnv?.dispose();
      rig.dispose();
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noGl, glGen]);

  const touringUi = screen === "studio" && !panel;

  return (
    <section id="studio" className={s.stage} data-screen={screen} aria-label="Studio virtuale GENKS">
      {noGl ? <div className={s.stageNoGl} aria-hidden="true" /> : <canvas ref={canvasRef} className={s.stageCanvas} data-ready={ready || undefined} aria-hidden="true" />}
      {!noGl && plateSrc && <video ref={el => { plateRef.current = el; setFilmVideo(el); }} className={s.stagePlate} src={plateSrc} muted playsInline preload="auto" disablePictureInPicture aria-hidden="true" />}
      {!noGl && <div ref={cutRef} className={s.stageCut} aria-hidden="true" />}
      {!noGl && plateSrc && <div className={s.stageGrain} aria-hidden="true" />}
      {!noGl && (
        <div ref={vaultRef} className={s.stageVault} aria-hidden="true">
          <span className={s.vaultBeam} /><span className={s.vaultBeam} /><span className={s.vaultDust} />
        </div>
      )}
      <div className={s.stageVignette} aria-hidden="true" />
      {!noGl && HOTSPOTS.map(hs => (
        <button key={hs.id} ref={el => { hotRefs.current[hs.id] = el; }} type="button" className={s.hotspot} data-id={hs.id} onClick={() => activate(hs.id)}
          onPointerEnter={() => { domHover.current = hs.id; }} onPointerLeave={() => { domHover.current = null; }} onFocus={() => { domHover.current = hs.id; }} onBlur={() => { domHover.current = null; }} tabIndex={touringUi ? 0 : -1}>
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
        <div ref={anatomyRef} className={s.anatomy} role="region" aria-label="I servizi GENKS">
          <div className={s.anatomyText}>
            <p className={s.kicker}>I servizi GENKS</p>
            <h2>Quattro servizi,<br />sotto i riflettori.</h2>
            <p>Scegli da dove partire: ogni servizio ha la sua schermata, e puoi cambiare idea in ogni momento.</p>
          </div>
          {lineupItems.map((c, i) => (
            <button key={c.id} type="button" ref={el => { calloutRefs.current[i] = el; }} className={s.lineCap} onClick={c.go}
              onPointerEnter={() => { domHover.current = `svc:${c.id}`; }} onPointerLeave={() => { domHover.current = null; }} onFocus={() => { domHover.current = `svc:${c.id}`; }} onBlur={() => { domHover.current = null; }}>
              <strong>{c.title}</strong><small>{c.meta}</small>
            </button>
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

const STOP_LABELS = ["Microfono", "Servizi", "Studio", "Monitor DAW", "Mix", "Master", "Mix & Master", "Beat Store"];

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
