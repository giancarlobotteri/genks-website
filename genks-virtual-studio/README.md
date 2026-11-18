# GENKS Virtual Studio — prototipo FREE

Sito cinematografico e interattivo per lo studio GENKS: registrazione voce, Mix / Master, invio progetti da remoto, Beat Store con licenze, beat su misura e pacchetti.

**Questa è la versione FREE in modalità DEMO.** Nessun pagamento, prenotazione, upload o download reale è attivo. La versione PREMIUM non è sviluppata: è descritta soltanto in [`PREMIUM_ROADMAP.md`](PREMIUM_ROADMAP.md).

Il progetto è autonomo: vive interamente in questa cartella e non usa né modifica altro codice del repository.

> **Branch `claude/genks-cinematic` — versione cinematografica.** Stesse funzioni della versione FREE, con la regia ispirata alle tre reference (vedi [`CINEMATIC_PLAN.md`](CINEMATIC_PLAN.md)):
>
> - titoli d'apertura rapidi (circa 2,4 s, non saltabili) con scie di luce che disegnano il simbolo GENKS originale e un'esplosione di luce verso lo studio;
> - microfono solo nel buio con fascio di luce, polvere e parola «VOCE» nello spazio;
> - **i quattro servizi in fila sotto i riflettori**, come in uno showroom: quattro piedistalli con microfono, pad controller che suona, modulo fader in movimento e vinile che gira, cliccabili;
> - studio che si accende tappa dopo tappa con lo scroll;
> - macro sulla console con fader motorizzati che seguono il servizio scelto;
> - oggetti 3D cliccabili;
> - post-processing HDR (profondità di campo, bloom sulle sole luci, grading, grana);
> - **Beat Store con il suo ambiente 3D**: una sala dei vinili buia, con colonne di luce riflesse nel pavimento lucido e una spirale di dischi che girano; la camera entra dalla luce del display, avanza nella sala a ogni pagina del catalogo e sale dall'alto sui Pacchetti, con parallasse sul cursore; schede con profondità;
> - brief del beat su misura «in una frase».
>
> La versione FREE resta intatta sul branch `claude/eloquent-lamport-9y3y2f`.

## Avvio in locale

Serve Node.js 20 o superiore.

```bash
cd genks-virtual-studio
npm install
npm run dev        # http://localhost:5173
```

Versione di produzione:

```bash
npm run build
npm run preview    # http://localhost:4173
```

## Verifiche

```bash
npm run typecheck  # TypeScript
npm run lint       # ESLint, zero warning ammessi
npm test           # test unitari (catalogo, carrello, pacchetti, moduli, audio, camera, scroll)
```

Test end-to-end dei criteri di accettazione (desktop, telefono, tastiera e motion ridotto). Playwright non è una dipendenza del progetto; per usarlo:

```bash
npm i -D playwright && npx playwright install chromium
npm run preview &
npm run smoke      # opzionale: node scripts/smoke.cjs <url> <cartella-screenshot>
```

Ultima esecuzione (branch cinematografico): build, typecheck, lint, 29/29 test unitari e 79/79 controlli end-to-end superati.

## Percorsi funzionanti

