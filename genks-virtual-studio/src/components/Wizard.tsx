import { ArrowLeft, ArrowRight, CheckCircle2, Send } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { localRequests } from "../adapters.ts";
import { setSubShot } from "../lib/shots.ts";
import { validate, type Rules } from "../lib/validate.ts";
import s from "../styles/vs.module.css";
import type { DemoRequest, DemoRequestKind } from "../types.ts";
import { DemoBadge, prefersReducedMotion } from "./ui.tsx";

export type WizardStep = {
  id: string;
  /** short label in the step rail */
  label: string;
  /** camera shot for this step (see scene/shot-table) */
  shot: string;
  title: string;
  lead?: ReactNode;
  rules?: Rules;
  /** extra check before going on (e.g. "pick a day"); returns an error message or null */
  check?: () => string | null;
  render: (errors: Record<string, string>) => ReactNode;
};

/** Number that counts up when it appears (prices, hours, counts). */
export function CountUp({ value, format = (v: number) => String(Math.round(v)), ms = 900, delay = 0 }: { value: number; format?: (v: number) => string; ms?: number; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) { el.textContent = format(value); return; }
    let raf = 0;
    const t0 = performance.now() + delay;
    const step = (now: number) => {
      const u = Math.max(0, Math.min(1, (now - t0) / ms));
      const e = 1 - (1 - u) ** 4;
      el.textContent = format(value * e);
      if (u < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, format, ms, delay]);
  return <span ref={ref} className={s.countUp}>{format(0)}</span>;
}

/** Words that rise one after another out of their own masks. Real spaces stay in the text, so it reads normally. */
export function KineticWords({ text, from = 0, delay = 0 }: { text: string; from?: number; delay?: number }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((w, i) => (
        <span key={i}>
          <span className={s.kMask}><span className={s.kWord} style={{ ["--w" as string]: from + i, ["--d" as string]: `${delay}ms` } as CSSProperties}>{w}</span></span>
          {i < words.length - 1 ? " " : null}
        </span>
      ))}
    </>
  );
}

/** Kinetic step title: words rise one after another. */
export function StepTitle({ text, as: Tag = "h3" }: { text: string; as?: "h2" | "h3" }) {
  return <Tag className={s.wzTitle}><KineticWords text={text} /></Tag>;
}

/**
 * A service as a sequence of scenes. One step at a time: the camera moves to the step's shot,
 * the old step leaves, the new one builds itself element by element. All fields live in one
 * <form>, so values survive going back and forth; each step validates only its own fields.
 */
