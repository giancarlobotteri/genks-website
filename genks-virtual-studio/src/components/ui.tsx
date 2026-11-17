import { X } from "lucide-react";
import { cloneElement, useEffect, useId, useRef, type ReactElement, type ReactNode } from "react";
import { rng } from "../lib/music.ts";
import type { Beat } from "../types.ts";
import s from "../styles/vs.module.css";
import { GenksSymbol } from "./brand.tsx";

export function DemoBadge({ children = "DEMO" }: { children?: ReactNode }) {
  return <span className={s.demoBadge}>{children}</span>;
}

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Accessible modal built on the native <dialog>: focus trap, Esc, inert page, focus return.
 * The page scroll is locked while open and restored without jumps.
 */
export function Sheet({ open, onClose, title, kicker, children, variant = "center", footer, wide, stage }: {
  open: boolean; onClose: () => void; title: string; kicker?: ReactNode; children: ReactNode; variant?: "center" | "side"; footer?: ReactNode; wide?: boolean;
  /** studio service: docked to the side, transparent backdrop, the 3D camera stays visible and keeps moving */
  stage?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const returnTo = useRef<Element | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      returnTo.current = document.activeElement;
      d.showModal();
      document.documentElement.dataset.vsLocked = "true";
    }
    if (!open && d.open) {
      const finish = () => {
        d.close();
        delete d.dataset.closing;
        delete document.documentElement.dataset.vsLocked;
        const el = returnTo.current as HTMLElement | null;
        if (el && document.contains(el)) el.focus({ preventScroll: true });
      };
      if (prefersReducedMotion()) finish();
      else {
        d.dataset.closing = "true";
        const t = window.setTimeout(finish, 200);
        return () => window.clearTimeout(t);
      }
    }
  }, [open]);

  useEffect(() => () => { delete document.documentElement.dataset.vsLocked; }, []);

  return (
    <dialog
      ref={ref}
      className={`${s.sheet} ${variant === "side" ? s.sheetSide : ""} ${wide ? s.sheetWide : ""} ${stage ? s.sheetStage : ""}`}
      aria-labelledby={titleId}
      onCancel={e => { e.preventDefault(); onClose(); }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={s.sheetInner}>
        <header className={s.sheetHead}>
          <div>
            {kicker && <p className={s.kicker}>{kicker}</p>}
            <h2 id={titleId}>{title}</h2>
          </div>
          <button type="button" className={s.iconBtn} onClick={onClose} aria-label="Chiudi pannello"><X size={20} /></button>
        </header>
        <div className={s.sheetBody} data-sheet-body>{children}</div>
        {footer && <footer className={s.sheetFoot}>{footer}</footer>}
      </div>
    </dialog>
  );
}

/** Deterministic, original cover art: brand blues + waveform + the GENKS symbol (undistorted). */
export function BeatCover({ beat, className }: { beat: Pick<Beat, "seed" | "hue" | "title">; className?: string }) {
  const r = rng(beat.seed * 7 + 3);
  const bars = Array.from({ length: 24 }, (_, i) => 10 + Math.abs(Math.sin(i * 0.55 + beat.seed)) * 34 + r() * 18);
  const h1 = 222 + beat.hue * 0.4;
  const id = `g${beat.seed}`;
  return (
    <div className={`${s.cover} ${className ?? ""}`} aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={`hsl(${h1} 70% 14%)`} />
            <stop offset="1" stopColor="#04070f" />
          </linearGradient>
          <radialGradient id={`${id}r`} cx={0.2 + r() * 0.6} cy={0.3 + r() * 0.3} r="0.7">
            <stop offset="0" stopColor={`hsl(${h1} 100% 64% / .55)`} />
            <stop offset="1" stopColor="transparent" />
          </radialGradient>
        </defs>
        <rect width="100" height="100" fill={`url(#${id})`} />
        <rect width="100" height="100" fill={`url(#${id}r)`} />
        {bars.map((h, i) => (
          <rect key={i} x={4 + i * 3.85} y={58 - h / 2} width={2} height={h} rx={1} fill={i % 5 === 0 ? "#9CBFFF" : "#4C83FF"} opacity={0.35 + (i % 3) * 0.2} />
        ))}
      </svg>
      <GenksSymbol size={22} className={s.coverMark} />
    </div>
  );
}

/** Label + control + hint/error. Ids are generated per instance so several forms can share field names. */
export function Field({ label, error, hint, children }: { label: string; name: string; error?: string; hint?: string; children: ReactElement<Record<string, unknown>> }) {
  const id = useId();
  const control = cloneElement(children, {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : hint ? `${id}-hint` : undefined,
  });
  return (
    <div className={s.field} data-invalid={error ? true : undefined}>
      <label htmlFor={id}>{label}</label>
      {control}
      {hint && !error && <small id={`${id}-hint`}>{hint}</small>}
      {error && <small id={`${id}-error`} className={s.fieldError} role="alert">{error}</small>}
    </div>
  );
}

/** Form control props; id and ARIA wiring are injected by <Field>. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const fieldProps = (name: string, _errors?: Record<string, string>) => ({ name });

export function DemoNotice({ children }: { children: ReactNode }) {
  return <p className={s.demoNotice}><DemoBadge />{children}</p>;
}
