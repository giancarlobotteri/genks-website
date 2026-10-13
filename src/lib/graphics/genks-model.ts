import * as THREE from "three";

type GlyphModel = { label: string; geometry: THREE.BufferGeometry; position: THREE.Vector3 };
let masters: Promise<GlyphModel[]> | undefined;

// Prebuilt, indexed solids: no SVG parsing, triangulation or extrusion on the visitor's device.
// Each scene owns a copy so disposal cannot invalidate another scene.
export async function createGenksGlyphs(width: number): Promise<GlyphModel[]> {
  masters ??= fetch("/brand/genks-3d.json", { cache: "force-cache" }).then(async response => {
    if (!response.ok) throw new Error("Il modello GENKS non è disponibile.");
    const asset = await response.json() as { version: number; data: string };
    if (asset.version !== 1) throw new Error("Versione del modello non valida.");
    const binary = atob(asset.data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const view = new DataView(bytes.buffer);
    let offset = 0;
    const uint = () => { const value = view.getUint32(offset, true); offset += 4; return value; };
    const float = () => { const value = view.getFloat32(offset, true); offset += 4; return value; };
    if (uint() !== 1) throw new Error("Formato del modello non valido.");
    const count = uint();
    const glyphs: GlyphModel[] = [];
    for (let glyph = 0; glyph < count; glyph++) {
      const label = String.fromCharCode(view.getUint8(offset++));
      const position = new THREE.Vector3(float(), float(), float());
      const vertices = uint();
      const indicesCount = uint();
      const positions = new Float32Array(vertices * 3);
      for (let i = 0; i < positions.length; i++, offset += 2) positions[i] = view.getInt16(offset, true) / 65534;
      const normals = new Float32Array(vertices * 3);
      for (let i = 0; i < normals.length; i++) normals[i] = view.getInt8(offset++) / 127;
      const indices = new Uint16Array(indicesCount);
      for (let i = 0; i < indices.length; i++, offset += 2) indices[i] = view.getUint16(offset, true);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      glyphs.push({ label, geometry, position });
    }
    return glyphs;
  }).catch(error => { masters = undefined; throw error; });
  const models = await masters;
  return models.map(glyph => ({ label: glyph.label, geometry: glyph.geometry.clone().scale(width, width, width), position: glyph.position.clone().multiplyScalar(width) }));
}
