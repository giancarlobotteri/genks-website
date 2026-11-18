/* eslint-disable */
/* End-to-end smoke test of the acceptance criteria.
 * Usage: start the app (npm run preview) then: node scripts/smoke.cjs [url] [screenshotDir]
 * Requires Playwright with Chromium (not a project dependency).
 * The site is a set of full screens over one 3D studio: preview → choice → services / studio / Beat Store.
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
const vs = (page, k) => page.evaluate(k => window.__vs[k](), k);
const SEEN = () => { sessionStorage.setItem("genks:vs:reel", "1"); };

(async () => {
  const browser = await chromium.launch({ args: GL });
  const errors = [];
  const watch = page => { page.on("pageerror", e => errors.push(e.message)); page.on("console", m => { if (m.type() === "error") errors.push(m.text()); }); };

  /* ---------- Desktop: the preview ---------- */
  let ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  let page = await ctx.newPage();
  watch(page);
  await page.goto(url);
  ok("nessun audio al caricamento", (await page.locator('aside[aria-label="Player anteprime"]').count()) === 0);
  const reel = page.getByRole("region", { name: "Anteprima dei servizi GENKS" });
  await reel.waitFor();
  ok("anteprima: parte da sola prima dello studio", await reel.isVisible() && (await vs(page, "screen")) === "reel");
  ok("anteprima: 5 capitoli con barra di avanzamento", (await reel.getByRole("button", { name: /^Capitolo \d/ }).count()) === 5);
  ok("anteprima: niente scroll della pagina", await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1));
  ok("intro: scie di luce che disegnano il simbolo GENKS", (await page.locator("[data-streak-intro] svg").count()) === 1);
  await page.waitForTimeout(1500);
  await snap(page, "01-reel-intro");
  await page.locator("[data-streak-intro]").waitFor({ state: "detached", timeout: 40000 }).catch(() => {});
  // (on a slow machine the first chapter may already be over: what matters is that the preview is playing)
  const afterIntro = await vs(page, "reel");
  ok("intro: lascia il posto all'anteprima da sola", (await page.locator("[data-streak-intro]").count()) === 0 && afterIntro !== "reel:dark" && afterIntro?.startsWith("reel:"), afterIntro);
  await reel.getByRole("button", { name: /Capitolo 2/ }).click();
  await reel.getByRole("button", { name: /pausa/i }).click();
  await page.waitForTimeout(1600);
  // the preview is the opening film when the browser can play it (each chapter is a moment of the take),
  // otherwise the live 3D preview (each chapter is a camera shot)
  const filmT = () => page.evaluate(() => document.querySelector("[aria-roledescription=anteprima] video")?.currentTime ?? -1);
  ok("anteprima: capitolo Registrazione, in sala", (await reel.getByText("Entra in sala.").isVisible()) && ((await vs(page, "reel")) === "reel:rec" || (await filmT()) >= 5.3), `film ${await filmT()}`);
  await snap(page, "02-reel-rec");
  const fill = () => page.evaluate(() => getComputedStyle(document.querySelectorAll('[aria-label^="Capitolo"] span')[1]).getPropertyValue("--fill"));
  const f1 = await fill(); await page.waitForTimeout(900); const f2 = await fill();
  ok("anteprima: la pausa ferma il video", f1 === f2, `${f1} → ${f2}`);
  await reel.getByRole("button", { name: /Capitolo 4/ }).click();
  await page.waitForTimeout(1600);
  ok("anteprima: Mix & Master «equilibrio e vita al brano»", await reel.getByText(/equilibrio/i).isVisible() && ((await vs(page, "reel")) === "reel:mix" || (await filmT()) >= 9.1));
  await reel.getByRole("button", { name: /Riprendi/ }).click();
  const advanced = await page.waitForFunction(() => window.__vs.reel() === "reel:store" || document.querySelector('article[data-id="store"]'), null, { timeout: 40000 }).then(() => true, () => false);
  ok("anteprima: avanza da sola al capitolo Beat Store", advanced);
  await reel.locator("[data-skip]").click({ timeout: 5000 }).catch(() => {}); // on a slow machine the preview may already be over
  const chooseTitle = page.getByRole("heading", { name: "Di cosa hai bisogno?" });
  await chooseTitle.waitFor();
  await page.waitForTimeout(1500);
  await snap(page, "03-choose");
  ok("domanda finale «Di cosa hai bisogno?» con 4 scelte", (await reel.locator("[data-id]").count()) === 4);
  await reel.locator('[data-id="mix"]').hover();
  await page.waitForTimeout(200);
  ok("scelta: puntando un servizio la telecamera ci va sopra", (await vs(page, "reel")) === "reel:mix");

  /* ---------- Recording: step-by-step screen ---------- */
  await reel.locator('[data-id="rec"]').click();
  const rec = page.getByRole("region", { name: "Prenota una sessione" });
  await rec.waitFor();
  await page.waitForTimeout(1800);
  await snap(page, "04-rec-hours");
  ok("registrazione: schermata nuova a tutto schermo", (await vs(page, "screen")) === "studio" && await page.evaluate(() => document.documentElement.dataset.service === "recording"));
  const visibleSteps = scope => scope.locator("[data-step]:visible").count();
  ok("registrazione: un passaggio alla volta («Quante ore ti servono?»)", (await visibleSteps(rec)) === 1 && await rec.getByText("Quante ore ti servono?").isVisible());
  ok("registrazione: telecamera sul pacchetto", (await vs(page, "shot")) === "rec:pkg");
  const next = scope => scope.locator("[data-wz-next]").click();
  await next(rec);
  await rec.getByText("Scegli giorno e orario").waitFor();
  await page.waitForTimeout(400);
  ok("registrazione: passo 2, la telecamera si sposta sul calendario", (await vs(page, "shot")) === "rec:cal" && (await visibleSteps(rec)) === 1);
  await next(rec);
  ok("registrazione: senza giorno non si prosegue", await rec.getByText("Scegli un giorno.").isVisible());
  await rec.getByRole("radiogroup", { name: "Giorno" }).getByRole("radio", { disabled: false }).first().click();
  await rec.getByRole("radiogroup", { name: "Orario di inizio" }).getByRole("radio", { disabled: false }).first().click();
  await page.waitForTimeout(700);
  await snap(page, "05-rec-when");
  await next(rec);
  await rec.getByText("Come ti contattiamo?").waitFor();
  await next(rec);
  ok("registrazione: validazione dei dati", await rec.getByText("Controlla i campi evidenziati.").isVisible());
  await fillContact(rec);
  await next(rec);
  await rec.getByText("Ultimo controllo").waitFor();
  ok("registrazione: riepilogo con il pacchetto scelto", await rec.locator('[data-step="send"]').getByText("Sessione voce 2 ore").isVisible());
  await rec.getByRole("button", { name: "Prenota (demo)" }).click();
  ok("registrazione: conferma DEMO trasparente", await rec.getByText("non costituisce una prenotazione").isVisible());
  ok("registrazione: dopo l'invio la telecamera si allarga", (await vs(page, "shot")) === "rec:done");
  await snap(page, "06-rec-done");

  /* ---------- Change of mind → Mix & Master ---------- */
  await rec.getByRole("navigation", { name: "Cambia servizio" }).first().getByRole("button", { name: "Mix & Master" }).click();
  const mix = page.getByRole("region", { name: "Mix, Master, Mix & Master" });
  await mix.waitFor();
  await page.waitForTimeout(1200);
  ok("cambio idea: si passa a un altro servizio in un tocco", await mix.isVisible());
  await mix.getByRole("radio", { name: /^Master/ }).check();
  await page.waitForTimeout(300);
  ok("mix: scegliendo Master la telecamera va sulla sezione master", (await vs(page, "shot")) === "mix:master");
  await next(mix);
  await mix.getByText("Master: cosa ricevi").waitFor();
  await page.waitForTimeout(600);
  await snap(page, "07-mix-details");
  await next(mix);
  await mix.getByLabel("Titolo brano *").fill("Brano di prova");
  await mix.getByRole("button", { name: "Una traccia in più" }).click();
  ok("mix: contatore tracce interattivo", (await mix.getByLabel("Numero tracce").inputValue()) === "13");
  await next(mix);
  await mix.locator('input[type="file"]').setInputFiles({ name: "voce-lead.wav", mimeType: "audio/wav", buffer: Buffer.from("demo") });
  await mix.getByText("pronto (demo)").waitFor({ timeout: 15000 }).catch(() => {});
  const upShot = await vs(page, "shot");
  ok("mix: upload con progresso simulato e telecamera sullo schermo", await mix.getByText("pronto (demo)").isVisible() && upShot === "mix:upload", `shot=${upShot}`);
  await next(mix);
  await fillContact(mix);
  await mix.getByRole("button", { name: "Invia richiesta (demo)" }).click();
  ok("mix: richiesta progetto demo", await mix.getByText("non è stata inviata").isVisible());
  await mix.locator("[data-svc-back]").click();
  await mix.waitFor({ state: "detached" });

  /* ---------- Studio: virtual, physics-based scroll ---------- */
  const dock = page.getByRole("navigation", { name: "Servizi" }).last();
  await dock.waitFor();
  ok("studio: barra servizi sempre visibile", await dock.isVisible());
  ok("studio: icone della barra servizi a grandezza piena", (await dock.locator("svg").first().boundingBox()).width >= 16);
  ok("studio: indicatore delle tappe", await page.getByRole("list", { name: "Tappe dello studio" }).isVisible());
  const settle = async want => {
    await page.waitForFunction(w => Math.abs(window.__vs.pos() - w) < 0.002 && !window.__vs.moving(), want, { timeout: 40000 }).catch(() => {});
    return vs(page, "pos");
  };
  const wheel = async (want, label) => {
    await page.waitForTimeout(350); // a new gesture, not the tail of the last one
    await page.mouse.move(640, 300);
    await page.mouse.wheel(0, 120);
    const pos = await settle(want);
    ok(`scroll fluido: una rotellina → ${label}`, Math.abs(pos - want) < 0.01, `pos=${pos.toFixed(3)}`);
  };
  await settle(4);
  ok("studio: si torna sul banco mixer dopo il servizio", Math.abs((await vs(page, "pos")) - 4) < 0.01);
  await page.getByRole("list", { name: "Tappe dello studio" }).getByRole("button", { name: "Vai a: Microfono" }).click();
  await settle(0);
  ok("studio: indicazione «scorri» all'inizio", await page.getByText("Scorri per esplorare lo studio").isVisible());
  await snap(page, "08-studio-mic");
  // the microphone itself is clickable (centre of the hero shot)
  await page.waitForTimeout(600);
  const vp = page.viewportSize();
  await page.mouse.move(vp.width / 2, vp.height / 2);
  await page.waitForTimeout(400);
  ok("microfono 3D: al passaggio del mouse il cursore diventa una mano", (await page.evaluate(() => document.querySelector("canvas").style.cursor)) === "pointer");
  await page.mouse.click(vp.width / 2, vp.height / 2);
  await rec.waitFor({ timeout: 8000 }).catch(() => {});
  ok("microfono 3D: un clic apre la registrazione", await rec.isVisible());
  await page.keyboard.press("Escape");
  await rec.waitFor({ state: "detached" }).catch(() => {});
  await settle(0);
  await wheel(1, "servizi sotto i riflettori");
  const ana = page.getByRole("region", { name: "I servizi GENKS" });
  await page.waitForTimeout(800);
  ok("servizi: quattro servizi in fila sotto i riflettori", await ana.isVisible() && (await ana.locator('[class*="_lineCap_"]').count()) === 4);
  ok("servizi: ogni servizio si apre dalla sua didascalia", await ana.getByRole("button", { name: /Beat su misura/ }).isVisible());
  await snap(page, "08b-services");
  await wheel(2, "rivelazione dello studio");
  ok("rivelazione: titolo dell'inquadratura d'insieme", await page.evaluate(() => Number(getComputedStyle(document.querySelector('[class*="_studioTitle_"]')).opacity) > 0.5));
  await wheel(3, "monitor DAW");
  const dawHot = page.locator('[data-id="screen"]');
  ok("hotspot «Beat su misura» sul monitor DAW", await dawHot.isVisible());
  await wheel(4, "servizio Mix");
  ok("servizio Mix presentato allo scorrimento", await page.getByRole("heading", { name: "Mix", exact: true }).isVisible());
  await page.keyboard.press("ArrowDown");
  await settle(5);
  ok("tastiera: freccia giù → servizio Master", await page.getByRole("heading", { name: "Master", exact: true }).isVisible());
  await snap(page, "09-studio-master");
  await page.getByRole("button", { name: "Scegli Master" }).click();
  await mix.waitFor();
  ok("dalla scheda Master si apre il servizio con Master già scelto", await mix.getByRole("radio", { name: /^Master/ }).isChecked());
  await page.keyboard.press("Escape");
  await mix.waitFor({ state: "detached" });
  await settle(4);
  await wheel(5, "Master");
  await wheel(6, "Mix & Master");
  await wheel(7, "display del mixer");
  ok("pulsante «Entra nel Beat Store» sul display", await page.locator('[data-id="display"]').isVisible());

  /* ---------- Beat Store screen with its own intro ---------- */
  await page.waitForTimeout(350);
  await page.mouse.wheel(0, 120);
  await page.waitForFunction(() => window.__vs.screen() === "store", null, { timeout: 12000 }).catch(() => {});
  ok("scorrendo oltre il display si entra nel Beat Store", (await vs(page, "screen")) === "store");
  const introOn = await page.waitForSelector('[class*="_storeIntro_"]', { timeout: 6000 }).then(() => true, () => false);
  const titled = await page.waitForSelector('h2[aria-label="Beat Store"]', { timeout: 6000 }).then(() => true, () => false);
  ok("Beat Store: intro animata con titolo", introOn && titled);
  await snap(page, "10-store-intro");
  await page.getByRole("button", { name: "Vai ai beat" }).click().catch(() => {});
  await page.waitForFunction(() => !document.querySelector('[class*="storeIntro"]'), null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await snap(page, "11-store-grid");
  const fitInfo = await page.evaluate(() => { const g = document.querySelector("#beat-store ul"); return { n: g.children.length, bottom: g.lastElementChild.getBoundingClientRect().bottom, vh: innerHeight }; });
  ok("i beat della pagina entrano interi nello schermo", fitInfo.n >= 6 && fitInfo.bottom <= fitInfo.vh, JSON.stringify(fitInfo));
  const store = page.locator("#beat-store");
  const count = async () => store.locator("ul > li h3").count();
  await store.getByRole("searchbox").fill("cromo");
  ok("ricerca beat", (await count()) === 1);
  await store.getByRole("searchbox").fill("zzzz");
  ok("stato vuoto", await store.getByText("Nessun beat corrisponde").isVisible());
  await store.getByRole("button", { name: "Mostra tutto il catalogo" }).click();
  await store.getByRole("button", { name: "Filtri", exact: true }).click();
  await store.getByLabel("Genere").selectOption("Trap");
  await store.getByLabel("BPM min").fill("145");
  ok("filtri genere + BPM", (await count()) === 1);
  await store.getByRole("button", { name: "Azzera filtri" }).click();
  await store.getByRole("button", { name: "Filtri", exact: true }).click();
  await store.getByRole("button", { name: "Pagina successiva" }).click();
  await page.waitForTimeout(900);
  ok("catalogo a pagine: pagina 2", await store.getByText("pagina 2 di").isVisible());
  await store.getByRole("button", { name: "Pagina 1" }).click();
  await page.waitForTimeout(900);
  await store.getByRole("button", { name: "Ascolta l’anteprima di Notte Cobalto" }).click();
  const player = page.locator('aside[aria-label="Player anteprime"]');
  await player.getByRole("button", { name: "Pausa" }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(1500);
  const t1 = await player.locator('input[aria-label="Posizione nel brano"]').inputValue();
  ok("anteprima audio in riproduzione dopo il gesto dell’utente", Number(t1) > 0.3, `t=${t1}s`);
  await store.getByRole("button", { name: "Licenze per Notte Cobalto" }).click();
  const beatDlg = page.getByRole("dialog", { name: "Notte Cobalto" });
  await beatDlg.waitFor();
  await beatDlg.getByRole("radio", { name: /Premium WAV/ }).check();
  await beatDlg.getByRole("button", { name: /Aggiungi al carrello/ }).click();
  await beatDlg.getByRole("button", { name: "Apri carrello" }).click();
  const cartDlg = page.getByRole("dialog", { name: "Il tuo carrello" });
  await cartDlg.waitFor();
  const t2 = await player.locator('input[aria-label="Posizione nel brano"]').inputValue();
  ok("il player continua mentre si aprono i pannelli", Number(t2) > Number(t1), `t=${t1}s → ${t2}s`);
  await cartDlg.getByRole("button", { name: "Procedi al checkout simulato" }).click();
  const coDlg = page.getByRole("dialog", { name: "Riepilogo ordine simulato" });
  await coDlg.waitFor();
  ok("checkout: nessun campo carta/pagamento", (await coDlg.locator('input[autocomplete^="cc-"], input[name*="card"]').count()) === 0);
  await fillContact(coDlg);
  await coDlg.getByRole("checkbox").check();
  await coDlg.getByRole("button", { name: "Simula ordine" }).click();
  ok("ordine simulato senza addebito", await coDlg.getByText("Nessun addebito").isVisible());
  await page.keyboard.press("Escape");
  await coDlg.waitFor({ state: "hidden" });
  await store.getByRole("button", { name: "Licenze per Notte Cobalto" }).click();
  await beatDlg.getByRole("radio", { name: /Esclusiva/ }).check();
  ok("esclusiva: richiesta separata senza prezzo", await beatDlg.getByRole("button", { name: "Richiedi esclusiva" }).isVisible());
  await page.keyboard.press("Escape");
  await beatDlg.waitFor({ state: "hidden" });
  await page.getByRole("tab", { name: "Pacchetti" }).click();
  const bundles = page.locator("#bundle");
  await bundles.waitFor();
  await page.waitForTimeout(900);
  await snap(page, "12-bundles");
  ok("pacchetti: offerte di esempio etichettate", (await bundles.getByText("Offerta di esempio").count()) >= 1);
  await bundles.getByRole("button", { name: "Richiedi il pacchetto" }).first().click();
  const bDlg = page.getByRole("dialog", { name: "Voce pronta" });
  await bDlg.waitFor();
  await fillContact(bDlg);
  await bDlg.getByRole("button", { name: "Richiedi questo pacchetto (demo)" }).click();
  ok("pacchetti: richiesta demo", await bDlg.getByText("Richiesta demo registrata").isVisible());
  await page.keyboard.press("Escape");
  await bDlg.waitFor({ state: "hidden" });
  await page.locator("[data-store-back]").click();
  await page.waitForFunction(() => window.__vs.screen() === "studio", null, { timeout: 8000 });
  ok("dal Beat Store si torna allo studio, sul display", Math.abs((await settle(7)) - 7) < 0.01);
  ok("il player resta disponibile tra le schermate", await player.isVisible());
  await page.getByRole("button", { name: "Rivedi l’anteprima" }).click();
  await reel.waitFor();
  // the replay opens with the titles again (light streaks → symbol), then the first chapter
  await page.waitForFunction(() => window.__vs.reel() === "reel:intro" || document.querySelector('article[data-id="intro"]'), null, { timeout: 15000 }).catch(() => {});
  ok("l’anteprima si può rivedere dal primo capitolo", (await vs(page, "reel")) === "reel:intro" || (await page.locator('article[data-id="intro"]').count()) === 1);

  // admin demo → the change shows up in the store
  await page.goto(url + "#/gestione");
  await page.getByRole("heading", { name: /Gestione contenuti/ }).waitFor();
  await page.locator("summary").filter({ hasText: "Notte Cobalto" }).click();
  await page.getByLabel("Titolo").first().fill("Notte Cobalto MOD");
  await page.getByRole("button", { name: "Salva modifiche" }).click();
  await page.getByRole("tab", { name: "Richieste demo" }).click();
  ok("admin demo: richieste e ordine simulato elencati", (await page.locator("tbody tr").count()) >= 4, String(await page.locator("tbody tr").count()));
  await page.goto(url);
  await page.getByRole("heading", { name: "Di cosa hai bisogno?" }).waitFor();
  ok("seconda visita: si arriva subito alla domanda", true);
  await page.locator('[data-id="store"]').click();
  await page.getByRole("heading", { name: "Notte Cobalto MOD" }).waitFor({ timeout: 15000 }).catch(() => {});
  ok("admin demo: modifica visibile nel catalogo", await page.getByRole("heading", { name: "Notte Cobalto MOD" }).isVisible());
  await ctx.close();

  /* ---------- the studio is actually visible: photographic plate (both quality levels) and the 3D fallback ---------- */
  for (const q of ["high", "low", "3d"]) {
    ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    page = await ctx.newPage();
    await page.addInitScript(SEEN);
    // "3d": the film can't load, the live 3D studio takes over
    if (q === "3d") await page.route("**/film/**", r => r.fulfill({ status: 404, body: "" }));
    await page.goto(url + "?quality=" + (q === "3d" ? "high" : q));
    await page.waitForTimeout(5000);
    const lit = await page.evaluate(() => new Promise(res => requestAnimationFrame(() => {
      const photo = document.querySelector("#studio[data-photo] video");
      const src = photo || document.querySelector("#studio canvas");
      const c = document.createElement("canvas"); c.width = 160; c.height = 100;
      const g = c.getContext("2d"); g.drawImage(src, 0, 0, 160, 100);
      const d = g.getImageData(0, 0, 160, 100).data; let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 120) n++;
      res(n / (d.length / 4));
    })));
    const photo = await page.evaluate(() => Boolean(document.querySelector("#studio[data-photo]")));
    ok(`studio fotografico ${q === "3d" ? "assente → scena 3D" : "attivo"} (${q})`, q === "3d" ? !photo : photo);
    ok(`studio visibile (${q})`, lit > 0.03, `${(lit * 100).toFixed(1)}% pixel illuminati`);
    await ctx.close();
  }

  /* ---------- Phone + reduced motion + keyboard ---------- */
  ctx = await browser.newContext({ ...devices["iPhone 13"], reducedMotion: "reduce" });
  page = await ctx.newPage();
  watch(page);
  await page.goto(url);
  await page.getByRole("heading", { name: "Di cosa hai bisogno?" }).waitFor();
  await page.waitForTimeout(400);
  ok("motion ridotto: si parte dalla domanda, con il focus sul titolo", await page.evaluate(() => document.activeElement?.textContent?.includes("hai bisogno")));
  await snap(page, "13-phone-choose");
  ok("telefono: nessuno scroll orizzontale", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.locator('[data-id="rec"]').tap();
  const prec = page.getByRole("region", { name: "Prenota una sessione" });
  await prec.waitFor();
  const box = await page.evaluate(() => { const r = document.querySelector("[data-sheet-body]").getBoundingClientRect(); return { top: r.top, bottom: r.bottom, vh: innerHeight }; });
  ok("telefono: il pannello del servizio è dentro lo schermo", box.bottom <= box.vh + 1 && box.top < box.vh * 0.6, JSON.stringify(box));
  await snap(page, "14-phone-rec");
  await page.getByRole("button", { name: "Apri menu" }).tap();
  await page.getByRole("navigation", { name: "Sezioni" }).getByRole("button", { name: "Beat su misura" }).tap();
  const cust = page.getByRole("region", { name: "Un beat sul tuo brano" });
  await cust.waitFor();
  ok("telefono: beat su misura dal menu", true);
  // "your beat in one sentence": the sentence fills the brief and the wizard moves to the sound
  await cust.getByLabel(/Il tuo beat, in una frase/).fill("trap cupa a 140 BPM, atmosfera notturna");
  await cust.getByRole("button", { name: "Prepara il brief" }).tap();
  await cust.getByText("Che sound cerchi?").waitFor({ timeout: 15000 }).catch(() => {});
  const brief = await page.evaluate(() => ({
    genre: document.querySelector('input[name="genre"]:checked')?.value,
    bpm: document.querySelector('input[name="bpm"]')?.value,
    moods: [...document.querySelectorAll('input[name="mood"]:checked')].map(x => x.value).join(","),
  }));
  ok("beat in una frase: genere, BPM e mood compilati", brief.genre === "Trap" && brief.bpm === "140" && brief.moods === "Notturno,Cupo", JSON.stringify(brief));
  await snap(page, "14b-phone-brief");
  ok("menu senza «modalità leggera»", (await page.getByText("Modalità leggera").count()) === 0);
  await ctx.close();

  /* ---------- Phone swipe: the studio follows the finger, then glides ---------- */
  ctx = await browser.newContext({ ...devices["iPhone 13"] });
  page = await ctx.newPage();
  watch(page);
  await page.addInitScript(SEEN);
  await page.goto(url + "?quality=low");
  await page.getByRole("button", { name: "Esplora lo studio liberamente" }).tap();
  await page.waitForFunction(() => window.__vs.screen() === "studio");
  await page.waitForTimeout(1500);
  const mid = await page.evaluate(() => {
    const t = y => new Touch({ identifier: 1, target: document.body, clientX: 200, clientY: y });
    window.dispatchEvent(new TouchEvent("touchstart", { touches: [t(600)], cancelable: true }));
    for (const y of [590, 560, 520, 470, 420]) window.dispatchEvent(new TouchEvent("touchmove", { touches: [t(y)], cancelable: true }));
    return new Promise(r => setTimeout(() => r(window.__vs.pos()), 900));
  });
  ok("telefono: durante lo swipe lo studio segue il dito", mid > 0.1 && mid < 1, `pos=${mid.toFixed(3)}`);
  await page.evaluate(() => window.dispatchEvent(new TouchEvent("touchend", { touches: [], cancelable: true })));
  await page.waitForFunction(() => Math.abs(window.__vs.pos() - 1) < 0.002, null, { timeout: 40000 }).catch(() => {});
  ok("telefono: al rilascio scivola fino alla tappa successiva", Math.abs((await vs(page, "pos")) - 1) < 0.01);
  await snap(page, "15-phone-daw");
  await ctx.close();

  ok("nessun errore JavaScript in console", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  const failed = results.filter(r => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} controlli superati`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
