import { CheckCircle2 } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { sendRequest } from "../adapters.ts";
import { validate, type Rules } from "../lib/validate.ts";
import s from "../styles/vs.module.css";
import type { DemoRequest, DemoRequestKind } from "../types.ts";

/**
 * Form wrapper: validates, sends the request to GENKS (confirmation email to the customer, notice to
 * GENKS) and shows the reference. Nothing is charged here: payment follows by email.
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
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

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
    if (sending) return;
    setSending(true); setSendError(null);
    sendRequest(kind, summary(values), values)
      .then(req => { setDone(req); onDone?.(req); }, (err: Error) => setSendError(err.message))
      .finally(() => setSending(false));
  };

  if (done) {
    return (
      <div className={s.success} role="status" tabIndex={-1} ref={el => el?.focus()}>
        <CheckCircle2 size={36} aria-hidden="true" />
        <h3>Richiesta inviata</h3>
        <p>Riferimento <strong>{done.id}</strong>. Ti abbiamo inviato una email di conferma: ti rispondiamo con i prossimi passi.</p>
        <p className={s.muted}>Non trovi l’email? Controlla la posta indesiderata o scrivici a <a href="mailto:assistenza@prodbygenks.com">assistenza@prodbygenks.com</a>.</p>
        <button type="button" className={s.btnGhost} onClick={() => setDone(null)}>Nuova richiesta</button>
      </div>
    );
  }
  return (
    <form className={s.form} noValidate onSubmit={submit}>
      {children(errors)}
      {(sendError || Object.keys(errors).length > 0) && <p className={s.formError} role="alert">{sendError ?? "Controlla i campi evidenziati."}</p>}
      <button type="submit" className={s.btnPrimary} disabled={sending} aria-busy={sending || undefined}>{sending ? "Invio in corso…" : submitLabel}</button>
      <p className={s.muted}>Riceverai una conferma via email. Nessun pagamento in questo passaggio.</p>
    </form>
  );
}
