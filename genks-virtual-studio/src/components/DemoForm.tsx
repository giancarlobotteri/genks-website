import { CheckCircle2 } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { localRequests } from "../adapters.ts";
import { validate, type Rules } from "../lib/validate.ts";
import s from "../styles/vs.module.css";
import type { DemoRequest, DemoRequestKind } from "../types.ts";
import { DemoBadge } from "./ui.tsx";

/**
 * Form wrapper: validates, records the request ONLY in this browser (demo gateway)
 * and shows a transparent confirmation. Nothing is sent, booked or charged.
 */
export function DemoForm({ kind, rules, summary, submitLabel, children, extra, onDone }: {
  kind: DemoRequestKind;
  rules: Rules;
  summary: (v: Record<string, string>) => string;
  submitLabel: string;
  children: (errors: Record<string, string>) => ReactNode;
  extra?: () => Record<string, string>;
  onDone?: (r: DemoRequest) => void;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<DemoRequest | null>(null);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const values: Record<string, string> = {};
    new FormData(form).forEach((v, k) => { if (typeof v === "string") values[k] = v; });
    Object.assign(values, extra?.() ?? {});
    const errs = validate(values, rules);
    setErrors(errs);
    const first = Object.keys(errs)[0];
    if (first) { form.querySelector<HTMLElement>(`[name="${first}"]`)?.focus(); return; }
    const req = localRequests.submit(kind, summary(values), values);
    setDone(req);
    onDone?.(req);
  };

  if (done) {
    return (
      <div className={s.success} role="status" tabIndex={-1} ref={el => el?.focus()}>
        <CheckCircle2 size={36} aria-hidden="true" />
        <h3>Richiesta demo registrata</h3>
        <p><DemoBadge /> Codice <strong>{done.id}</strong>. È salvata solo in questo browser: <strong>non è stata inviata</strong> e non costituisce una prenotazione, un ordine o un pagamento.</p>
        <p className={s.muted}>In produzione questo passo invierà la richiesta al backend GENKS con conferma via email.</p>
        <button type="button" className={s.btnGhost} onClick={() => setDone(null)}>Nuova richiesta</button>
      </div>
    );
  }
  return (
    <form className={s.form} noValidate onSubmit={submit}>
      {children(errors)}
      {Object.keys(errors).length > 0 && <p className={s.formError} role="alert">Controlla i campi evidenziati.</p>}
      <button type="submit" className={s.btnPrimary}>{submitLabel}</button>
      <p className={s.muted}><DemoBadge /> Invio dimostrativo: nessun dato lascia il tuo dispositivo.</p>
    </form>
  );
}
