# GENKS — Cinematic Premium Transformation · Piano

Branch di lavoro: `claude/genks-cinematic` (la versione FREE resta intatta su `claude/eloquent-lamport-9y3y2f` e su genks-virtual-studio.vercel.app).

Stato crediti: **nessun credito Higgsfield consumato, nessun servizio a pagamento attivato.** Ho usato solo interrogazioni in lettura (saldo, elenco modelli, preventivi).

> **Reference analizzate fotogramma per fotogramma** (registrazioni dei tre TikTok, 10–14 s ciascuna).

---

## 1. Audit dello stato attuale

**Architettura (da conservare).** React 19 + TypeScript + Vite + three.js r187. Una sola scena 3D fissa sotto schermate a tutto schermo: anteprima (reel), tour dello studio, servizi a passi, Beat Store.

- `lib/director` decide la schermata.
- `lib/stepper` è lo scroll virtuale a tappe: molla critica a 120 Hz, rotella, trackpad e touch.
- `scene/shot-table` e `scene/camera-path` contengono le inquadrature: orbite con deriva, spline Catmull-Rom e arco di allontanamento.
- Il framing si adatta a ogni rapporto d'aspetto (dal 4:3 al 32:9).
- Qualità adattiva, fallback senza WebGL, 24 test unitari e 69 controlli end-to-end.

**Scena 3D.** È interamente procedurale (`build-studio.ts`, circa 590 righe di primitive: cilindri, box arrotondati, lathe). Usa texture fotografiche CC0 di Poly Haven, due modelli CC0 (divano e pianta) e tre immagini Higgsfield ottenute con crediti gratuiti. Lo spazio è coerente: microfono, scrivania, monitor, mixer e rack hanno posizioni fisse.

**Rendering.**
- Tone mapping ACES e environment map procedurale (softbox e strisce LED blu).
- Bloom UnrealBloomPass su buffer a 8 bit.
- Ombre PCF calcolate una sola volta, nebbia esponenziale.
- Su telefono: niente post-processing e luci ridotte.

**Cosa funziona già bene:** coerenza dello spazio, fluidità dello scroll, interazioni e moduli completi, prestazioni.

**Limiti visivi** (confronto nelle schermate in `docs/cinematic/before-*`):

| # | Problema | Effetto percepito |
| --- | --- | --- |
| 1 | Illuminazione piatta: alla tappa «Microfono» lo studio è già tutto acceso. La funzione di rivelazione delle luci esiste, ma nel tour resta sempre al 100% | Il microfono non è mai il protagonista nel buio; manca la gerarchia luce/ombra |
| 2 | Materiali: le manopole del mixer «bruciano» in bianco (bloom a 8 bit con soglia bassa); fader a blocchetto; la griglia del microfono è una texture piatta; legno rosato e tappeto blu saturo | Aspetto «videogioco», non «prodotto» |
| 3 | Nessuna profondità di campo, nessuna atmosfera (fasci di luce, polvere), nessuna grana o color grading | Immagine nitida ovunque = CG |
| 4 | Geometria senza micro-dettagli: niente serigrafie, scale dB, viti, zigrinature, indicatori sulle manopole | Le macro non reggono |
| 5 | Camera: movimenti fluidi ma sempre con la stessa focale (42°), senza rack focus, senza cambi di lente | Linguaggio da configuratore, non da regia |
| 6 | Rivelazione dello studio: è un passaggio di circa 1,5 secondi tra microfono e DAW, senza una tappa propria | La sequenza C non ha tempo per «accadere» |
| 7 | Il clic avviene solo sul pulsante HTML; il microfono 3D non reagisce al cursore | Il segnale d'interazione è debole |

**Peso attuale:** three.js 270 KB gzip, app 111 KB gzip, texture caricate progressivamente.

## 2. Differenze rispetto alle tre reference

**Cosa contengono davvero i tre video:**

