/* eslint-disable */
/* Renders the site's opening camera move as a video, frame by frame. One continuous take:
 * microphone in the dark → services showroom → the studio lights up → DAW → console → mixer display.
 *
 * The page's animation loop is stepped by this script in virtual time (exactly 1/fps per frame): every
 * kept frame is rendered once, at full quality (the adaptive quality never sees a slow frame), and the
 * move is perfectly smooth on any machine, fast GPU or software rendering. The 3D canvas is captured
 * directly (no page text). Used as the driving video for Higgsfield Genjutsu.
 *
 * Usage:  node scripts/render-intro.cjs [url] [width] [height] [fps] [seconds] [outDir] [--cpu] [--from=N] [--to=N]
 * Default: https://genks-cinematic.vercel.app/ 1920 1080 24 13 ./intro-render
 *   --cpu          no GPU here: software WebGL (the same picture, only slower)
 *   --from --to    render only frames [from, to), e.g. to resume an interrupted render
 * Needs:   npm i -D playwright && npx playwright install chromium   (and ffmpeg on PATH for the .mp4)
 */
const { chromium } = require("playwright");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const opt = Object.fromEntries(args.filter(a => a.startsWith("--")).map(a => { const [k, v] = a.slice(2).split("="); return [k, v ?? "1"]; }));
const [URL = "https://genks-cinematic.vercel.app/", W = "1920", H = "1080", FPS_ = "24", DUR_ = "13", OUT = "intro-render"] = args.filter(a => !a.startsWith("--"));
const FPS = Number(FPS_), DUR = Number(DUR_), width = Number(W), height = Number(H);
const total = Math.round(FPS * DUR);
const FROM = Math.max(0, Number(opt.from ?? 0)), TO = Math.min(total, Number(opt.to ?? total));
const STEP = 1000 / FPS;

// Choreography on a 13 s base, like a product film: a slow, close hold on each subject, then a faster
// move to the next one (speed ramps), never a stop. Stops: mic 0, showroom 1, studio 2 (the lights come
// up on the way), DAW 3, console Mix 4 → Master 5 → Mix & Master 6, mixer display 7.
const keys = [[0, 0], [1.9, 0.22], [3.0, 0.92], [4.4, 1.12], [5.4, 1.9], [6.4, 2.08], [7.3, 2.9], [8.3, 3.08], [9.2, 3.9], [10.4, 4.5], [11.5, 6.4], [13, 7]]
  .map(([t, p]) => [(t * DUR) / 13, p]);
