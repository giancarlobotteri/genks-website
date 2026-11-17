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
// Cinematic cues (service/payment choices) hide the panel for ~2 s: skip them like a visitor would (Esc).
const settle = async page => {
  for (let i = 0; i < 40; i++) {
    const st = await page.evaluate(() => document.documentElement.dataset.vsCinema || "");
    if (!st) return;
    if (st === "on") await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
  }
};
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
  const screenCue = await page.waitForFunction(() => document.documentElement.dataset.vsCinema === "on" && document.body.innerText.includes("SCREEN"), null, { timeout: 5000 }).then(() => true, () => false);
  ok("cue: «Invia progetto da remoto» porta la camera sullo schermo", screenCue);
  await settle(page);
  await mixDlg.getByLabel("Titolo brano *").fill("Brano di prova");
  await mixDlg.getByLabel("Numero tracce / stems *").fill("18");
  await mixDlg.locator('input[type="file"]').setInputFiles({ name: "voce-lead.wav", mimeType: "audio/wav", buffer: Buffer.from("demo") });
  await fillContact(mixDlg);
  await page.waitForTimeout(2600);
  ok("04 upload: file selezionato con progresso simulato", await mixDlg.getByText("pronto (demo)").isVisible());
  await snap(page, "03-remote-upload");
  await mixDlg.getByText("Carta · subito").click();
  const posCue = await page.waitForFunction(() => document.documentElement.dataset.vsCinema === "on" && document.body.innerText.includes("POS"), null, { timeout: 5000 }).then(() => true, () => false);
  ok("cue pagamento: la scelta della carta mostra il POS", posCue);
  await snap(page, "03b-cue-pos");
  await settle(page);
  await mixDlg.getByRole("button", { name: "Invia richiesta progetto (demo)" }).click();
  await settle(page);
  ok("04 richiesta progetto remoto: conferma DEMO trasparente", await mixDlg.getByText("non è stata inviata").isVisible());
  await page.keyboard.press("Escape");
  await mixDlg.waitFor({ state: "hidden" });

  // 02 microphone hotspot
  await page.waitForTimeout(2800);
  await snap(page, "04-mic-scene");
  const micHot = page.getByRole("button", { name: "Esplora registrazione" }).first();
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
  await page.waitForTimeout(600);
  await snap(page, "05b-cue-clock");
  await settle(page);
  await fillContact(recDlg);
  await recDlg.getByText("Contanti in studio").click();
  await page.waitForTimeout(600);
  await snap(page, "05c-cue-cash");
  await settle(page);
  await recDlg.getByRole("button", { name: "Prenota (richiesta demo)" }).click();
  await settle(page);
  ok("02 prenotazione demo confermata senza fingere una prenotazione reale", await recDlg.getByText("non costituisce una prenotazione").isVisible());
  await recDlg.getByRole("button", { name: "Chiudi pannello" }).click();
  await recDlg.waitFor({ state: "hidden" });

  // 03 reveal, 04 mixer hotspot, 05 waveform
  const span = await page.evaluate(() => document.getElementById("studio").offsetHeight - innerHeight);
  await page.evaluate(y => scrollTo({ top: y, behavior: "instant" }), span * 0.5);
  await page.waitForTimeout(1800);
  await snap(page, "06-studio-reveal");
  ok("03 reveal dello studio: capitolo e etichette monitor/rack", await page.getByText("Lo spazio si accende.").isVisible() && await page.getByText("Monitor da studio", { exact: true }).isVisible());
  await page.evaluate(y => scrollTo({ top: y, behavior: "instant" }), span * 0.8);
  await page.waitForTimeout(1800);
  await snap(page, "07-mixer");
  const mixHot = page.getByRole("button", { name: "Apri servizi Mix & Master" }).first();
  ok("04 hotspot mixer visibile", await mixHot.isVisible());
  await mixHot.click({ force: true });
  await mixDlg.waitFor();
  const yBefore = await page.evaluate(() => scrollY);
  await page.keyboard.press("Escape");
  await mixDlg.waitFor({ state: "hidden" });
  ok("scroll: nessun salto alla chiusura del pannello", Math.abs((await page.evaluate(() => scrollY)) - yBefore) < 2);
  const [bTop, bSpan] = await page.evaluate(() => { const e = document.getElementById("onda"); return [e.offsetTop, e.offsetHeight - innerHeight]; });
  await page.evaluate(y => scrollTo({ top: y, behavior: "instant" }), bTop + bSpan * 0.5);
  await page.waitForTimeout(700);
  await snap(page, "08-waveform-morph");
  await page.evaluate(y => scrollTo({ top: y, behavior: "instant" }), bTop + bSpan * 0.97);
  await page.waitForTimeout(700);
  await snap(page, "09-waveform-cards");
  ok("05 transizione waveform → catalogo presente e saltabile", await page.getByRole("button", { name: "Salta al catalogo" }).isVisible());

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
  ok("06 almeno 6 beat demo", (await count()) >= 6, String(await count()));
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
  await settle(page);
  await snap(page, "11-beat-detail");
  await beatDlg.getByRole("button", { name: /Aggiungi al carrello/ }).click();
  await settle(page);
  await beatDlg.getByRole("button", { name: "Apri carrello" }).click();
  const cartDlg = page.getByRole("dialog", { name: "Il tuo carrello" });
  await cartDlg.waitFor();
  const t2 = await player.locator('input[aria-label="Posizione nel brano"]').inputValue();
  ok("07 il player continua mentre si aprono pannelli e carrello", Number(t2) > Number(t1), `t=${t1}s → ${t2}s`);
  ok("06 licenza scelta nel carrello demo", await cartDlg.getByText("Premium WAV").isVisible());
  await cartDlg.getByRole("button", { name: "Procedi al checkout simulato" }).click();
  const coDlg = page.getByRole("dialog", { name: "Riepilogo ordine simulato" });
  await coDlg.waitFor();
  await settle(page);
  await page.waitForTimeout(400);
  await snap(page, "12-checkout-demo");
  ok("11 checkout: nessun campo carta/pagamento", (await coDlg.locator('input[autocomplete^="cc-"], input[name*="card"]').count()) === 0);
  await fillContact(coDlg);
  await coDlg.getByRole("checkbox").check();
  await coDlg.getByRole("button", { name: "Simula ordine" }).click();
  await page.waitForTimeout(500);
  await snap(page, "12b-cue-approved");
  await settle(page);
  ok("06 ordine simulato senza addebito", await coDlg.getByText("Nessun addebito").isVisible());
  await page.keyboard.press("Escape");
  await coDlg.waitFor({ state: "hidden" });
  ok("07 il player resta disponibile dopo il checkout", await player.isVisible());

  // exclusive is a separate request without price
  await store.getByRole("button", { name: "Licenze per Notte Cobalto" }).click();
  await beatDlg.getByRole("radio", { name: /Esclusiva/ }).check();
  await settle(page);
  ok("esclusiva: richiesta separata senza prezzo", await beatDlg.getByRole("button", { name: "Richiedi esclusiva" }).isVisible());
  await page.keyboard.press("Escape");
  await beatDlg.waitFor({ state: "hidden" });

  // 08 custom beat + bundle
  const custom = page.locator("#beat-su-misura");
  await custom.scrollIntoViewIfNeeded();
  await custom.getByLabel("Genere *").fill("Trap");
  await custom.getByLabel("Descrizione *").fill("Beat scuro con 808 lunghi.");
  await fillContact(custom);
  await snap(page, "13-custom-beat");
  await custom.getByRole("button", { name: "Richiedi preventivo" }).click();
  await settle(page);
  ok("08 beat su misura: richiesta preventivo demo", await custom.getByText("Richiesta demo registrata").isVisible());
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
  await settle(page);
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
  await page.getByRole("button", { name: "Modalità leggera" }).tap();
  ok("10 modalità leggera: servizi raggiungibili senza 3D", (await page.locator("canvas").count()) === 0 && await page.getByRole("button", { name: "Apri servizi Mix & Master" }).isVisible());
  await snap(page, "18-mobile-lite");
  await ctx.close();

  ok("nessun errore JavaScript in console", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  const failed = results.filter(r => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} controlli superati`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