- **Reference 1 · CIRO (Opus + Higgsfield).**
  - Apertura: carosello di lattine sospese in arco su fondale grigio con riflessi.
  - Allo scroll: una sola lattina inclinata, enorme, su gradiente caldo, che **ruota** mentre cambiano le sezioni di testo a sinistra («Pêche blanche», «Moins de sucre», «Arômes naturels»), con indice a puntini a destra.
  - Finale: la lattina rimpicciolisce davanti a una **parola gigante sfocata** («ZERO BULLSHIT») e chiude con la **fila di tutte le varianti** in prospettiva.
  - Tecnica: still e video generati con Higgsfield, montati come sequenza legata allo scroll.
- **Reference 2 · BMW M (Claude Code + skills).**
  - **Scie di luce** (comete) su fondo scuro convergono e disegnano il profilo luminoso.
  - Il configuratore è un **prompt**: «Quelle M tu veux ?» → «Une M2 rouge Toronto, jantes noires…».
  - Seguono: transizione con **motion blur** sull'auto, scheda con auto e **campioni colore**, dati che contano («480 ch», «0–100 km/h») con le bande M, **scheda di prenotazione test drive** (slider data, orario, luogo, pulsante luminoso), menu modelli, campo «Ta BMW M, en une phrase» con bagliore a gradiente, chiusura sul marchio.
  - Tecnica: motion design di interfaccia (vetro, luce, blur), non 3D.
- **Reference 3 · All Star Burgers.**
  - Hero fotografico sul tavolo scuro.
  - Allo scroll il burger **si solleva e si scompone** strato per strato («THE STACK») con didascalie per ogni ingrediente su fondo bianco: **cambio di scena**.
  - Poi il box combo si apre e si chiude col marchio, e arriva «THE LINEUP»: griglia del menu con foto e prezzi.
  - Tecnica: foto/still di prodotto e sequenze a fotogrammi legate allo scroll.

**Applicazione a GENKS** (stessi principi, identità originale, nessun elemento copiato):

| Principio | Reference | GENKS |
| --- | --- | --- |
| Prodotto che ruota sincronizzato allo scroll + caratteristiche a sezioni | 1 | Il microfono ruota mentre lo scroll lo apre, con le sue parti spiegate |
| Fila di prodotti sotto i riflettori | 1 | **«Quattro servizi, sotto i riflettori»**: showroom con piedistalli e l'oggetto di ogni servizio (microfono, pad, fader, vinile), ognuno nel suo cono di luce, cliccabili |
| Parola gigante dietro il prodotto | 1 | «VOCE» dietro il microfono, occlusa davvero dall'oggetto 3D |
| Scie di luce che disegnano una forma | 2 | **Intro**: comete blu che convergono e disegnano l'anello del simbolo GENKS, che appare intatto (SVG originale) |
| Configuratore con stato visibile sull'oggetto | 2 | La console cambia stato col servizio scelto (fader motorizzati, meter, display) |
| Scheda di prenotazione con slider | 2 | Wizard di Registrazione esistente (ore → giorni → campi) |
| Cambio di scena | 3 | Buio totale sul microfono → studio che si accende → macro sulla console |
| Lineup con prezzi | 3 | Beat Store e Pacchetti (griglia esistente, da portare in profondità nelle fasi successive) |

**Dove siamo rispetto alle reference:**
- Reference 1 e 3 usano **still e video pre-renderizzati** (fotorealismo da foto): in realtime 3D non si arriva alla stessa resa fotografica senza modelli professionali. Ci si avvicina con luce, materiali e post-processing, oppure, con i crediti, con le sequenze Higgsfield della sezione 6.
- Reference 2 è motion design d'interfaccia: è riproducibile **interamente in codice, gratis**.

## 3. Tecnologie

**Mantengo:** React, TypeScript, Vite, three.js r187, director, stepper, sistema di inquadrature, wizard, Beat Store e player.

