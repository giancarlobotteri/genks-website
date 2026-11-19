/* eslint-disable */
/* Checks of the recording calendar against the REAL studio calendar, read only.
 * Usage: npm run build && npm run preview (proxy to the backend), then:
 *   node scripts/calendar-check.cjs [url] [screenshotDir]
 * Only GET /api/availability is called on the backend. Nothing is ever sent: /api/request is blocked.
 * Cases that real data cannot show without creating bookings (a booked range, an API failure, a full
 * calendar) take the real answer and change it in the browser; they are marked "simulato".
 */
const { chromium, devices } = require("playwright");
const fs = require("fs");
const url = process.argv[2] || "http://127.0.0.1:4173/";
const shots = process.argv[3];
const GL = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
const results = [];
const ok = (name, cond, extra = "") => { results.push({ name, pass: Boolean(cond) }); console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`); };
const snap = async (page, name) => { await page.mouse.move(2, 2).catch(() => {}); await page.waitForTimeout(900); if (shots) { fs.mkdirSync(shots, { recursive: true }); await page.screenshot({ path: `${shots}/${name}.png` }); } };
const romeToday = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const addDays = (d, k) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + k); return x.toISOString().slice(0, 10); };
const wd = d => new Date(`${d}T12:00:00Z`).getUTCDay();
const nextWeekday = (from, w) => { let d = addDays(from, 1); while (wd(d) !== w) d = addDays(d, 1); return d; };
const dayLabel = d => new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));

async function openCalendar(browser, ctxOptions, setup) {
  const ctx = await browser.newContext(ctxOptions);
  await ctx.addInitScript(() => { sessionStorage.setItem("genks:vs:reel", "1"); });
  let sentRequests = 0;
  await ctx.route("**/api/request", r => { sentRequests++; r.abort(); }); // never send anything
  const backend = [];
  ctx.on("request", r => { if (r.url().includes("/api/availability")) backend.push(r.method()); });
  if (setup) await setup(ctx);
  const page = await ctx.newPage();
  await page.goto(url);
  await page.waitForFunction(() => window.__vs && window.__vs.screen() === "studio", null, { timeout: 30000 }).catch(() => {});
  const nav = page.getByRole("navigation", { name: "Servizi" }).getByRole("button", { name: "Registrazione" });
  ctxOptions.hasTouch ? await nav.tap() : await nav.click();
  const rec = page.getByRole("region", { name: "Prenota una sessione" });
  await rec.waitFor();
  await page.waitForTimeout(1200);
  return { ctx, page, rec, sent: () => sentRequests, backend };
}
const when = rec => rec.locator('[data-step="when"]');
const days = rec => when(rec).getByRole("radiogroup", { name: "Giorno" });
const freeTimes = async rec => (await when(rec).locator('button[role="radio"][data-state="free"]').allInnerTexts()).map(x => x.trim());
const waitCal = async page => { await page.waitForTimeout(400); await page.waitForFunction(() => !document.querySelector('[data-step="when"] [aria-busy]'), null, { timeout: 20000 }); };
const pickDay = async (rec, d) => days(rec).getByRole("radio", { name: new RegExp(dayLabel(d)) }).click();
const plus = rec => when(rec).getByRole("button", { name: "Mezz’ora in più" }).click();
const minus = rec => when(rec).getByRole("button", { name: "Mezz’ora in meno" }).click();
const picked = rec => when(rec).locator("p[role=status]").filter({ hasText: "ora italiana" }).innerText().catch(() => "");

(async () => {
  const browser = await chromium.launch({ args: GL });
  const today = romeToday();
  const thu = [4].includes(wd(today)) ? today : nextWeekday(today, 4);
  const fri = nextWeekday(addDays(thu, -1), 5), sat = addDays(fri, 1), sun = addDays(fri, 2);

  /* ---------- Desktop, real data ---------- */
  let s = await openCalendar(browser, { viewport: { width: 1280, height: 800 } });
  let { page, rec } = s;
  await rec.locator("fieldset").getByText("Sessione 1 ora").click();
  await rec.locator("[data-wz-next]").click();
  await rec.getByText("Scegli giorno e orario").waitFor();
  await waitCal(page);
  ok("reale: 14 giorni dal calendario dello studio", (await days(rec).getByRole("radio").count()) === 14);
  ok("reale: si legge solo con GET", s.backend.length > 0 && s.backend.every(m => m === "GET"), s.backend.join(","));
  await pickDay(rec, thu);
  let t = await freeTimes(rec);
  ok("reale 1 ora: giovedì sera 19:30–23:00", t.includes("19:30") && t.includes("23:00") && !t.includes("23:30"), t.join(" "));
  await when(rec).getByRole("radio", { name: /^22:30/ }).click();
  ok("reale 1 ora: appuntamento in ora italiana", /22:30 → .*23:30 · ora italiana/.test(await picked(rec)), await picked(rec));
  await snap(page, "cal-01-desktop-1h");
  await plus(rec); await waitCal(page);
  ok("mezz'ora: 1 h 30 min, 22:30 resta valido (finisce alle 24:00)", (await when(rec).locator("output").innerText()).includes("1 ora 30 min") && /22:30 → .*00:00/.test(await picked(rec)), await picked(rec));
  await plus(rec); await page.waitForTimeout(150);
  ok("cambio durata: 2 ore alle 22:30 non entra, la scelta si cancella", !(await picked(rec)) && await when(rec).getByText(/Alle 22:30 non ci sono 2 ore libere/).isVisible());
  await waitCal(page);
  await snap(page, "cal-02-desktop-duration-change");
  for (let k = 0; k < 5; k++) await plus(rec);
  await waitCal(page);
  t = await freeTimes(rec);
  ok("più ore: 4 ore 30 min il giovedì solo alle 19:30", (await when(rec).locator("output").innerText()).includes("4 ore 30 min") && t.join() === "19:30", t.join(" "));
  await snap(page, "cal-03-desktop-4h30");
  await minus(rec); await minus(rec); await minus(rec); // 3 h
  await pickDay(rec, fri); await page.waitForTimeout(200);
  t = await freeTimes(rec);
  ok("venerdì oltre mezzanotte: 3 ore anche alle 23:30", t.includes("23:30"), t.join(" "));
  await when(rec).getByRole("radio", { name: /^23:30/ }).click();
  ok("venerdì 23:30 per 3 ore finisce sabato alle 02:30", /ven .*23:30 → sab .*02:30/.test(await picked(rec)), await picked(rec));
  await snap(page, "cal-04-desktop-friday-night");
  await when(rec).getByRole("button", { name: /Continua dopo mezzanotte/ }).click();
  await page.waitForTimeout(200);
  ok("notte tra venerdì e sabato: gruppo dopo mezzanotte", await when(rec).getByText(/Notte tra ven e sab/).isVisible());
  t = await freeTimes(rec);
  ok("notte ven→sab: nessun limite alle 5:30 (anche 06:00 e 09:30)", t.includes("03:00") && t.includes("06:00") && t.includes("09:30"), t.slice(0, 22).join(" "));
  await when(rec).getByRole("radio", { name: /^06:00/ }).click();
  ok("sabato 06:00 per 3 ore", /sab .*06:00 → sab .*09:00/.test(await picked(rec)), await picked(rec));
  await snap(page, "cal-05-desktop-saturday-0600");
  await pickDay(rec, sun); await page.waitForTimeout(200);
  t = await freeTimes(rec);
  ok("notte tra sabato e domenica: dalle 00:00", await when(rec).getByText(/Notte tra sab e dom/).isVisible() && t.includes("00:00") && t.includes("04:00"), t.slice(0, 8).join(" "));
  await snap(page, "cal-06-desktop-saturday-night");
  ok("nessuna richiesta inviata", s.sent() === 0);
  await s.ctx.close();

  /* ---------- Simulated: a booked range on Friday 21:00–22:00 (no real booking is created) ---------- */
  s = await openCalendar(browser, { viewport: { width: 1280, height: 800 } }, ctx => ctx.route("**/api/availability**", async route => {
    const res = await route.fetch(); const body = await res.json();
    const toMin = x => +x.slice(0, 2) * 60 + +x.slice(3, 5);
    for (const d of body.days || []) if (d.date === fri) for (const [slot, durs] of Object.entries(d.durationsBySlot)) {
      const m = toMin(slot);
      if (m >= 21 * 60 && m < 22 * 60) delete d.durationsBySlot[slot];
      else if (m < 21 * 60) d.durationsBySlot[slot] = durs.filter(h => m + h * 60 <= 21 * 60);
    }
    route.fulfill({ response: res, json: body });
  }));
  ({ page, rec } = s);
  await rec.locator("[data-wz-next]").click(); await waitCal(page); // 2 ore
  await pickDay(rec, fri); await page.waitForTimeout(200);
  const st = async x => when(rec).getByRole("radio", { name: new RegExp("^" + x) }).getAttribute("data-state");
  ok("simulato · intervallo occupato: 21:00 e 21:30 occupati", (await st("21:00")) === "busy" && (await st("21:30")) === "busy");
  ok("simulato · 2 ore alle 19:30 non bastano prima delle 21:00", (await st("19:30")) === "short" && (await st("22:00")) === "free");
  await snap(page, "cal-07-simulated-busy");
  await s.ctx.close();

  /* ---------- Simulated: API errors, then the real calendar again ---------- */
  let mode = "503";
  s = await openCalendar(browser, { viewport: { width: 1280, height: 800 } }, ctx => ctx.route("**/api/availability**", route => {
    if (mode === "503") return route.fulfill({ status: 503, json: { error: "Impossibile verificare gli orari. Riprova tra poco." } });
    if (mode === "down") return route.abort("connectionrefused");
    return route.fallback();
  }));
  ({ page, rec } = s);
  await rec.locator("[data-wz-next]").click(); await waitCal(page);
  ok("simulato · errore API: messaggio, nessun giorno inventato", await when(rec).getByRole("alert").getByText("Impossibile verificare gli orari").isVisible() && (await days(rec).count()) === 0);
  await rec.locator("[data-wz-next]").click();
  ok("simulato · errore API: non si prosegue", await rec.getByText(/Il calendario non è disponibile/).isVisible());
  await snap(page, "cal-08-simulated-api-error");
  mode = "down"; await when(rec).getByRole("button", { name: "Riprova" }).click(); await waitCal(page);
  ok("simulato · server irraggiungibile: «non risponde»", await when(rec).getByText(/non risponde/).isVisible());
  mode = "real"; await when(rec).getByRole("button", { name: "Riprova" }).click();
  await days(rec).getByRole("radio").nth(13).waitFor({ timeout: 25000 }).catch(() => {});
  ok("Riprova: torna il calendario reale", (await days(rec).getByRole("radio").count()) === 14, await when(rec).getByRole("alert").innerText().catch(() => ""));
  await s.ctx.close();

  /* ---------- Simulated: no availability ---------- */
  s = await openCalendar(browser, { viewport: { width: 1280, height: 800 } }, ctx => ctx.route("**/api/availability**", async route => {
    const res = await route.fetch(); const body = await res.json();
    for (const d of body.days || []) d.durationsBySlot = {};
    route.fulfill({ response: res, json: body });
  }));
  ({ page, rec } = s);
  await rec.locator("[data-wz-next]").click(); await waitCal(page);
  ok("simulato · nessuna disponibilità: giorni «pieno» e messaggio", (await days(rec).getByRole("radio", { disabled: false }).count()) === 0 && await when(rec).getByText(/Nessun giorno con 2 ore consecutive libere/).isVisible());
  await snap(page, "cal-09-simulated-full");
  await s.ctx.close();

  /* ---------- Phone, real data ---------- */
  s = await openCalendar(browser, { ...devices["iPhone 13"] });
  ({ page, rec } = s);
  await rec.locator("fieldset").getByText("Sessione 2 ore").tap();
  await rec.locator("[data-wz-next]").tap();
  await waitCal(page);
  ok("telefono · reale: 14 giorni", (await days(rec).getByRole("radio").count()) === 14);
  await days(rec).getByRole("radio", { name: new RegExp(dayLabel(fri)) }).tap(); await page.waitForTimeout(200);
  await when(rec).getByRole("radio", { name: /^23:00/ }).tap();
  ok("telefono · venerdì 23:00 per 2 ore → sabato 01:00", /23:00 → sab .*01:00/.test(await picked(rec)), await picked(rec));
  ok("telefono · nessuno scroll orizzontale", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await when(rec).getByRole("radio", { name: /^23:00/ }).scrollIntoViewIfNeeded();
  await snap(page, "cal-10-phone-friday");
  await when(rec).getByRole("button", { name: "Mezz’ora in più" }).tap(); await waitCal(page);
  ok("telefono · 2 ore 30 min: 23:00 resta valido il venerdì", /23:00 → sab .*01:30/.test(await picked(rec)), await picked(rec));
  await days(rec).getByRole("radio", { name: new RegExp(dayLabel(thu)) }).tap(); await page.waitForTimeout(200);
  const pt = await freeTimes(rec);
  ok("telefono · giovedì 2 ore 30 min: ultimo inizio 21:30", pt.at(-1) === "21:30", pt.join(" "));
  await days(rec).scrollIntoViewIfNeeded();
  await snap(page, "cal-11-phone-thursday");
  ok("telefono · nessuna richiesta inviata", s.sent() === 0);
  await s.ctx.close();

  await browser.close();
  const failed = results.filter(r => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} controlli superati`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
