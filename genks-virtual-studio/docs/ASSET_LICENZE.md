# Asset e licenze

## Marchio

| File | Origine | Note |
| --- | --- | --- |
| `docs/brand-originals/IMG_9239.png` | Fornito dal committente | Originale, non modificato |
| `docs/brand-originals/IMG_9238.jpeg` | Fornito dal committente | Originale, non modificato |
| `public/brand/genks-symbol.svg` | Tracciato dall'originale | Vettoriale fedele |
| `public/brand/genks-wordmark.webp` | Ricompressione dell'originale | Raster |
| `public/brand/genks-wordmark-silhouette.svg` | Tracciato dall'originale | Solo contorni, usato come maschera |
| `src/components/brand-paths.ts` | Generato dal simbolo SVG | Stessa geometria |

Il marchio GENKS appartiene al committente.

## Contenuti creati per il prototipo

| Contenuto | Come è fatto | Diritti |
| --- | --- | --- |
| Studio 3D (microfono, mixer, monitor, rack, sedia, pannelli) | Geometrie generate dal codice (`src/scene/build-studio.ts`) | Originale, nessun modello esterno |
| Materiali (legno, metallo, tessuto, schiuma) e riflessi | Texture disegnate dal codice (`src/scene/textures.ts`) | Originali, nessuna texture o HDRI esterna |
| Anteprime audio dei beat | Sintetizzate nel browser (`src/lib/synth.ts`) | Originali, nessun campione o brano di terzi |
| Suoni del sequencer | Sintetizzati nel browser | Originali |
| Copertine dei beat | SVG generati dal codice | Originali |
| Titoli, descrizioni, prezzi, licenze, pacchetti | Dati di esempio in `src/data/fixtures.ts` | Inventati, marcati DEMO |

Nessuna immagine, video, modello, font o audio è stato scaricato da terzi o generato con servizi a pagamento. Non servono attribuzioni.

## Dipendenze

| Pacchetto | Licenza | Uso |
| --- | --- | --- |
| react, react-dom | MIT | Interfaccia |
| three | MIT | 3D |
| lucide-react | ISC | Icone |
| @fontsource/space-grotesk | OFL-1.1 | Font titoli, serviti in locale |
| @fontsource/manrope | OFL-1.1 | Font testi, serviti in locale |
| vite, @vitejs/plugin-react, vitest | MIT | Sviluppo e test |
| typescript | Apache-2.0 | Sviluppo |
| eslint e plugin | MIT | Sviluppo |

Strumenti usati solo per preparare i loghi, non distribuiti col sito: potracer (GPL-2.0), Pillow, NumPy.