**Aggiungo (gratis, open source):**

| Tecnologia | Licenza | Perché |
| --- | --- | --- |
| `postprocessing` (pmndrs) 6.39 | Zlib | Buffer HDR a 16 bit, profondità di campo bokeh, bloom mipmap (solo sulle vere sorgenti luminose), tone mapping AgX, SMAA, effetti uniti in un solo passaggio: costa meno della catena attuale |
| Shader personalizzati (GLSL) | Nostri | Sweep di luce sui metalli, fasci volumetrici, polvere, color grading GENKS |

**Non aggiungo per ora:**
- **React Three Fiber:** riscriverebbe la scena senza un vantaggio concreto.
- **GSAP:** molla e tween attuali coprono già le esigenze; lo valuterò per le timeline del DOM nelle fasi successive.

**Fase premium (da autorizzare):**
- Blender (modelli GLB professionali, bake della luce indiretta).
- `gltf-transform` con compressione Meshopt/Draco e texture KTX2.
- Video Higgsfield in H.264/HEVC/AV1 con varianti mobile.

## 4. Storyboard cinematografico

Unità: metri, coordinate della scena. La focale è espressa come equivalente full-frame.

### A — GENKS INTRO (6 s, saltabile, autoplay muto)

| Shot | Camera | Luce / materiali | Interazione | Tecnica | Asset |
| --- | --- | --- | --- | --- | --- |
| A1 · 0–1,5 s | Nero; push-in lento sul wordmark (scala 1,06 → 1), 85 mm | Una lama di luce blu attraversa il wordmark cromato, mascherata dalla silhouette SVG; il logo non viene alterato | Pulsante «Salta» | Shader 2D realtime sul logo originale | `genks-wordmark.webp`, silhouette SVG |
| A2 · 1,5–3,5 s | Leggero tilt con parallasse | Riflesso del wordmark su un pavimento nero lucido, pulviscolo | — | Realtime | — |
| A3 · 3,5–6 s | Match cut: l'anello del simbolo vettoriale diventa l'alone dell'emblema a parete; la camera arretra dall'emblema e scopre il microfono nel buio | Le luci dello studio sono spente | — | Realtime 3D | `genks-symbol.svg` |

*Niente video AI per i loghi.*

### B — MICROFONO (tappa 1)

| Shot | Camera | Luce / materiali | Interazione | Tecnica |
| --- | --- | --- | --- | --- |
| B1 · hero | 70 mm, distanza circa 1,1 m, leggermente dal basso. Orbita lenta di ±4° e respiro di dolly; parallasse col cursore | Studio spento: key spot freddo dall'alto, due rim blu, fascio volumetrico con polvere. Sweep di luce blu sulla griglia ogni 4–5 s. Profondità di campo a fuoco sulla griglia, sfondo in bokeh (LED dei rack). Parola «VOCE» gigante dietro il microfono | Hover: il microfono si illumina, cursore a mano, etichetta «Prenota una sessione». Clic su microfono 3D o pulsante | Realtime |
| B2 · apertura configuratore | Push-in a 0,8 m e cambio d'angolo; il pannello Registrazione entra a passi (pacchetti ore → giorni → campi) | La luce resta drammatica | Wizard esistente | Realtime e DOM |

### C — RIVELAZIONE DELLO STUDIO (nuova tappa «Studio»)

| Shot | Camera | Luce | Tecnica |
| --- | --- | --- | --- |
| C1 · scroll | Dolly indietro e crane up dal microfono; la focale si apre da 70 a 40 mm; fuoco che passa dal microfono alla scrivania | Accensione in sequenza **legata allo scroll**: 1) linee LED della parete a doghe, 2) emblema, 3) schermo DAW, 4) LED dei rack in cascata, 5) nuvola a soffitto, 6) luce sulla scrivania e under-glow. La nebbia si dirada | Realtime |
| C2 · establishing (tappa) | Grandangolo con il microfono in primo piano a sinistra e la console al centro | Studio completamente acceso | Realtime |
| C3 · scroll | Carrellata laterale verso lo schermo DAW (tappa Beat su misura), poi crane sopra la scrivania verso il mixer, senza tagli | — | Realtime |

