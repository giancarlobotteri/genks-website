/* eslint-disable */
/* Renders the site's opening camera move as a video, frame by frame, on this computer's GPU.
 * One continuous take: microphone in the dark → services showroom → the studio lights up → DAW →
 * console → mixer display. Frames are rendered in virtual time (exactly 1/fps apart), so the move is
 * perfectly smooth whatever the speed of the machine. Used as the driving video for Higgsfield Genjutsu.
 *
 * Usage:  node scripts/render-intro.cjs [url] [width] [height] [fps] [seconds] [outDir]
 * Default: https://genks-cinematic.vercel.app 3840 2160 24 14 ./intro-render
 * Needs:   npm i -D playwright && npx playwright install chromium   (and ffmpeg on PATH for the .mp4)
 */
const { chromium } = require("playwright");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const [, , URL = "https://genks-cinematic.vercel.app/", W = "3840", H = "2160", FPS_ = "24", DUR_ = "14", OUT = "intro-render"] = process.argv;
const FPS = Number(FPS_), DUR = Number(DUR_), width = Number(W), height = Number(H);
// stop → time (s): mic 0, showroom 1, studio 2, DAW 3, Mix 4, Mix & Master 6, display 7
const keys = [[0, 0], [2.2, 1], [4.6, 2], [6.6, 3], [8.6, 4], [11.4, 6], [14, 7]].map(([t, p]) => [(t * DUR) / 14, p]);
const posAt = t => {
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, p0] = keys[i], [t1, p1] = keys[i + 1];
    if (t <= t1) { const u = (t - t0) / (t1 - t0); const e = 0.5 - 0.5 * Math.cos(Math.PI * u); return p0 + (p1 - p0) * (0.35 * u + 0.65 * e); }
  }
  return 7;
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  // a real window: the browser uses this computer's GPU (headless modes may fall back to software rendering)
  const browser = await chromium.launch({ headless: false, args: ["--ignore-gpu-blocklist", "--enable-gpu-rasterization", "--force-device-scale-factor=1"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.addInitScript(() => {
    sessionStorage.setItem("genks:vs:reel", "1");
    const raf = window.requestAnimationFrame.bind(window);
    window.__vt = null;
    window.requestAnimationFrame = cb => raf(t => cb(window.__vt ?? t));
  });
  await page.goto(URL + (URL.includes("?") ? "&" : "?") + "quality=high", { waitUntil: "load" });
  const gpu = await page.evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl2");
    const ext = gl && gl.getExtension("WEBGL_debug_renderer_info");
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "unknown";
  });
  console.log("GPU:", gpu);
  if (/swiftshader|llvmpipe|software/i.test(gpu)) console.warn("WARNING: software rendering, the GPU is not in use");
  await page.getByRole("button", { name: "Esplora lo studio liberamente" }).click();
  await page.waitForFunction(() => window.__vs && window.__vs.screen() === "studio");
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(8000); // photographic textures and models finish loading
  await page.addStyleTag({ content: "body *{visibility:hidden!important} canvas{visibility:visible!important}" });
  const t0 = await page.evaluate(() => performance.now());
  const total = Math.round(FPS * DUR);
  for (let f = 0; f < total; f++) {
    await page.evaluate(([x, t]) => { window.__vt = t; window.__vs.go(x); }, [posAt(f / FPS), t0 + (f * 1000) / FPS]);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
    await page.screenshot({ path: path.join(OUT, `f${String(f).padStart(5, "0")}.png`), timeout: 120000 });
    if (f % 24 === 0) console.log(`frame ${f + 1}/${total}`);
  }
  await browser.close();
  try {
    execSync(`ffmpeg -y -loglevel error -framerate ${FPS} -i "${path.join(OUT, "f%05d.png")}" -c:v libx264 -preset slow -crf 12 -pix_fmt yuv420p "${path.join(OUT, "genks-intro-drive.mp4")}"`, { stdio: "inherit" });
    console.log("Video:", path.join(OUT, "genks-intro-drive.mp4"));
  } catch {
    console.log("Frames saved in", OUT, "(ffmpeg not found: the .mp4 was not created)");
  }
})();