| Percorso | Come arrivarci |
| --- | --- |
| Anteprima dei servizi | All'apertura parte un'anteprima animata sullo studio 3D: cinque capitoli (studio, registrazione, beat su misura, Mix & Master, Beat Store), ognuno con il suo movimento di telecamera e titoli animati. Barra dei capitoli cliccabile, pausa, avanti/indietro (frecce o tocco a destra/sinistra), «Salta». Ogni capitolo ha il suo pulsante per scegliere subito quel servizio. |
| «Di cosa hai bisogno?» | Alla fine dell'anteprima: quattro scelte (puntandole la telecamera si sposta sul servizio), più «Esplora lo studio liberamente» e «Rivedi l'anteprima». Nella stessa sessione si torna direttamente qui. |
| Schermate di servizio a passaggi | Registrazione, beat su misura e Mix & Master si aprono come schermate nuove: un passaggio alla volta (ore e prezzi → giorno e orario → dati → riepilogo; brief, sequencer, sound, dettagli; servizio, dettagli, brano, file, contatti). Ogni passaggio ha la sua inquadratura e i suoi elementi entrano uno dopo l'altro; i prezzi contano fino al valore. |
| Cambiare servizio | In ogni schermata di servizio, nella barra dello studio e dopo l'invio: un tocco porta a un altro servizio, con il movimento di telecamera relativo. |
| Visita dello studio | Scroll virtuale: la pagina non scorre, la telecamera segue dito o trackpad e al rilascio scivola alla tappa successiva (microfono nel buio → i servizi sotto i riflettori → lo studio si accende → monitor DAW → Mix → Master → Mix & Master → display). Ogni tappa ha la sua focale e la sua luce. Indicatore delle tappe a destra, cliccabile. Oltre il display si entra nel Beat Store. |
| Oggetti 3D cliccabili | Microfono, capsule dei servizi, schermo DAW e console reagiscono al cursore (luce e mano) e al clic aprono il loro servizio. |
| Beat in una frase | Nel Beat su misura: «trap cupa a 140 BPM…» compila genere, BPM, mood e descrizione e porta al passaggio del sound. |
| Studio che reagisce alla musica | Casse, LED e misuratori seguono l'anteprima in riproduzione e il sequencer. |
| Beat Store | Schermata propria con la sua intro animata (titolo, conteggio dei beat, licenze, poi l'onda si spezza e atterra sulle schede; completa la prima volta, breve le successive, «Intro» per rivederla). La griglia mostra esattamente i beat che entrano (6 su PC, 3–5 su telefono), pagine con transizioni e swipe; ricerca, filtri, ordinamento. Scheda «Pacchetti» accanto a «Beat». |
| Player persistente | Play su un beat: resta attivo mentre si naviga e si aprono pannelli. Mai in autoplay. |
| Licenze, carrello, checkout DEMO | «Licenze» su un beat → carrello → ordine simulato. |
| Esclusiva | Richiesta separata, senza prezzo e senza vendita automatica. |
| Pacchetti | Nel Beat Store, scheda «Pacchetti» (anche dal menu): card confrontabili e richiesta. |
| Gestione contenuti demo | Menu → «Gestione demo» (`#/gestione`). |
| Senza WebGL | Solo se il browser non supporta il 3D compare una griglia con gli stessi servizi (nessun interruttore «modalità leggera»). |

Cosa è reale e cosa è simulato: [`docs/DEMO_VS_REALE.md`](docs/DEMO_VS_REALE.md).
Loghi e report di vettorializzazione: [`docs/LOGHI.md`](docs/LOGHI.md).
Asset e licenze: [`docs/ASSET_LICENZE.md`](docs/ASSET_LICENZE.md).

## Struttura

```
src/
  data/fixtures.ts      contenuti demo (beat, licenze, servizi, pacchetti)
  adapters.ts           interfacce catalogo, disponibilità, richieste, carrello, checkout + versioni locali
  store.tsx             stato dell'app e player audio unico
  lib/                  logica pura: catalogo, validazione, disponibilità, sintesi audio, WAV
  scene/                studio 3D procedurale e percorso camera
  lib/director.ts       schermate (anteprima, studio, Beat Store) e inquadrature richieste
  lib/stepper.ts        scroll virtuale a molla (segue il dito, poi scivola alla tappa)
  lib/nav.ts            ogni navigazione come movimento di telecamera
  components/           anteprima, scena, schermate di servizio, Beat Store, pannelli, player, admin
  styles/               token di design e stili
public/brand/           loghi usati dal sito
docs/brand-originals/   loghi originali forniti, non modificati
scripts/                test end-to-end e script di tracciamento loghi
tests/                  test unitari
```

Per passare alla produzione si sostituiscono le implementazioni locali in `src/adapters.ts` con chiamate a un backend; l'interfaccia resta la stessa.

## Scelte tecniche

- **Vite + React + TypeScript**: progetto nuovo, senza backend obbligatorio.
- **Three.js senza React Three Fiber**: la scena è un unico modulo imperativo, una dipendenza in meno. Modelli, materiali fisici e mappa di riflessione sono generati dal codice, senza file esterni.
- **Due livelli di qualità**: alta (ombre morbide, luci d'area, bagliore) su computer capaci; ridotta su telefoni e dispositivi deboli. Si può forzare con `?quality=high` o `?quality=low`.
- **Scroll senza GSAP**: la pagina non scorre; una molla a smorzamento critico (testata a 60, 90, 120 e 144 Hz) muove la telecamera nello stesso frame del rendering, quindi niente scatti tra scroll e 3D. Evita anche una dipendenza con licenza non open source.
- **Audio sintetizzato nel browser**: anteprime originali, nessun file da licenziare.

## Limiti noti e priorità

1. Il wordmark cromato resta un'immagine raster: la sua versione vettoriale riproduce solo i contorni (vedi `docs/LOGHI.md`).
2. Lo studio è modellato e illuminato interamente dal codice (legno, metallo spazzolato, tessuto e schiuma acustica generati; ombre morbide e bagliore in alta qualità). È dettagliato ma non fotografico: texture fotografiche e modelli scansionati restano il passo successivo.
3. Prestazioni misurate solo in emulazione software; su telefoni reali vanno verificati fluidità e consumo. Su schermi piccoli o dispositivi deboli qualità e risoluzione si riducono da sole.
4. I testi di licenza e le condizioni commerciali sono segnaposto: vanno sostituiti con testi approvati prima di vendere.
5. L'area gestione non ha autenticazione: è solo dimostrativa.

## Costi

Tutte le dipendenze sono gratuite e open source (MIT, ISC, Apache-2.0, OFL). Nessun servizio a pagamento, nessuna chiave API, nessuna carta richiesta. Hosting definitivo, dominio e commissioni di pagamento sono esterni al prototipo e possono avere costi.

### Film introduttivo (Higgsfield Genjutsu)

- `public/film/genks-intro-{1080,720}.mp4`: anteprima di 13 s in un'unica ripresa, generata con Higgsfield Genjutsu (motion transfer, 1080p) a partire dal movimento di camera del sito (`scripts/render-intro.cjs`, piano pulito `?film` senza loghi né scritte in 3D) e da quattro foto fotorealistiche di riferimento.
- Nel sito parte dopo le scie di luce del simbolo GENKS (vettoriale originale), guida i capitoli dell'anteprima e sfuma sulla domanda finale. Senza video (riduzione movimento, risparmio dati, errore di rete) torna l'anteprima 3D dal vivo.
- Costo: 12 crediti (prova 480p 4 s) + 260 crediti (finale 1080p 13 s).
- Verifiche: `node scripts/smoke.cjs` 79/79.
