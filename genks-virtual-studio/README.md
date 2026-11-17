# GENKS Virtual Studio — prototipo FREE

Sito cinematografico e interattivo per lo studio GENKS: registrazione voce, Mix / Master, invio progetti da remoto, Beat Store con licenze, beat su misura e pacchetti.

**Questa è la versione FREE in modalità DEMO.** Nessun pagamento, prenotazione, upload o download reale è attivo. La versione PREMIUM non è sviluppata: è descritta soltanto in [`PREMIUM_ROADMAP.md`](PREMIUM_ROADMAP.md).

Il progetto è autonomo: vive interamente in questa cartella e non usa né modifica altro codice del repository.

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
npm test           # 17 test unitari (catalogo, carrello, pacchetti, moduli, audio, camera)
```

Test end-to-end dei criteri di accettazione (37 controlli su desktop, mobile, tastiera e motion ridotto). Playwright non è una dipendenza del progetto; per usarlo:

```bash
npm i -D playwright && npx playwright install chromium
npm run preview &
npm run smoke      # opzionale: node scripts/smoke.cjs <url> <cartella-screenshot>
```

Ultima esecuzione: build, typecheck, lint, 18/18 test unitari e 53/53 controlli end-to-end superati.

## Percorsi funzionanti

| Percorso | Come arrivarci |
| --- | --- |
| Intro GENKS, saltabile | All'apertura. «Salta intro», tasto Esc o primo scroll; indicazione «Scorri per entrare». Link diretti a ogni servizio. |
| Visita guidata a tappe | Ogni rotellina, swipe o freccia ↓ fa un movimento completo e lento della camera fino alla tappa successiva: microfono → monitor DAW → Mix → Master → Mix & Master → display → Beat Store. Con «riduci movimento» lo scroll resta libero. |
| Microfono → registrazione | Pulsante «Registrazione voce» sul microfono o menu. Pacchetti, calendario demo, modulo. |
| Monitor DAW → beat su misura | Pulsante «Beat su misura» sullo schermo o menu. Sequencer suonabile e modulo preventivo in un pannello. |
| Mixer → Mix / Master / Mix & Master | I tre servizi entrano uno dopo l'altro allo scorrimento; «Scegli…» apre il pannello sul servizio giusto, «Invia il progetto» apre l'upload simulato. |
| Display → Beat Store | «Entra nel Beat Store» (o uno scroll): la telecamera si tuffa nel display, l'onda si spezza e i frammenti atterrano sulle schede dei beat. |
| Movimento dentro i servizi | Aprendo un servizio la telecamera vola sull'oggetto (microfono, monitor, mixer); ogni passaggio ha la sua inquadratura: pacchetto, calendario, dati, schede Mix/Master, confronto, upload, invio. Pannelli laterali (PC) o in basso (telefono), la scena resta visibile e non smette mai di muoversi. |
| Studio che reagisce alla musica | Casse, LED e misuratori seguono l'anteprima in riproduzione e il sequencer. |
| Beat Store | Una schermata intera: la griglia si misura e mostra esattamente i beat che entrano (6 su PC, 3–5 su telefono), pagine con transizioni e swipe; ricerca, filtri sovrapposti, ordinamento, stato vuoto. |
| Player persistente | Play su un beat: resta attivo mentre si naviga e si aprono pannelli. Mai in autoplay. |
| Licenze, carrello, checkout DEMO | «Licenze» su un beat → carrello → ordine simulato. |
| Esclusiva | Richiesta separata, senza prezzo e senza vendita automatica. |
| Pacchetti | Card confrontabili e richiesta. |
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
  components/           intro, scena, pannelli, store, player, admin
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
- **Scroll senza GSAP**: il percorso camera è un'interpolazione propria e testata; evita una dipendenza con licenza non open source.
- **Audio sintetizzato nel browser**: anteprime originali, nessun file da licenziare.

## Limiti noti e priorità

1. Il wordmark cromato resta un'immagine raster: la sua versione vettoriale riproduce solo i contorni (vedi `docs/LOGHI.md`).
2. Lo studio è modellato e illuminato interamente dal codice (legno, metallo spazzolato, tessuto e schiuma acustica generati; ombre morbide e bagliore in alta qualità). È dettagliato ma non fotografico: texture fotografiche e modelli scansionati restano il passo successivo.
3. Prestazioni misurate solo in emulazione software; su telefoni reali vanno verificati fluidità e consumo. Su schermi piccoli o dispositivi deboli qualità e risoluzione si riducono da sole.
4. I testi di licenza e le condizioni commerciali sono segnaposto: vanno sostituiti con testi approvati prima di vendere.
5. L'area gestione non ha autenticazione: è solo dimostrativa.

## Costi

Tutte le dipendenze sono gratuite e open source (MIT, ISC, Apache-2.0, OFL). Nessun servizio a pagamento, nessuna chiave API, nessuna carta richiesta. Hosting definitivo, dominio e commissioni di pagamento sono esterni al prototipo e possono avere costi.