### D — MIX & MASTER (tappe Mix, Master, Mix & Master)

| Shot | Camera | Animazione | Interazione | Tecnica |
| --- | --- | --- | --- | --- |
| D1 · Mix | Macro radente sulla fila dei fader, 85 mm, profondità di campo stretta sui cappucci | Fader motorizzati che si posizionano uno dopo l'altro, LED di canale, scribble strip con i nomi delle tracce | La scheda Mix e il pulsante «Scegli» aprono il configuratore | Realtime |
| D2 · Master | Sopra le manopole verso il meter bridge, 60 mm | Meter che pompano, display «MASTER · −14 LUFS» | Idem | Realtime |
| D3 · Mix & Master | Console intera dall'alto, 40 mm | Tutto attivo | Idem | Realtime |

Il configuratore (Mix / Master / Mix & Master / invio tracce / pacchetti) è quello già in produzione. Lo stato della console segue la scelta, come un configuratore auto.

### E — TRANSIZIONE AL BEAT STORE

| Shot | Camera | Effetto | Tecnica |
| --- | --- | --- | --- |
| E1 | Avvicinamento al display del mixer fino a riempire lo schermo | La waveform del display parte dalla sua **posizione reale proiettata** sullo schermo e si espande a tutto schermo; le barre diventano le card del catalogo (già presente: va agganciata alla posizione 3D per renderla continua) | Realtime e canvas 2D |

### F — BEAT STORE

Card con profondità (tilt e riflesso col cursore), apertura del dettaglio come shared-element transition, copertine con parallasse a livelli. Restano player persistente, filtri, ricerca, BPM, tonalità, licenze e carrello. *Tecnica:* DOM/CSS 3D. Loop video Higgsfield opzionali come sfondi.

### G — BEAT SU MISURA E BUNDLE

- **Beat su misura:** camera sulla tastiera MIDI e sullo schermo DAW; i pad si accendono sui passi del sequencer; visualizzazione audio sincronizzata. *Tecnica:* realtime.
- **Bundle:** composizioni con bordi cromati e sweep di luce, reveal a scatti, prezzo che conta in avanti. *Tecnica:* DOM; video Higgsfield opzionale.

## 5. Piano degli asset

| Asset | Ora (gratis) | Fase premium (da autorizzare) |
| --- | --- | --- |
| Microfono a condensatore + supporto elastico + asta | Rimodellazione procedurale dettagliata: corpo a profilo tornito con smussi, doppia griglia a rete con capsula dorata visibile, nervature, badge col simbolo | GLB professionale, acquistato con licenza commerciale o commissionato: da preventivare |
| Mixer | Cappucci dei fader sagomati, manopole zigrinate con indicatore, serigrafie (scale dB, etichette, numeri canale), scribble strip, meter HDR | GLB e texture PBR dedicate |
| Monitor, rack, scrivania, pannelli | Correzione materiali, luci per tappa | GLB e bake della luce in Blender |
| Environment | Studio procedurale HDR (già presente), sweep animato | HDRI CC0 di Poly Haven, se migliora |
| Texture | Poly Haven CC0 (già presenti) e serigrafie generate dal codice | Texture macro generate con Higgsfield (griglia, alluminio spazzolato) |
| Immagini | — | Still cinematografici Higgsfield (vedi sezione 6) |
| Video | — | Clip Higgsfield per anteprima, sfondi Store e bundle (vedi sezione 6) |
| Loghi | Originali, non modificati | Wordmark vettoriale dal file sorgente del designer |

## 6. Piano Higgsfield

