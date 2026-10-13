import { sendMagicLink, signInWithPassword } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const errors: Record<string, string> = {
    link: "Il collegamento è scaduto o è già stato usato. Richiedine uno nuovo qui sotto e apri l’email più recente.",
    rate_limit: "Hai richiesto più collegamenti in poco tempo. Attendi almeno un minuto prima di riprovare.",
    invalid_email: "Controlla che l’indirizzo email sia scritto correttamente.",
    configuration: "Il collegamento di accesso non è disponibile al momento. Riprova tra poco.",
    send: "Non è stato possibile inviare l’email. Riprova tra poco.",
  };
  return <div className="portal-shell narrow-shell">
    <span className="eyebrow">AREA CLIENTE GENKS</span>
    <h1>Accedi alla tua raccolta.</h1>
    <p className="muted">Usa la stessa email inserita al pagamento: i tuoi acquisti vengono collegati alla raccolta dopo l’accesso. Puoi entrare con un collegamento sicuro monouso, senza aver creato prima una password.</p>
    {query.sent && <p className="notice success" role="status">Controlla la posta. Il collegamento ha una validità limitata.</p>}
    {query.error && <p className="notice error" role="alert">{errors[String(query.error)] || "Non è stato possibile completare l’accesso. Controlla email e password oppure richiedi un collegamento qui sotto."}</p>}
    <form action={signInWithPassword} className="premium-form">
      <input type="hidden" name="next" value={typeof query.next === "string" ? query.next : "/account/library"} />
      <label>Email<input name="email" type="email" autoComplete="email" required placeholder="nome@esempio.it" /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" minLength={8} required /></label>
      <button className="button button-primary magnetic-cta" type="submit">ACCEDI</button>
    </form>
    <div className="login-divider"><span>OPPURE</span></div>
    <form action={sendMagicLink} className="premium-form compact-form">
      <input type="hidden" name="next" value={typeof query.next === "string" ? query.next : "/account/library"} />
      <label>Email per il collegamento di accesso<input name="email" type="email" autoComplete="email" required placeholder="nome@esempio.it" /></label>
      <button className="button button-primary" type="submit">INVIA COLLEGAMENTO DI ACCESSO</button>
    </form>
  </div>;
}