// monotone cubic (Fritsch–Carlson) through the keys: the camera never stops and never jerks between stops
const slope = (() => {
  const n = keys.length, d = [], m = [];
  for (let i = 0; i < n - 1; i++) d.push((keys[i + 1][1] - keys[i][1]) / (keys[i + 1][0] - keys[i][0]));
  m[0] = d[0] * 0.5; m[n - 1] = d[n - 2] * 0.5; // gentle start, gentle landing
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (3 * (d[i - 1] + d[i])) / ((2 * d[i] + d[i - 1]) / d[i - 1] + (d[i] + 2 * d[i - 1]) / d[i]);
  return m;
})();
const posAt = t => {
  if (t <= 0) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, p0] = keys[i], [t1, p1] = keys[i + 1];
    if (t <= t1) {
      const h = t1 - t0, u = (t - t0) / h, u2 = u * u, u3 = u2 * u;
      return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * h * slope[i] + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * h * slope[i + 1];
    }
  }
  return keys[keys.length - 1][1];
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const soft = opt.cpu ? ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : [];
  // a real window on a GPU machine (some headless modes fall back to software rendering)
  const browser = await chromium.launch({ headless: Boolean(opt.cpu), args: ["--ignore-gpu-blocklist", "--enable-gpu-rasterization", "--force-device-scale-factor=1", ...soft] });
  // set-up at a smaller size (desktop layout, same 16:9 shape); the real size only for the frames that count
  const page = await browser.newPage({ viewport: { width: 1024, height: Math.round((1024 * height) / width) } });
  page.on("pageerror", e => console.error("page error:", e.message));
  await page.addInitScript(() => {
    sessionStorage.setItem("genks:vs:reel", "1");
    // the page's animation loop advances only when this script steps it
    const queue = new Map();
    let id = 0, vt = -1;
    window.requestAnimationFrame = cb => { queue.set(++id, cb); return id; };
    window.cancelAnimationFrame = h => { queue.delete(h); };
    window.__step = ms => {
      vt = vt < 0 ? performance.now() : vt + ms;
      const run = [...queue.values()];
      queue.clear();
      for (const cb of run) cb(vt);
    };
    window.__grab = () => {
      const c = [...document.querySelectorAll("canvas")].sort((a, b) => b.width * b.height - a.width * a.height)[0];
      return { w: c.width, h: c.height, png: c.toDataURL("image/png") };
    };
  });
  await page.goto(URL + (URL.includes("?") ? "&" : "?") + "quality=high&film", { waitUntil: "load" });
  const gpu = await page.evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl2");
    const ext = gl && gl.getExtension("WEBGL_debug_renderer_info");
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "unknown";
  });
  console.log("GPU:", gpu);
  if (!opt.cpu && /swiftshader|llvmpipe|software/i.test(gpu)) console.warn("WARNING: software rendering, the GPU is not in use");

  const step = (n, ms) => page.evaluate(([n, ms]) => { for (let i = 0; i < n; i++) window.__step(ms); }, [n, ms]);
  // the opening preview (already seen): its first frames are lit, then into the studio
  await step(8, 250);
  const btn = page.getByRole("button", { name: "Esplora lo studio liberamente" });
  for (let i = 0; i < 40 && !(await btn.isVisible().catch(() => false)); i++) await step(1, 250);
  await btn.evaluate(el => el.click());
  for (let i = 0; i < 40 && (await page.evaluate(() => window.__vs.screen())) !== "studio"; i++) await step(1, 250);
  const pre = Math.max(0, FROM - Math.round(FPS * 1.5));
  await page.evaluate(x => window.__vs.go(x), posAt(pre / FPS));
  await step(16, 250); // the camera arrives from the preview, the lights settle on the first shot

  await page.setViewportSize({ width, height });
  for (let i = 0; i < 100; i++) {
    const cw = await page.evaluate(() => window.__grab().w);
    if (cw === width) break;
    await page.waitForTimeout(100);
  }
  // a short run-up at the final size, so the frame offsets and lighting are exactly where they would be
  for (let f = pre - 12; f < FROM; f++) { await page.evaluate(x => window.__vs.go(x), posAt(Math.max(0, f) / FPS)); await step(1, STEP); }

  const t0 = Date.now();
  for (let f = FROM; f < TO; f++) {
    const shot = await page.evaluate(([x, ms]) => { window.__vs.go(x); window.__step(ms); return window.__grab(); }, [posAt(f / FPS), STEP]);
    if (shot.w !== width || shot.h !== height) throw new Error(`canvas is ${shot.w}x${shot.h}, expected ${width}x${height}`);
    fs.writeFileSync(path.join(OUT, `f${String(f).padStart(5, "0")}.png`), Buffer.from(shot.png.slice(shot.png.indexOf(",") + 1), "base64"));
    const done = f - FROM + 1, per = (Date.now() - t0) / 1000 / done;
    if (done === 1 || f % 12 === 0 || f === TO - 1) console.log(`frame ${f + 1}/${total}  ${per.toFixed(1)} s/frame  ETA ${((TO - f - 1) * per / 60).toFixed(0)} min`);
  }
  await browser.close();

  const all = Array.from({ length: total }, (_, f) => path.join(OUT, `f${String(f).padStart(5, "0")}.png`)).every(p => fs.existsSync(p));
  if (!all) { console.log("Frames saved in", OUT, "(not all frames yet: the .mp4 is made when the last one is rendered)"); return; }
  try {
    execSync(`ffmpeg -y -loglevel error -framerate ${FPS} -i "${path.join(OUT, "f%05d.png")}" -c:v libx264 -preset slow -crf 12 -pix_fmt yuv420p -movflags +faststart "${path.join(OUT, "genks-intro-drive.mp4")}"`, { stdio: "inherit" });
    console.log("Video:", path.join(OUT, "genks-intro-drive.mp4"));
  } catch {
    console.log("Frames saved in", OUT, "(ffmpeg not found: the .mp4 was not created)");
  }
})();