**Account verificato (sola lettura):** piano *free*, **0,5 crediti**. Senza acquistare crediti non è generabile nulla. Ogni prezzo qui sotto è un preventivo ufficiale del servizio, in crediti; il costo in euro dipende dal pacchetto che sceglierai.

**Modelli confrontati** (preventivi reali, clip di 5 s, 16:9):

| Modello | Punti di forza | Fotogrammi iniziale e finale | Crediti |
| --- | --- | --- | --- |
| Kling 3.0 Omni (Frames), pro | Movimenti controllati tra due fotogrammi dati: ideale per partire e arrivare su nostre inquadrature 3D | Sì | **9** |
| Kling 3.0, pro | Qualità e stabilità | Sì | 12,5 |
| Kling 4.0, 1080p | Riferimenti multipli, editing | Sì | 16,25 |
| Cinema Studio Video 3.0, 720p | Linguaggio cinema, controllo camera | Sì | 25 |
| Seedance 2.0, 1080p | Riferimenti immagine, video e audio | Sì | 60 |
| Cinema Studio Video 3.0, 1080p | Massima resa «da film» | Sì | 65 |
| Cinema Studio 4.0, 1080p | Il più recente della linea Cinema | Sì | 80 |
| Seedance 2.0 fast, 720p 9:16 | Versioni verticali per smartphone | Sì | 12,5 |

Per le immagini (2K):

| Modello | Crediti |
| --- | --- |
| Soul Cinema | ~0,12 (1 arrotondato) |
| Cinema Studio Image 2.5 | 2 |
| Nano Banana Pro | 2 |
| Seedream 5.0 Pro | 2,5 |
| GPT Image 2.6 high | 2,75 |
| FLUX 3 | 3 |

**Metodo per la coerenza:** ogni generazione parte da **render della nostra scena 3D**, usati come fotogramma iniziale e finale o come riferimento. In questo modo lo studio resta lo stesso spazio, non uno spazio reinventato. Niente loghi dentro i prompt o le immagini AI: i loghi originali si sovrappongono in compositing.

**Generazioni proposte per la sequenza prototipo** (Microfono → Studio → Mixer):

| Passo | Contenuto | Modello | Quantità | Crediti |
| --- | --- | --- | --- | --- |
| 1 · Look development | 3 still (microfono hero, studio, macro fader) × 2 varianti, dai nostri render | Cinema Studio Image 2.5 | 6 | 12 |
| 2 · Riferimenti materiali | Macro griglia, alluminio spazzolato, cappuccio fader | Nano Banana Pro | 3 | 6 |
| 3 · Test video | Lo stesso shot (orbita microfono) su due modelli per confronto | Kling O3 Frames + Cinema Studio 3.0 720p | 2 | 34 |
| 4a · Produzione, versione economica | 3 shot × 5 s sul modello vincente | Kling O3 Frames | 3 | 27 |
| 4b · Produzione, versione massima | 3 shot × 5 s | Cinema Studio 3.0 1080p | 3 | 195 |
| 5 · Versioni smartphone | 3 shot 9:16 | Seedance 2.0 fast 720p | 3 | 37,5 |

**Totale:** circa **79 crediti** (versione economica, senza mobile) fino a circa **285 crediti** (versione massima con mobile).

**Controllo qualità di ogni generazione:**
1. coerenza con la geometria 3D (posizioni degli oggetti);
2. assenza di artefatti (mani, testo, deformazioni);
3. continuità di luce col realtime;
4. loop pulito;
5. peso del file (meno di 2 MB per 5 s su mobile).

Quello che non passa non entra nel sito.

**Dove NON uso video AI:** microfono, mixer e qualsiasi oggetto cliccabile restano veri modelli 3D. I video servono solo per anteprima, sfondi, transizioni e bundle.

## 7. Roadmap