export function Wizard({ kind, steps, start = 0, submitLabel, summary, extra, doneShot, onAfterDone }: {
  kind: DemoRequestKind;
  steps: WizardStep[];
  start?: number;
  submitLabel: string;
  summary: (v: Record<string, string>) => string;
  extra?: () => Record<string, string>;
  doneShot: string;
  onAfterDone?: ReactNode;
}) {
  const [i, setI] = useState(start);
  const [leaving, setLeaving] = useState<number | null>(null);
  const [dir, setDir] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [stepError, setStepError] = useState<string | null>(null);
  const [done, setDone] = useState<DemoRequest | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const last = i === steps.length - 1;

  // the camera moves when the step changes (inside a step, choices may move it further)
  const shot = steps[i].shot;
  useEffect(() => { setSubShot(done ? doneShot : shot); }, [shot, done, doneShot]);

  const values = () => {
    const v: Record<string, string> = {};
    if (formRef.current) new FormData(formRef.current).forEach((x, k) => { if (typeof x === "string") v[k] = v[k] ? `${v[k]}, ${x}` : x; });
    return { ...v, ...(extra?.() ?? {}) };
  };

  const checkStep = (k: number) => {
    const st = steps[k];
    const errs = st.rules ? validate(values(), st.rules) : {};
    setErrors(errs);
    const custom = st.check?.() ?? null;
    setStepError(custom);
    const firstBad = Object.keys(errs)[0];
    if (firstBad) formRef.current?.querySelector<HTMLElement>(`[name="${firstBad}"]`)?.focus();
    return !firstBad && !custom;
  };

  const goTo = (n: number) => {
    if (n === i || n < 0 || n >= steps.length) return;
    if (n > i) { for (let k = i; k < n; k++) if (!checkStep(k)) { if (k !== i) setI(k); return; } }
    setErrors({}); setStepError(null);
    setDir(n > i ? 1 : -1);
    if (prefersReducedMotion()) { setI(n); return; }
    setLeaving(i);
    window.setTimeout(() => {
      setLeaving(null);
      setI(n);
      bodyRef.current?.closest("[data-sheet-body]")?.scrollTo({ top: 0 });
      // focus the new title for keyboard and screen-reader users, without jumping
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>(`[data-step="${steps[n].id}"] [data-step-focus]`)?.focus({ preventScroll: true }));
    }, 260);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!last) { goTo(i + 1); return; }
    const all: Rules = Object.assign({}, ...steps.map(x => x.rules ?? {}));
    const v = values();
    const errs = validate(v, all);
    const bad = steps.findIndex(st => Object.keys(st.rules ?? {}).some(k => errs[k]) || st.check?.());
    if (bad >= 0) { if (bad !== i) goTo(bad); setErrors(errs); return; }
    setDone(localRequests.submit(kind, summary(v), v));
  };

  if (done) {
    return (
      <div className={s.wzDone} role="status" tabIndex={-1} ref={el => el?.focus({ preventScroll: true })}>
        <span className={s.wzDoneRing} aria-hidden="true"><CheckCircle2 size={44} /></span>
        <StepTitle text="Richiesta demo registrata" />
        <p><DemoBadge /> Codice <strong>{done.id}</strong>. È salvata solo in questo browser: <strong>non è stata inviata</strong> e non costituisce una prenotazione, un ordine o un pagamento.</p>
        <p className={s.muted}>In produzione questo passo invierà la richiesta al backend GENKS con conferma via email.</p>
        {onAfterDone}
      </div>
    );
  }

  return (
    <form ref={formRef} className={s.wz} noValidate onSubmit={submit}>
      <ol className={s.wzRail} style={{ ["--step" as string]: i, ["--steps" as string]: steps.length } as CSSProperties} aria-label="Passaggi">
        <span className={s.stepInk} aria-hidden="true" />
        {steps.map((st, k) => (
          <li key={st.id} data-on={k === i || undefined} data-done={k < i || undefined}>
            <button type="button" onClick={() => goTo(k)} aria-current={k === i ? "step" : undefined} disabled={k > i + 1}>
              <span className={s.wzRailN}>{k + 1}</span><span className={s.wzRailL}>{st.label}</span>
            </button>
          </li>
        ))}
      </ol>
      <div ref={bodyRef} className={s.wzSteps}>
        {steps.map((st, k) => (
          <section key={st.id} data-step={st.id} className={s.wzStep} hidden={k !== i} data-leaving={leaving === k || undefined} data-dir={dir} aria-labelledby={`wz-${kind}-${st.id}`}>
            <p className={s.wzCount} aria-hidden="true">Passo {k + 1} di {steps.length} · {st.label}</p>
            <div id={`wz-${kind}-${st.id}`} tabIndex={-1} data-step-focus className={s.wzHead}><StepTitle text={st.title} /></div>
            {st.lead && <p className={s.wzLead}>{st.lead}</p>}
            <div className={s.wzBody}>{st.render(errors)}</div>
          </section>
        ))}
      </div>
      {(stepError || Object.keys(errors).length > 0) && <p className={s.formError} role="alert">{stepError ?? "Controlla i campi evidenziati."}</p>}
      <div className={s.wzFoot}>
        <button type="button" className={s.btnGhost} onClick={() => goTo(i - 1)} disabled={i === 0}><ArrowLeft size={16} /> Indietro</button>
        <span className={s.wzFootNote}><DemoBadge /> Nessun dato lascia il tuo dispositivo</span>
        {last
          ? <button type="submit" className={s.btnPrimary} data-wz-next><Send size={16} /> {submitLabel}</button>
          : <button type="submit" className={s.btnPrimary} data-wz-next>Avanti <ArrowRight size={16} /></button>}
      </div>
    </form>
  );
}
