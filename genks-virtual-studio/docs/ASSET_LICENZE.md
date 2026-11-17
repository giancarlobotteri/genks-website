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
| Materiali (legno, metallo, tessuto, schiuma) e riflessi | Texture disegnate dal codice (`src/scene/textures.ts`) | Originali; usati come base e come ripiego se le texture fotografiche non si caricano |
| Anteprime audio dei beat | Sintetizzate nel browser (`src/lib/synth.ts`) | Originali, nessun campione o brano di terzi |
| Suoni del sequencer | Sintetizzati nel browser | Originali |
| Copertine dei beat | SVG generati dal codice | Originali |
| Titoli, descrizioni, prezzi, licenze, pacchetti | Dati di esempio in `src/data/fixtures.ts` | Inventati, marcati DEMO |

## Immagini generate con Higgsfield (crediti gratuiti dell'account)

| File | Uso |
| --- | --- |
| `public/assets/tex/daw-screen-*.webp` | Schermata DAW sul monitor dello studio 3D |
| `public/assets/img/store-bg*.webp` | Sfondo cinematografico del Beat Store |
| `public/assets/img/custom-hero*.webp` | Copertina del pannello «Beat su misura» |

Immagini generate con l'IA, senza loghi né marchi di terzi. Prima di un uso commerciale verificare i termini d'uso del piano Higgsfield attivo.

## Materiali di terzi (Poly Haven, licenza CC0)

Scaricati da polyhaven.com: dominio pubblico (CC0), uso commerciale libero, attribuzione non richiesta. Ridimensionati e convertiti in WebP in `public/assets/`.

| Asset | Uso nella scena |
| --- | --- |
| Texture `herringbone_parquet` | Pavimento |
| Texture `black_walnut_veneer_02` | Scrivania, doghe, fianchi |
| Texture `rough_linen` | Pannelli acustici |
| Texture `fabric_leather_02` | Sedia, poggiapolsi, cuffie |
| Texture `poly_wool_herringbone` | Tappeto |
| Texture `beige_wall_001` | Pareti |
| Modello `sofa_03` (Fran Calvente) | Divano |
| Modello `potted_plant_04` (James Ray Cock) | Pianta sulla scrivania |

Nessun asset a pagamento o generato con servizi a pagamento. Audio e font non provengono da terzi (i font sono OFL, vedi sotto).

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
