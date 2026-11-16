# Loghi GENKS — file e report di vettorializzazione

I due originali sono conservati senza modifiche in `docs/brand-originals/`. Geometrie e proporzioni non sono state reinterpretate: nel sito i loghi mantengono sempre il rapporto d'aspetto originale.

## Simbolo circolare (`IMG_9239.png`)

**File:** `public/brand/genks-symbol.svg` — SVG realmente vettoriale (3 KB, nessuna immagine incorporata).

- Anelli: cerchi esatti con i raggi misurati sull'originale.
- Forma interna: tracciata dai pixel dell'originale con potrace.
- Colori campionati: blu `#4876F7`, scuro `#020918`.

**Verifica:** l'SVG è stato rasterizzato alla stessa risoluzione e confrontato pixel per pixel con l'originale: **99,0% di corrispondenza** dentro il disco (forma scura: 99,2%). Le differenze sono solo il bordo sfumato di 1 pixel lungo i contorni. **Conversione fedele.**

Due elementi dell'immagine originale non fanno parte del vettore: la sottile linea tratteggiata grigia attorno al cerchio e le due bande nere ai lati. Li ho considerati una guida di ritaglio e un residuo di screenshot. Se la linea tratteggiata fa parte del marchio, va aggiunta.

**Dove appare:** favicon, menu, coni dei monitor, targhetta del mixer, badge del microfono, emblema a parete, copertine dei beat, sezione pacchetti, footer.

## Wordmark cromato (`IMG_9238.jpeg`)

**File usato nel sito:** `public/brand/genks-wordmark.webp` — l'immagine originale, stesso formato 1320×1327, solo ricompressa. Nell'intro gli angoli neri vuoti fuori dal cerchio sono nascosti con un ritaglio circolare; l'artwork non è alterato.

**File vettoriale:** `public/brand/genks-wordmark-silhouette.svg` — contorni del lettering tracciati con potrace (57 KB, nessuna immagine incorporata).

**Verifica:** i contorni coincidono al 90,8% con la sagoma dell'originale. **La conversione però non è fedele come logo completo**: il cromo fotografico, le texture e i bagliori blu non sono riproducibili in vettoriale. Per questo:

- il sito mostra l'originale raster, come riferimento visivo temporaneo;
- la silhouette SVG è usata soltanto come maschera per il riflesso metallico animato dell'intro, non come sostituto del logo.

Per un wordmark vettoriale definitivo serve il file sorgente del designer, oppure un ridisegno manuale approvato.

## Rigenerare i file

```bash
pip install potracer pillow numpy
python3 scripts/trace-logos.py docs/brand-originals/IMG_9239.png docs/brand-originals/IMG_9238.jpeg <cartella-output>
```
