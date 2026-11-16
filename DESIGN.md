# GENKS · Specifiche di design e piano di lavoro

Analisi del 16 novembre 2026. Versione di produzione `e5d2b7a01e583b5010d07a77790389bf1109eaa4`. I token riportati qui sono il riferimento vincolante per le modifiche approvate. Gli stili attivi dipendono dall’ordine degli import in `src/app/layout.tsx` e dall’attributo `data-material-preview` attivo sul sito.

## Colore

Fonte: `src/app/semantic-colors.css:2–26`. I componenti devono usare i ruoli semantici. Eventuali sfumature nuove vanno derivate dai colori esistenti in OKLCH e verificate sullo sfondo effettivo.

| Ruolo | Variabili e valori |
| --- | --- |
| Scala del blu da 50 a 950 | `--color-primary-50` #eff6ff, 100 #dbeafe, 200 #bfdbfe, 300 #93c5fd, 400 #60a5fa, 500 #3b82f6, 600 #2563eb, 700 #1d4ed8, 800 #1e40af, 900 #10345b, 950 #03091a |
| Superfici | `--color-bg` #03091a, `--color-surface` #10345b, `--color-header` #071a34, `--color-footer` #030b18, `--surface-raised` #164476 |
| Testo | `--color-text` #f5fbff, `--color-text-secondary` #d0e5ff, `--color-text-muted` #b3cdeb |
| Bordi e focus | `--color-border` #407eb7, `--color-control-border` #80c5ff, `--color-focus` #bfdbfe, `--border-hover` #8bd7ff |
| Azione principale | `--color-cta` #2563eb, `--color-cta-hover` #1d4ed8, `--color-cta-active` #1e40af, `--color-on-cta` #ffffff |
| Gradienti delle azioni | `--color-cta-gradient` 115°, #2563eb → #1767d8 al 65% → #126daa. `--color-cta-hover-gradient` 115°, #1d4ed8 → #1958bf al 65% → #155a96 |
| Collegamenti | `--color-link` #a6d9ff, `--color-link-visited` #bfdbfe, `--color-link-hover` #ffffff |
| Informazione | `--color-info` #67e8f9, `--color-info-text` #dffbff, `--color-info-border` #22d3ee, `--color-info-gradient` 125°, #0b485e → #103653 |
| Successo | `--color-success` #b4f6d4 e `--color-success-bg` #0c4938 |
| Errore | `--color-error` #ffd0db e `--color-error-bg` #651a34 |
| Avviso | `--color-warning` #ffe5a3 e `--color-warning-bg` #4b350c |
| Disabilitato | `--color-disabled-bg` #102743 e `--color-disabled-text` #a9c4e1 |
| Accenti in uso | `--blue` #3876ff, `--blue-light` #8cdaff, `--blue-deep` #112d68, `--blue-wash` #081a38, `--glow` 0 0 28px #267dff45 |
| Elementi cromati | `--chrome-highlight` #ffffff, `--chrome-mid` #c8cbd5, `--chrome-shadow` #6c7382 |

Gli alias `--background`, `--surface`, `--foreground`, `--muted`, `--faint`, `--border`, `--danger` adottano i corrispondenti ruoli semantici. `material-preview.css:2–6` e `glass-preview.css:2` applicano strati alle superfici. `--material-panel` usa i blu #19496f, #103251, #091c33 con velature. `--material-edge` vale #729dbd88. Ombre e superfici incavate usano `--material-shadow` e `--material-well` da quegli stessi file.

Contrasto calcolato sui colori dichiarati: testo/sfondo 19,02:1, secondario/superficie 9,81:1, attenuato/superficie 7,72:1. Bianco sui tre colori del gradiente CTA da 5,17:1 a 5,54:1. Focus/superficie 8,88:1. Testi di successo, errore e avviso sulle proprie basi 8,43:1, 8,74:1 e 9,37:1. Gradienti sovrapposti, trasparenze, foto e stati reali richiedono misure specifiche per dichiarare la conformità AA del sito.

## Tipografia, raggi e spazi

| Funzione | Valore effettivo |
| --- | --- |
| Testo e controlli | `--font-body` Nunito Sans, con ripiego di sistema. Corpo globale 16px, interlinea 1,5. |
| Titoli | `--font-heading` e `--font-futuristic` Outfit. H1–H4 principali al peso 600 e spaziatura −0,025em. |
| Caricamento font | File WOFF2 locali, pesi 400, 600 e 700 dichiarati, latino e latino esteso, `font-display: swap`. |
| Raggi | `--radius` 24px, `--radius-large` 46px, `--radius-pill` 999px. Il blocco iniziale di `globals.css` dichiara 18px e 34px, poi sovrascritti. |
| Larghezza e margini | `--content-width` 1280px, `--gutter` clamp(20px, 4.6vw, 72px), 22px fino a 650px e 16px fino a 370px. |
| Spazio tra sezioni | `--space-section` clamp(72px, 8vw, 128px), 70px fino a 650px. |
| Colonna assistente | `--workspace-width` 288px nella base desktop, 320–380px nelle varianti previste. `--workspace-gap` 24px e `--workspace-top` 112px. |
| Scala per componente | Misure locali nei moduli. Nessuna scala globale modulare per le dimensioni del testo o tutti i gap. |

