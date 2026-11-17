/* eslint-disable */
/* End-to-end smoke test of the acceptance criteria (brief §10).
 * Usage: start the app (npm run preview) then: node scripts/smoke.cjs [url] [screenshotDir]
 * Requires Playwright with Chromium (not a project dependency: `npm i -D playwright && npx playwright install chromium`).
 */
const { chromium, devices } = require("playwright");
const fs = require("fs");
const url = process.argv[2] || "http://127.0.0.1:4173/";
const shots = process.argv[3];
const GL = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
const results = [];
const ok = (name, cond, extra = "") => { results.push({ name, pass: Boolean(cond), extra }); console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`); };
const snap = async (page, name) => { if (shots) { fs.mkdirSync(shots, { recursive: true }); await page.screenshot({ path: `${shots}/${name}.png` }); } };
const fillContact = async scope => { await scope.getByLabel("Nome *", { exact: true }).fill("Mario Rossi"); await scope.getByLabel("Email *").fill("mario@example.com"); };

(async () => {
  const browser = await chromium.launch({ args: GL });
  const errors = [];

  /* ---------- Desktop ---------- */
  let ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  let page = await ctx.newPage();
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(url);

  // 07 no audio without gesture; 01 intro quick links
  ok("07a nessun player/audio al caricamento", (await page.locator('aside[aria-label="Player anteprime"]').count()) === 0);
  await page.waitForTimeout(1500);
  await snap(page, "01-intro");
  const intro = page.getByRole("region", { name: "Introduzione GENKS" });
  const links = await intro.getByRole("navigation").getByRole("button").allTextContents();
  ok("01 intro: link diretti a Mix & Master, Beat Store, Beat su misura, Pacchetti", ["Mix & Master", "Beat Store", "Beat su misura", "Pacchetti"].every(l => links.includes(l)), links.join(", "));
  await intro.getByRole("button", { name: "Mix & Master" }).click();
  const mixDlg = page.getByRole("dialog", { name: "Mix, Master, Mix & Master" });
  await mixDlg.waitFor();
  ok("01 dal logo intro si apre direttamente Mix & Master", await mixDlg.isVisible());
  await page.waitForTimeout(600);
  await snap(page, "02-mix-panel");

  // 04 tabs by keyboard + remote project
  await mixDlg.getByRole("tab", { name: "Mix & Master" }).focus();
  await page.keyboard.press("ArrowRight");
  ok("04 tab Mix/Master/Mix & Master navigabili da tastiera", (await mixDlg.getByRole("tab", { name: "Mix", exact: true }).getAttribute("aria-selected")) === "true");
  await mixDlg.getByRole("button", { name: "Invia progetto da remoto" }).click();
  await mixDlg.getByLabel("Titolo brano *").fill("Brano di prova");
  await mixDlg.getByLabel("Numero tracce / stems *").fill("18");
  await mixDlg.locator('input[type="file"]').setInputFiles({ name: "voce-lead.wav", mimeType: "audio/wav", buffer: Buffer.from("demo") });
  await fillContact(mixDlg);
  await page.waitForTimeout(2600);
  ok("04 upload: file selezionato con progresso simulato", await mixDlg.getByText("pronto (demo)").isVisible());
  await snap(page, "03-remote-upload");
  await mixDlg.getByRole("button", { name: "Invia richiesta progetto (demo)" }).click();
  ok("04 richiesta progetto remoto: conferma DEMO trasparente", await mixDlg.getByText("non è stata inviata").isVisible());
  await page.keyboard.press("Escape");
  await mixDlg.waitFor({ state: "hidden" });

  // 02 microphone hotspot
  await page.waitForTimeout(2800);
  await snap(page, "04-mic-scene");
  const micHot = page.getByRole("button", { name: "Registrazione voce" }).first();
  ok("02 hotspot microfono visibile con etichetta", await micHot.isVisible());
  await micHot.click({ force: true }); // the hotspot follows the gently swaying camera
  const recDlg = page.getByRole("dialog", { name: "Prenota una sessione" });
  await recDlg.waitFor();
  await page.waitForTimeout(500);
  await snap(page, "05-recording-panel");
  await recDlg.getByRole("button", { name: "Prenota (richiesta demo)" }).click();
  ok("02 validazione: senza dati la prenotazione non parte", await recDlg.getByText("Controlla i campi evidenziati.").isVisible());
  await recDlg.getByRole("radio", { disabled: false }).filter({ hasText: "disponibile" }).first().click();
  await recDlg.getByRole("radiogroup", { name: "Orario di inizio" }).getByRole("radio", { disabled: false }).first().click();
  await fillContact(recDlg);
  await recDlg.getByRole("button", { name: "Prenota (richiesta demo)" }).click();
  ok("02 prenotazione demo confermata senza fingere una prenotazione reale", await recDlg.getByText("non costituisce una prenotazione").isVisible());
  await recDlg.getByRole("button", { name: "Chiudi pannello" }).click();
  await recDlg.waitFor({ state: "hidden" });

  // 03 guided scroll: one wheel gesture = one complete camera move to the next stop
  const stopY = p => page.evaluate(p => { const e = document.getElementById("studio"); return e.offsetTop + (e.offsetHeight - innerHeight) * p; }, p);
  const wheelTo = async (p, label) => {
    await page.mouse.move(640, 300);
    await page.mouse.wheel(0, 120);
    // wait until the guided move has finished (software rendering in CI can be slow)
    const want = await stopY(p);
    await page.waitForFunction(w => Math.abs(scrollY - w) < 2, want, { timeout: 9000 }).catch(() => {});
    await page.waitForTimeout(600);
    const y = await page.evaluate(() => scrollY);
    ok(`03 scroll a tappe: una rotellina → ${label}`, Math.abs(y - want) < 6, `y=${Math.round(y)} atteso ${Math.round(want)}`);
  };
  await page.waitForTimeout(1200);
  ok("03 indicazione «scorri» visibile all'ingresso", await page.getByText("Scorri verso il basso per scoprire i servizi").isVisible());
  await wheelTo(0.22, "monitor DAW (beat su misura)");
  await snap(page, "06-daw-custom");
  const dawHot = page.getByRole("button", { name: "Beat su misura" }).and(page.locator("[data-id]"));
  ok("08 hotspot «Beat su misura» sul monitor DAW", await dawHot.isVisible());
  await dawHot.click({ force: true });
  const custom = page.getByRole("dialog", { name: "Un beat costruito sul tuo brano" });
  await custom.waitFor();
  await custom.getByLabel("Genere *").fill("Trap");
  await custom.getByLabel("Descrizione *").fill("Beat scuro con 808 lunghi.");
  await fillContact(custom);
  await page.waitForTimeout(500);
  await snap(page, "13-custom-beat");
  await custom.getByRole("button", { name: "Richiedi preventivo" }).click();
  ok("08 beat su misura: richiesta preventivo demo", await custom.getByText("Richiesta demo registrata").isVisible());
  await page.keyboard.press("Escape");
  await custom.waitFor({ state: "hidden" });

  await wheelTo(0.5, "servizio Mix");
  await snap(page, "07-mixer-mix");
  ok("04 servizio Mix presentato allo scorrimento", await page.getByRole("heading", { name: "Mix", exact: true }).isVisible() && !(await page.getByRole("heading", { name: "Master", exact: true }).isVisible()));
  await wheelTo(0.62, "servizio Master");
  ok("04 servizio Master compare dopo il Mix", await page.getByRole("heading", { name: "Master", exact: true }).isVisible());
  await page.getByRole("button", { name: "Scegli Master" }).click();
  await mixDlg.waitFor();
  ok("04 dalla scheda servizio si apre il pannello sul tab giusto", (await mixDlg.getByRole("tab", { name: "Master", exact: true }).getAttribute("aria-selected")) === "true");
  const yBefore = await page.evaluate(() => scrollY);
  await page.keyboard.press("Escape");
  await mixDlg.waitFor({ state: "hidden" });
  ok("scroll: nessun salto alla chiusura del pannello", Math.abs((await page.evaluate(() => scrollY)) - yBefore) < 2);
  await wheelTo(0.74, "servizio Mix & Master");
  await snap(page, "08-mixer-mixmaster");
  await wheelTo(1, "display del mixer");
  const storeHot = page.getByRole("button", { name: "Entra nel Beat Store" });
  ok("05 pulsante «Entra nel Beat Store» sul display", await storeHot.isVisible());
  await storeHot.click({ force: true });
  await page.waitForTimeout(1500);
  await snap(page, "09-waveform-split");
  await page.waitForTimeout(2200);
  const [sy, storeTop] = await page.evaluate(() => [scrollY, document.getElementById("beat-store").getBoundingClientRect().top]);
  ok("05 onda divisa e arrivo diretto ai beat", Math.abs(storeTop - 64) < 8 && sy > 0, `top=${Math.round(storeTop)}`);
  ok("05 niente più titolo «Ogni onda è un beat»", (await page.getByText("Ogni onda è un beat").count()) === 0);

  // 06 store: search / filter / empty / play / licence / order
  await page.evaluate(() => document.getElementById("beat-store").scrollIntoView({ behavior: "instant" }));
  const store = page.locator("#beat-store");
  const count = async () => store.locator("ul > li h3").count();
  const all = await count();
  await store.getByRole("searchbox").fill("cromo");
  ok("06 ricerca beat", (await count()) === 1, `${all} → 1`);
  await store.getByRole("searchbox").fill("zzzz");
  ok("06 stato vuoto", await store.getByText("Nessun beat corrisponde").isVisible());
  await store.getByRole("button", { name: "Mostra tutto il catalogo" }).click();
  await store.getByRole("button", { name: "Filtri" }).click();
  await store.getByLabel("Genere").selectOption("Trap");
  await store.getByLabel("BPM min").fill("145");
  ok("06 filtri genere + BPM", (await count()) === 1);
  await store.getByRole("button", { name: "Azzera filtri" }).click();
  ok("06 almeno 6 beat demo per pagina", (await count()) >= 6, String(await count()));
  await store.getByRole("button", { name: "Pagina successiva" }).click();
  await page.waitForTimeout(900);
  ok("10 catalogo a pagine: pagina 2 con altri beat", await store.getByText("pagina 2 di").isVisible() && !(await store.getByRole("heading", { name: "Notte Cobalto" }).isVisible()));
  await store.getByRole("button", { name: "Pagina 1" }).click();
  await page.waitForTimeout(900);
  await snap(page, "10-beat-store");
  await store.getByRole("button", { name: "Ascolta l’anteprima di Notte Cobalto" }).click();
  const player = page.locator('aside[aria-label="Player anteprime"]');
  await player.getByRole("button", { name: "Pausa" }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(1500);
  const t1 = await player.locator('input[aria-label="Posizione nel brano"]').inputValue();
  ok("06/07 anteprima in riproduzione dopo il gesto dell’utente", Number(t1) > 0.3, `t=${t1}s`);
  await store.getByRole("button", { name: "Licenze per Notte Cobalto" }).click();
  const beatDlg = page.getByRole("dialog", { name: "Notte Cobalto" });
  await beatDlg.waitFor();
  await beatDlg.getByRole("radio", { name: /Premium WAV/ }).check();
  await page.waitForTimeout(400);
  await snap(page, "11-beat-detail");
  await beatDlg.getByRole("button", { name: /Aggiungi al carrello/ }).click();
  await beatDlg.getByRole("button", { name: "Apri carrello" }).click();
  const cartDlg = page.getByRole("dialog", { name: "Il tuo carrello" });
  await cartDlg.waitFor();
  const t2 = await player.locator('input[aria-label="Posizione nel brano"]').inputValue();
  ok("07 il player continua mentre si aprono pannelli e carrello", Number(t2) > Number(t1), `t=${t1}s → ${t2}s`);
  ok("06 licenza scelta nel carrello demo", await cartDlg.getByText("Premium WAV").isVisible());
  await cartDlg.getByRole("button", { name: "Procedi al checkout simulato" }).click();
  const coDlg = page.getByRole("dialog", { name: "Riepilogo ordine simulato" });
  await coDlg.waitFor();
  await page.waitForTimeout(400);
  await snap(page, "12-checkout-demo");
  ok("11 checkout: nessun campo carta/pagamento", (await coDlg.locator('input[autocomplete^="cc-"], input[name*="card"]').count()) === 0);
  await fillContact(coDlg);
  await coDlg.getByRole("checkbox").check();
  await coDlg.getByRole("button", { name: "Simula ordine" }).click();
  ok("06 ordine simulato senza addebito", await coDlg.getByText("Nessun addebito").isVisible());
  await page.keyboard.press("Escape");
  await coDlg.waitFor({ state: "hidden" });
  ok("07 il player resta disponibile dopo il checkout", await player.isVisible());

  // exclusive is a separate request without price
  await store.getByRole("button", { name: "Licenze per Notte Cobalto" }).click();
  await beatDlg.getByRole("radio", { name: /Esclusiva/ }).check();
  ok("esclusiva: richiesta separata senza prezzo", await beatDlg.getByRole("button", { name: "Richiedi esclusiva" }).isVisible());
  await page.keyboard.press("Escape");
  await beatDlg.waitFor({ state: "hidden" });

  // bundle
  const bundles = page.locator("#bundle");
  await bundles.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await snap(page, "14-bundles");
  ok("bundle: offerte di esempio etichettate", (await bundles.getByText("Offerta di esempio").count()) >= 1);
  await bundles.getByRole("button", { name: "Richiedi il pacchetto" }).first().click();
  const bDlg = page.getByRole("dialog", { name: "Voce pronta" });
  await bDlg.waitFor();
  await fillContact(bDlg);
  await bDlg.getByRole("button", { name: "Richiedi questo pacchetto (demo)" }).click();
  ok("08 bundle: richiesta demo", await bDlg.getByText("Richiesta demo registrata").isVisible());
  await page.keyboard.press("Escape");

  // admin demo
  await page.goto(url + "#/gestione");
  await page.getByRole("heading", { name: /Gestione contenuti/ }).waitFor();
  await page.locator("summary").filter({ hasText: "Notte Cobalto" }).click();
  await page.getByLabel("Titolo").first().fill("Notte Cobalto MOD");
  await page.getByRole("button", { name: "Salva modifiche" }).click();
  await page.getByRole("tab", { name: "Richieste demo" }).click();
  ok("admin demo: richieste e ordine simulato elencati", (await page.locator("tbody tr").count()) >= 5, String(await page.locator("tbody tr").count()));
  await snap(page, "15-admin");
  await page.goto(url + "#beat-store");
  ok("admin demo: modifica al beat visibile nel catalogo senza toccare il codice", await page.getByRole("heading", { name: "Notte Cobalto MOD" }).isVisible());
  await ctx.close();

  /* ---------- 3D scene actually visible in both quality levels ---------- */
  for (const q of ["high", "low"]) {
    ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    page = await ctx.newPage();
    await page.addInitScript(() => sessionStorage.setItem("genks:vs:intro", "1"));
    await page.goto(url + "?quality=" + q);
    await page.waitForTimeout(5000);
    // count bright pixels of the WebGL canvas only (UI overlays excluded)
    const lit = await page.evaluate(() => new Promise(res => requestAnimationFrame(() => {
      const src = document.querySelector("#studio canvas");
      const c = document.createElement("canvas"); c.width = 160; c.height = 100;
      const g = c.getContext("2d"); g.drawImage(src, 0, 0, 160, 100);
      const d = g.getImageData(0, 0, 160, 100).data; let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 120) n++;
      res(n / (d.length / 4));
    })));
    ok(`scena 3D visibile (qualità ${q})`, lit > 0.03, `${(lit * 100).toFixed(1)}% pixel illuminati`);
    await snap(page, "19-scene-" + q);
    await ctx.close();
  }

  /* ---------- Mobile + reduced motion + keyboard ---------- */
  ctx = await browser.newContext({ ...devices["iPhone 13"], reducedMotion: "reduce" });
  page = await ctx.newPage();
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(url);
  await page.getByRole("button", { name: "Salta intro" }).waitFor();
  await page.waitForTimeout(300);
  ok("10 focus iniziale su «Salta intro»", await page.evaluate(() => document.activeElement?.textContent === "Salta intro"));
  await page.keyboard.press("Enter");
  await page.getByRole("region", { name: "Introduzione GENKS" }).waitFor({ state: "detached" });
  ok("10 intro saltabile da tastiera", true);
  await page.waitForTimeout(1500);
  await snap(page, "16-mobile-mic");
  ok("10 mobile: nessuno scroll orizzontale", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.getByRole("button", { name: "Apri menu" }).tap();
  await page.getByRole("navigation", { name: "Sezioni" }).getByRole("button", { name: "Registrazione" }).tap();
  await page.getByRole("dialog", { name: "Prenota una sessione" }).waitFor();
  await page.waitForTimeout(300);
  await snap(page, "17-mobile-recording");
  ok("10 mobile/touch + motion ridotto: pannello registrazione dal menu", true);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Apri menu" }).tap();
  await page.getByRole("navigation", { name: "Sezioni" }).getByRole("button", { name: "Beat su misura" }).tap();
  ok("10 mobile: beat su misura dal menu", await page.getByRole("dialog", { name: "Un beat costruito sul tuo brano" }).isVisible());
  await snap(page, "18-mobile-custom");
  ok("menu senza «modalità leggera»", (await page.getByText("Modalità leggera").count()) === 0);
  await ctx.close();

  /* ---------- Phone swipe: one swipe = one step ---------- */
  ctx = await browser.newContext({ ...devices["iPhone 13"] });
  page = await ctx.newPage();
  page.on("pageerror", e => errors.push(e.message));
  await page.addInitScript(() => sessionStorage.setItem("genks:vs:intro", "1"));
  await page.goto(url + "?quality=low");
  await page.waitForTimeout(3500);
  await page.evaluate(() => {
    const t = y => new Touch({ identifier: 1, target: document.body, clientX: 200, clientY: y });
    window.dispatchEvent(new TouchEvent("touchstart", { touches: [t(600)], cancelable: true }));
    for (const y of [580, 540, 480, 420]) window.dispatchEvent(new TouchEvent("touchmove", { touches: [t(y)], cancelable: true }));
  });
  await page.waitForFunction(() => { const e = document.getElementById("studio"); return Math.abs(scrollY - (e.offsetTop + (e.offsetHeight - innerHeight) * 0.22)) < 2; }, null, { timeout: 9000 }).catch(() => {});
  const [py, pwant] = await page.evaluate(() => { const e = document.getElementById("studio"); return [scrollY, e.offsetTop + (e.offsetHeight - innerHeight) * 0.22]; });
  ok("10 telefono: uno swipe porta alla tappa successiva", Math.abs(py - pwant) < 6, `y=${Math.round(py)} atteso ${Math.round(pwant)}`);
  await snap(page, "20-mobile-daw");
  await ctx.close();

  ok("nessun errore JavaScript in console", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  const failed = results.filter(r => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} controlli superati`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
