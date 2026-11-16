import { SYMBOL_BLUE, SYMBOL_DARK, SYMBOL_INNER, SYMBOL_RING, SYMBOL_VIEWBOX } from "./brand-paths.ts";

/** The GENKS circular symbol — true vector, geometry identical to the original. Always square. */
export function GenksSymbol({ size = 32, title, className }: { size?: number; title?: string; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox={SYMBOL_VIEWBOX} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title} focusable="false">
      <circle r={464} fill={SYMBOL_BLUE} />
      <path fill={SYMBOL_DARK} fillRule="evenodd" d={SYMBOL_RING} />
      <path fill={SYMBOL_DARK} d={SYMBOL_INNER} />
    </svg>
  );
}

/**
 * The chrome GENKS wordmark. The original raster artwork is used as-is (aspect ratio locked);
 * the traced SVG silhouette cannot reproduce the photographic chrome, see docs/LOGHI.md.
 */
export function GenksWordmark({ className, alt = "GENKS" }: { className?: string; alt?: string }) {
  return <img className={className} src="/brand/genks-wordmark.webp" width={1320} height={1327} alt={alt} decoding="async" />;
}