| Priorità | Fase | Contenuto | Costo |
| --- | --- | --- | --- |
| P0 | 3 · Prototipo | Microfono → Studio → Mixer al massimo livello realtime (sezione 8) | Gratis |
| P1 | 5 · Estensione realtime | Intro A col wordmark originale; transizione E agganciata al display; Beat Store F con profondità; bundle G | Gratis |
| P2 | 4 · Produzione Higgsfield | Piano della sezione 6, per confronto prima/dopo sulla stessa sequenza | Crediti da autorizzare |
| P2 | Modelli professionali | GLB di microfono, mixer e monitor; bake in Blender; KTX2/Meshopt | Da preventivare |
| P3 | 6 · QA | Profilazione su dispositivi reali (iPhone, Android medio, PC integrato), registrazioni, confronto con le reference | Gratis |

## 8. Prototipo realizzato (branch `claude/genks-cinematic`)

Confronto prima/dopo: `docs/cinematic/before-after.jpg`; schermate in `docs/cinematic/after-*`.

**Fatto, gratis, senza crediti:**

1. **Titoli d'apertura** (reference 2): in circa 2,4 secondi, non saltabili, le comete di luce convergono e disegnano l'anello, e appare il simbolo GENKS originale (SVG, non ridisegnato). Poi un'esplosione di raggi, con effetto velocità, porta la camera attraverso il simbolo, dentro lo studio buio.
2. **Microfono nel buio** (reference 1): focale lunga (~70 mm), fascio volumetrico con polvere, due rim blu, sweep di luce che scorre su tutti i cromi, parola «VOCE» nello spazio dietro il microfono, profondità di campo sulla griglia. Il microfono è cliccabile (mano, luce al passaggio) e apre la prenotazione.
3. **I servizi sotto i riflettori** (il principio della fila di prodotti della reference 1, senza copiarne la forma): uno showroom nel buio con quattro piedistalli neri lucidi con anello LED, ognuno nel suo cono di luce. Sopra ognuno ruota l'oggetto del servizio: microfono (Registrazione), pad controller che suona un pattern (Beat su misura), modulo fader che si muove (Mix & Master), vinile che gira (Beat Store). Salgono uno dopo l'altro; al passaggio del mouse l'oggetto si gira verso la camera e la luce si intensifica; didascalie con prezzo e clic aprono il servizio.
4. **Rivelazione dello studio** (sequenza C): la camera arretra e sale mentre le luci si accendono legate allo scroll: linee LED, emblema, schermo DAW, rack riga per riga, nuvola, scrivania. Arriva un'inquadratura d'insieme con il titolo «Un unico spazio, tre servizi.».
5. **Mixer** (sequenza D): macro radenti su fader e manopole, con scale serigrafate, scribble strip e cappucci sagomati. Fader motorizzati, meter e display seguono il servizio scelto (Mix / Master / Mix & Master), come un configuratore. La console è cliccabile.
6. **Pipeline:**
   - HDR con profondità di campo che segue il soggetto, bloom sulle sole sorgenti di luce, AgX + grading GENKS, grana;
   - qualità adattiva: prima toglie la profondità di campo, poi il post-processing, poi la risoluzione;
   - su telefono, regia e modelli identici con rendering leggero.
7. **Estensione** (fase 5, gratis): schede del Beat Store con profondità (tilt e luce che segue il cursore); Beat su misura con «Il tuo beat, in una frase» (reference 2): la frase compila genere, BPM, mood e descrizione.

**Resta da fare:**

- **Gratis:** continuità della waveform display → Beat Store agganciata alla posizione 3D; bundle come «box» che si apre (reference 3); lineup in prospettiva dei beat (reference 1).
- **Con crediti Higgsfield** (sezione 6), dopo il tuo acquisto e autorizzazione: still e clip per il confronto sulla stessa sequenza.
- **Con budget:** modelli GLB professionali di microfono, mixer e monitor, per avvicinarsi alla resa fotografica delle reference 1 e 3.
- **Verifica su dispositivi reali:** l'emulatore non misura la fluidità reale.
