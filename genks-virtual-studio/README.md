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

Test end-to-end dei criteri di accettazione (35 controlli su desktop, mobile, tastiera e motion ridotto). Playwright non è una dipendenza del progetto; per usarlo:

```bash
npm i -D playwright && npx playwright install chromium
npm run preview &
npm run smoke      # opzionale: node scripts/smoke.cjs <url> <cartella-screenshot>
```

Ultima esecuzione: build, typecheck, lint, 17/17 test unitari e 35/35 controlli end-to-end superati.

## Percorsi funzionanti

| Percorso | Come arrivarci |
| --- | --- |
| Intro GENKS, saltabile | All'apertura. «Salta intro», tasto Esc o primo scroll. Link diretti a ogni servizio. |
| Microfono → registrazione | Hotspot «Esplora registrazione» o menu. Pacchetti, calendario demo, modulo. |
| Reveal dello studio | Scroll: la camera arretra e accende monitor, scrivania, rack, pannelli. |
| Mixer → Mix / Master / Mix & Master | Hotspot «Apri servizi Mix & Master» o menu. Schede, confronto, invio progetto remoto con upload simulato. |
| Waveform → Beat Store | Scroll oltre il display del mixer, oppure «Salta al catalogo». |
| Beat Store | Ricerca, filtri (genere, mood, tonalità, BPM, prezzo), ordinamento, stato vuoto. |
| Player persistente | Play su un beat: resta attivo mentre si naviga e si aprono pannelli. Mai in autoplay. |
| Licenze, carrello, checkout DEMO | «Licenze» su un beat → carrello → ordine simulato. |
| Esclusiva | Richiesta separata, senza prezzo e senza vendita automatica. |
| Beat su misura | Sequencer suonabile e modulo «Richiedi preventivo». |
| Pacchetti | Card confrontabili e richiesta. |
| Gestione contenuti demo | Menu → «Gestione demo» (`#/gestione`). |
| Modalità leggera | Menu → «Modalità leggera»: niente 3D, stessi servizi. Si attiva da sola se WebGL manca. |

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
- **Three.js senza React Three Fiber**: la scena è un unico modulo imperativo, una dipendenza in meno. Tutto il 3D è generato da primitive, senza modelli esterni.
- **Scroll senza GSAP**: il percorso camera è un'interpolazione propria e testata; evita una dipendenza con licenza non open source.
- **Audio sintetizzato nel browser**: anteprime originali, nessun file da licenziare.

## Limiti noti e priorità

1. Il wordmark cromato resta un'immagine raster: la sua versione vettoriale riproduce solo i contorni (vedi `docs/LOGHI.md`).
2. Lo studio è fatto di primitive: leggibile e coerente, ma non fotorealistico. Modelli GLB originali sono il primo miglioramento visivo.
3. Prestazioni misurate solo in emulazione software; su telefoni reali vanno verificati fluidità e consumo. Su schermi piccoli o dispositivi deboli qualità e risoluzione si riducono da sole.
4. I testi di licenza e le condizioni commerciali sono segnaposto: vanno sostituiti con testi approvati prima di vendere.
5. L'area gestione non ha autenticazione: è solo dimostrativa.

## Costi

Tutte le dipendenze sono gratuite e open source (MIT, ISC, Apache-2.0, OFL). Nessun servizio a pagamento, nessuna chiave API, nessuna carta richiesta. Hosting definitivo, dominio e commissioni di pagamento sono esterni al prototipo e possono avere costi.
