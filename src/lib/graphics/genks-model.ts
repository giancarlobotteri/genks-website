import * as THREE from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
import { genksLetters } from "@/data/genks-lettering";

type GlyphModel = { label: string; geometry: THREE.ExtrudeGeometry; position: THREE.Vector3 };
let masters: GlyphModel[] | undefined;

// Browser-only asset cache. Scenes receive their own geometry copies and dispose them.
export function createGenksGlyphs(width: number): GlyphModel[] {
  if (!masters) {
    const loader = new SVGLoader();
    masters = genksLetters.map(letter => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" transform="translate(0 490) scale(1 -1)" d="${letter.path}"/></svg>`;
      const paths = loader.parse(svg).paths;
      const shapes = paths.flatMap(path => path.toShapes());
      const geometry = new THREE.ExtrudeGeometry(shapes, {
        depth: 44, bevelEnabled: true, bevelThickness: 1.2,
        bevelSize: .7, bevelSegments: 2, curveSegments: 6, steps: 1,
      });
      geometry.computeBoundingBox();
      const center = geometry.boundingBox!.getCenter(new THREE.Vector3());
      geometry.translate(-center.x, -center.y, -22);
      geometry.scale(1 / 1050, 1 / 1050, 1 / 1050);
      geometry.computeBoundingBox();
      return { label: letter.label, geometry, position: new THREE.Vector3((center.x - 525) / 1050, (center.y - 245) / 1050, 0) };
    });
  }
  return masters.map(glyph => ({
    label: glyph.label,
    geometry: glyph.geometry.clone().scale(width, width, width),
    position: glyph.position.clone().multiplyScalar(width),
  }));
}
