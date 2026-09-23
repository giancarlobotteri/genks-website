# Asset provenance

## Artwork

Three original assets were created for this implementation with the built-in Imagegen tool. They are replaceable visual assets, not an assertion that GENKS uses this as its finalized logo. Resized WebP copies are committed; they have no runtime external-image dependency.

| File | Use |
| --- | --- |
| `public/artwork/genks-orb.webp` | Hero and chrome-themed demo covers |
| `public/artwork/blue-hour.webp` | Blue Hour and No Signal demo covers |
| `public/artwork/afterimage.webp` | Afterimage and Low Tide demo covers |

Generation briefs:

- GENKS orb: premium cinematic black liquid-metal sphere enclosed by an asymmetric sharp sculptural chrome ring, physically convincing silver highlights, restrained cobalt-blue rim lighting, black negative space at left, no text, logo or UI.
- Blue Hour: dark brutalist monolith with a thin vertical electric-blue slit, midnight fog and reflective black floor, monumental architecture, black/silver/blue palette, no text or logos.
- Afterimage: macro liquid-chrome wave/ribbon on a black background, smooth silver ripples, restrained cobalt-blue reflections, cinematic grain, no text or logos.

## Audio

All six preview clips are synthesized from sine waves and deterministic noise using `scripts/generate-demo-audio.mjs`. They are original software fixtures for testing playback, not user recordings, sampled commercial music or actual GENKS releases. BPM and root keys match their fixture records. No licensed music was downloaded.

Regenerate with Node.js and ffmpeg installed:

```bash
node scripts/generate-demo-audio.mjs
```

The resulting MP3s are committed, so ffmpeg is not needed to run or build the site.

## Font and icons

Space Grotesk Latin variable font, distributed through Fontsource; license: SIL Open Font License 1.1. Font and license are in `src/assets/fonts/`. Interface icons use the `lucide-react` package (ISC license). The simple SVG favicon is original code-native UI artwork.