Font: `src/app/typography-layout.css:1,105–114`. Raggi e spazi: `src/app/globals.css:21–30,1949–1956,2375–2378,3175–3178` e `src/app/customer-journey.css:210,264–290`.

## Movimento

| Ambito | Variabili esistenti | Uso nel piano |
| --- | --- | --- |
| Base | `--duration-fast` 180ms, `--duration-medium` 350ms, `--duration-slow` 800ms, `--ease` cubic-bezier(0.22, 1, 0.36, 1) | Rapido per conferme visive. Medio e lento riservati ai contesti che lo giustificano, senza attese per leggere o agire. |
| Vetrina | `--motion-quick` 160ms, `--motion-panel` 360ms, `--motion-ease` cubic-bezier(.16,1,.3,1) | Una sola transizione per un pannello. Tastiera e cambi ripetuti immediati. |
| Comportamento preesistente | Entrate via JS da 320–480ms, uscita route 110ms, aperture dettagli via JS 220ms | Valori locali documentati, a differenza dei token. Rivedere l’eventuale sovrapposizione con ulteriori transizioni. |

Fonti: `src/app/globals.css:27–30`, `src/app/storefront-motion.css:70`, `src/components/ui/motion-observer.tsx:12–43`.

### Revisione preliminare delle animazioni

| Prima | Dopo proposto | Perché |
| --- | --- | --- |
| La home attende l’animazione prima di aprire Servizi (`cinematic-hero.tsx:24–69`) | Link immediato e feedback visivo con i token rapidi | Al clic ho misurato circa 5,2 secondi in Chrome desktop. Il codice può annullare il passaggio con ruota, tocco o tasto. |
| Transizioni di ombre, bordi e fondale (`storefront-motion.css:13,85`) | Stato visivo statico e movimento limitato a `transform` e `opacity` | Riduce il ridisegno durante l’animazione. |
| Apertura dei dettagli animata anche da tastiera (`motion-observer.tsx:38–43`) e più livelli di entrata pagina | Aperture frequenti immediate da tastiera, un ingresso per contenitore | Riduce l’attesa e rende prevedibile l’ordine del focus. |
| Woofer con densità piena e dimensioni lette durante il rendering (`woofer-scene.tsx:285,392–393`) | Limite alla densità, misure al ridimensionamento e verifica su hardware | Rischio di costo elevato su telefono. I fotogrammi persi richiedono una misurazione. |
| Movimento ambientale della home senza la pausa offerta dalla variante beat (`cinematic-hero.tsx:206–212`) | Breve ingresso che si stabilizza, oppure pausa accessibile se la scena continua | Chi legge o naviga deve poter gestire il movimento continuativo. Già presente la modalità a movimento ridotto. |

Verdetto preliminare: impedire che la transizione dell’hero ritardi o annulli la navigazione prima di estendere il movimento alle altre pagine. Le entrate sfalsate si applicano solo a gruppi poco frequenti, senza posticipare i controlli. Con movimento ridotto scompaiono spostamenti e attese. CSS esistente come base, senza necessità dimostrata di GSAP.

## Controlli richiesti

| Controllo | Esito | Evidenza |
| --- | --- | --- |
| EP/Album, 89,99 € × 4 e 359,99 € | Presentazione ambigua, aritmetica coerente. | 89,99 € × 4 = 359,96 €. La regola del totale a ,99 aggiunge 0,03 € una volta sull’ordine. `service-pricing-v10.ts:48–60`, `order-rounding.ts:3–10`, `service-order-v8.ts:86`, `home-storefront.ts:14–16`. |
| Registrazione + mix/master, sconto 10 € e risparmio 9,98 € | Sconto nominale e risparmio finale distinti. | 79,97 € − 10,00 € = 69,97 €. L’arrotondamento porta a 69,99 € e il confronto effettivo vale 9,98 €. `service-payment-policy.ts:7–15`, `direct-services.tsx:40`. |
| Fascia 37–48, prezzo precedente | Confronto coerente. | Mix mostra 139,99 € → 119,99 €. In Mix + Master il prezzo precedente e il totale mostrato sono entrambi 149,99 €. Il barrato appare solo in presenza di una riduzione. `direct-services.tsx:28`, `service-pricing-v10.ts:9–12,63–68`. |
| «GENKS ha già tutti i file necessari» | Ambiguità reale del testo. | È una dichiarazione del cliente che nasconde il campo. Altrimenti il configuratore richiede link SwissTransfer e conferma dei 30 giorni. Master richiede un file del mix finito, mix e mix + master i file separati. `order-builder-v8.tsx:42–47`, `service-order-v8.ts:38–40`. |
| Orari in Servizi e Regole | Aperture coerenti, indicazione notturna incompleta. | Lun–gio dalle 19:30 a mezzanotte, venerdì dalle 19:30, sabato e domenica dalle 10:00, domenica fino a mezzanotte. La prenotazione esplicita anche le nuove partenze dopo mezzanotte nelle notti di venerdì e sabato. `direct-services.tsx:29`, `legal.ts:9`, `recording-journey.tsx:75–76`. |

Altre incongruenze di testo. Il listino indica pagamento immediato e integrale per tutti i pacchetti, mentre il checkout distingue carta, contanti e acconto studio. L’EP/Album dice che il prezzo varia solo con le tracce, ma il calcolo comprende eventuali artisti aggiuntivi e il supplemento notturno. Qualsiasi aggiornamento deve riguardare la presentazione e lasciare intatti prezzi, regole, testi legali e contratti.

## Verifica browser

56 aperture in Chrome, 28 URL o stati a 375 e 1440 px. Coperti home, Servizi e collegamenti diretti, prenotazione, configuratori, beat su misura, EP/Album, budget, Regole, Guida, Lavori, Chi sono, raccolta, pagine legali e alcuni ingressi al riepilogo. Le catture di partenza sono in `prima/`. L’area raccolta porta al login per una sessione pubblica. La verifica di contenuti autenticati è separata. Nessun ordine o pagamento.

- A 375 px le schede Mix, Master e Mix + Master si estendono oltre il bordo visibile. La pagina nasconde l’eccedenza, ma lo screenshot mostra il taglio. Riprodotto anche entrando da `#listino`.
- Da tastiera il menu si apre e restituisce il focus su Escape. Dopo l’apertura il primo Tab raggiunge il logo, prima delle voci del menu. Aggiungere indicazione della voce corrente e verificare ordine, focus visibile e interazioni.
- La ricerca usa testo da 11–12px nei breakpoint esaminati. Lo zoom automatico e l’effetto della tastiera iOS richiedono un telefono reale. Controllare anche le aree sicure e i controlli fissati sotto le maschere del browser.
- Il menu espone l’accesso amministratore e mostra Lavori anche se non contiene schede. Chi sono contiene una bio senza foto e il budget non è uno dei percorsi principali della home.
- Il progetto contiene già Tailwind nel build (`globals.css:1`, `@theme inline`, `postcss.config.mjs`, `package.json`). Il piano usa CSS e moduli esistenti. L’eventuale rimozione della dipendenza richiede verificare prima le classi già utilizzate.

## Piano da approvare

1. **Percorsi e navigazione.** Mantenere il woofer come elemento visivo principale e mettere i cinque ingressi subito sotto l’hero. Riutilizzare destinazioni, dati di listino e assistente. Mostrare tre prezzi di partenza dai calcolatori esistenti. Mantenere le destinazioni dirette per listino e pacchetti. Usare una CTA primaria per schermata e un ritorno riconoscibile alla scelta. Menu con Servizi, Chi sono, Guida e I miei acquisti. Lavori entra nel menu solo con contenuti veri. Accesso amministratore via URL.
2. **Supporto alla scelta.** Sotto i percorsi, tre passaggi brevi, garanzia, stime di consegna e collegamenti a Lavori e Chi sono. «Invia i file» vale per le lavorazioni che li richiedono. I tempi di consegna e i passaggi di pagamento restano specifici per ciascun servizio. Preparare schede prima/dopo con player accessibile, foto e crediti. Per popolarle servono audio autorizzati, titolo o artista, permesso di pubblicazione e crediti. Per Chi sono servono foto e bio approvata.
3. **Aspetto.** Sfondo blu profondo, superfici rialzate dai blu esistenti e ciano per informazioni. Usa Outfit per una gerarchia leggibile, Nunito Sans per moduli e testi. A telefono impila i percorsi e risolvi il taglio delle schede. Gli stati di focus rimangono leggibili e fuori dalle sovrapposizioni.
4. **Movimento.** Il woofer resta il punto visivo dell’hero. Contenuti e CTA diventano utilizzabili subito. Conservare i token, evitare transizioni sovrapposte, usare solo `transform` e `opacity` nelle nuove animazioni. Su tastiera e azioni frequenti, feedback immediato. Controllare menu, assistente, carrello, entrate e annullamento a metà animazione. Rispettare il movimento ridotto.
5. **Consegna e prova finale.** Branch dedicato e commit piccoli per percorsi, aspetto e movimento. Verificare configurazione e riepilogo a 375, 768 e 1440 px, con screenshot prima/dopo, link diretti, focus, modalità a movimento ridotto e revisione delle animazioni. Nessun pagamento o invio. Verificare su hardware reale tastiera e fluidità se il dispositivo è disponibile.

Decisioni da prendere dopo l’analisi: approvazione del piano, eventuale chiarimento dei testi commerciali evidenziati e materiali per Lavori e Chi sono.
